-- SpaceHub — Unified Campus Space and Facility Booking Portal
-- Run this once in the Supabase SQL editor (or `supabase db push`) on a fresh
-- project. It creates every table the app needs, makes double-booking
-- impossible using PostgreSQL EXCLUDE constraints (not application code), and
-- sets up permissive-but-sane Row Level Security so the pilot works with the
-- Supabase anon key.
--
-- Mirrors src/mock/mockClient.js field-for-field — swapping VITE_SUPABASE_URL
-- / VITE_SUPABASE_ANON_KEY into .env.local moves the whole app onto this
-- schema with no component changes (see src/lib/dataClient.js).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- lets EXCLUDE mix equality + range checks

-- ============================================================== profiles --
-- In production, id = auth.users.id (Supabase Auth reusing the existing
-- Amrita login, per the "Behind the scenes" section of the brief). For the
-- pilot, rows are seeded directly and the app's role-select screen picks one.
create table profiles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  role         text not null check (role in ('student', 'class_rep', 'faculty', 'facility_incharge', 'admin')),
  department   text,
  email        text unique,
  created_at   timestamptz not null default now()
);

-- ================================================================= rooms --
create table rooms (
  id         text primary key,
  name       text not null,
  building   text,
  floor      text,
  capacity   int not null default 0,
  type       text not null check (type in ('classroom', 'event_venue')),
  notes      text
);

-- ============================================================ timetable ---
-- The imported class timetable. Admins edit this directly (insert/update/
-- delete rows) to reflect schedule changes — the availability board always
-- re-reads it live, so a change here instantly blocks/frees the right slot.
create table timetable_slots (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null references rooms(id) on delete cascade,
  day         text not null check (day in ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  slot_id     text not null,            -- e.g. 'slot4' — matches DAY_SLOTS in src/lib/constants.js
  start_time  time not null,
  end_time    time not null,
  code        text,                     -- course code, null for non-course blocks like "Mentor Meeting"
  course_name text,
  faculty     text,
  unique (room_id, day, slot_id)
);

-- ======================================================= room bookings ----
-- Classrooms: instant, first-come-first-served booking by class reps/faculty.
create table room_bookings (
  id             uuid primary key default gen_random_uuid(),
  room_id        text not null references rooms(id) on delete cascade,
  booking_date   date not null,
  slot_id        text not null,
  start_time     time not null,
  end_time       time not null,
  booked_by      uuid not null references profiles(id),
  purpose        text,
  status         text not null default 'booked' check (status in ('booked','checked_in','released','cancelled')),
  created_at     timestamptz not null default now(),
  checked_in_at  timestamptz,
  released_at    timestamptz,
  admin_override_reason text,
  -- Plain (timezone-naive) range, used purely for the exclusion constraint
  -- below. A GENERATED column's expression must be immutable, and casting
  -- timestamp -> timestamptz depends on the session's TimeZone setting, so
  -- it isn't — tsrange avoids that cast entirely. Single-campus wall-clock
  -- time doesn't need timezone awareness anyway.
  period tsrange generated always as (
    tsrange(booking_date + start_time, booking_date + end_time)
  ) stored,
  -- THE double-booking guard: two active bookings for the same room can never
  -- have overlapping periods. This holds even under concurrent requests —
  -- no application-level race condition is possible.
  exclude using gist (room_id with =, period with &&) where (status in ('booked','checked_in'))
);
create index on room_bookings (room_id, booking_date);
create index on room_bookings (booked_by);

-- A room can also be blocked outright for a date (admin override — exam,
-- maintenance day, etc.), independent of any specific booking.
create table blocked_dates (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null references rooms(id) on delete cascade,
  block_date  date not null,
  reason      text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  unique (room_id, block_date)
);

-- ================================================================ events --
-- Event venues: a request places a tentative hold; the admin decides between
-- competing requests, aided by (but not bound to) a suggested priority score.
create table events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  venue_room_id   text not null references rooms(id),
  requested_by    uuid not null references profiles(id),
  event_date      date not null,
  start_time      time not null,
  end_time        time not null,
  audience_size   int,
  event_level     text check (event_level in ('university','department','club')),
  academic        boolean not null default true,
  external_guests boolean not null default false,
  status          text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
  priority_score  int,
  score_breakdown jsonb,
  admin_reason    text,     -- required when the admin overrides the suggested score (enforced in the app)
  overridden      boolean not null default false,
  decided_by      uuid references profiles(id),
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  period tsrange generated always as (
    tsrange(event_date + start_time, event_date + end_time)
  ) stored,
  -- Only APPROVED events are mutually exclusive — pending requests are
  -- allowed to overlap on purpose, so the admin can see them side by side.
  exclude using gist (venue_room_id with =, period with &&) where (status = 'approved')
);
create index on events (venue_room_id, event_date);
create index on events (status);

-- ============================================================ facilities --
create table facilities (
  id                 text primary key,
  name               text not null,
  type               text,
  location           text,
  description        text,
  contact            text,
  allocation_model   text not null default 'time_slot' check (allocation_model in ('time_slot','compute_time')),
  image              text,
  under_maintenance  boolean not null default false
);

-- No induction system: access to a 'time_slot' facility (3D printer, VR/AR
-- lab, etc.) is granted per request instead.
--   Submitted -> [Faculty Approval Pending ->] Facility Admin Review ->
--   Approved / Rejected / Alternative Suggested
-- Students/class reps need their faculty mentor's sign-off first (mentor_id
-- required, status starts at 'pending_mentor'); faculty/admin requesters
-- skip straight to 'pending_facility' (mentor_id null — enforced by the app,
-- see NEEDS_FACILITY_MENTOR in src/lib/constants.js). The facility
-- administrator can approve, reject, or propose a different slot (stored in
-- the alt_* columns); the requester then accepts (-> approved, copying
-- alt_* into the canonical date/start/end) or declines (-> declined) it.
-- Only an APPROVED request is mutually exclusive with other approved ones
-- on the same facility/time — pending/suggested ones may overlap, same
-- reasoning as events above.
create table facility_requests (
  id                   uuid primary key default gen_random_uuid(),
  facility_id          text not null references facilities(id) on delete cascade,
  requested_by         uuid not null references profiles(id),
  mentor_id            uuid references profiles(id),
  request_date         date not null,
  start_time           time not null,
  end_time             time not null,
  duration_minutes     int,
  node_hours_requested numeric,  -- only set for 'compute_time' facilities (HPC) — see facilities.allocation_model
  purpose              text,
  status               text not null default 'pending_mentor' check (status in ('pending_mentor','pending_facility','alternative_suggested','approved','declined')),
  mentor_decided_by    uuid references profiles(id),
  mentor_decided_at    timestamptz,
  mentor_reason        text,
  facility_decided_by  uuid references profiles(id),
  facility_decided_at  timestamptz,
  facility_reason      text,
  alt_date             date,
  alt_start_time       time,
  alt_end_time         time,
  alt_note             text,
  created_at           timestamptz not null default now(),
  period tsrange generated always as (
    tsrange(request_date + start_time, request_date + end_time)
  ) stored,
  exclude using gist (facility_id with =, period with &&) where (status = 'approved')
);
create index on facility_requests (facility_id, request_date);
create index on facility_requests (mentor_id, status);
create index on facility_requests (requested_by);

-- HPC is allocated as compute time (node-hours, see node_hours_requested
-- above) rather than physical equipment, but otherwise goes through this
-- same facility_requests table and the same mentor -> facility-admin chain
-- as every other facility — no separate HPC-only table or approval path.

-- ============================================================ lost&found --
-- Reported by academic block (not an exact room — the finder rarely knows
-- the room code), with a free-text description for any location detail.
-- notified_user_ids is computed at report time: faculty with a timetabled
-- class in that block that day, plus anyone with an active classroom
-- booking there that day (see getPeopleWithActivityInBlock in the client).
create table lost_items (
  id                uuid primary key default gen_random_uuid(),
  block             text not null,
  description       text not null,
  photo_url         text,   -- compressed data URL (pilot) or a Storage public URL (production)
  found_by          uuid references profiles(id),
  reported_at       timestamptz not null default now(),
  status            text not null default 'unclaimed' check (status in ('unclaimed','claimed')),
  claimed_by        uuid references profiles(id),
  claimed_at        timestamptz,
  notified_user_ids uuid[] not null default '{}'
);

-- ========================================================== maintenance --
create table maintenance_reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('room','facility')),
  target_id    text not null,
  issue        text not null,
  reported_by  uuid references profiles(id),
  severity     text not null default 'minor' check (severity in ('minor','serious')),
  status       text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- =========================================================== auto-release =
-- "Room auto-released if nobody checks in within 15 minutes." Run this on a
-- schedule (Supabase: Database -> Cron, or `select cron.schedule(...)` if the
-- pg_cron extension is enabled) every 1-5 minutes.
create or replace function spacehub_auto_release_bookings()
returns void as $$
begin
  update room_bookings
  set status = 'released', released_at = now()
  where status = 'booked'
    and now() > ((booking_date + start_time)::timestamptz + interval '15 minutes');
end;
$$ language plpgsql security definer;

-- Example (run once, if pg_cron is enabled on your project):
-- select cron.schedule('spacehub-auto-release', '*/2 * * * *', 'select spacehub_auto_release_bookings();');

-- ================================================================== RLS ===
-- Pilot-grade policies: broad read access (an availability board and a
-- public events feed are supposed to be public within the campus), writes
-- gated on being signed in. Tighten with explicit per-role checks against
-- profiles.role before using this for anything beyond a pilot.
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table timetable_slots enable row level security;
alter table room_bookings enable row level security;
alter table blocked_dates enable row level security;
alter table events enable row level security;
alter table facilities enable row level security;
alter table facility_requests enable row level security;
alter table lost_items enable row level security;
alter table maintenance_reports enable row level security;

create policy "read all - profiles" on profiles for select using (true);
create policy "read all - rooms" on rooms for select using (true);
create policy "read all - timetable" on timetable_slots for select using (true);
create policy "read all - room_bookings" on room_bookings for select using (true);
create policy "read all - blocked_dates" on blocked_dates for select using (true);
create policy "read all - events" on events for select using (true);
create policy "read all - facilities" on facilities for select using (true);
create policy "read all - facility_requests" on facility_requests for select using (true);
create policy "read all - lost_items" on lost_items for select using (true);
create policy "read all - maintenance_reports" on maintenance_reports for select using (true);

create policy "signed-in write - room_bookings" on room_bookings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - blocked_dates" on blocked_dates for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - events" on events for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - timetable" on timetable_slots for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - facilities" on facilities for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - facility_requests" on facility_requests for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - lost_items" on lost_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - maintenance_reports" on maintenance_reports for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Enable Realtime (Database -> Replication, or the snippet below) on the
-- tables the UI live-updates so a booking made on one device shows up on
-- another without a page refresh:
-- alter publication supabase_realtime add table room_bookings, events, facility_requests, lost_items, maintenance_reports, blocked_dates, timetable_slots;
