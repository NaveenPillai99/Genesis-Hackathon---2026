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
  -- Generated range used purely for the exclusion constraint below.
  period tstzrange generated always as (
    tstzrange((booking_date + start_time)::timestamptz, (booking_date + end_time)::timestamptz)
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
  period tstzrange generated always as (
    tstzrange((event_date + start_time)::timestamptz, (event_date + end_time)::timestamptz)
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
  induction_required boolean not null default true,
  allocation_model   text not null default 'time_slot' check (allocation_model in ('time_slot','compute_time')),
  image              text,
  under_maintenance  boolean not null default false
);

create table inductions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id),
  facility_id   text not null references facilities(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  by_user_id    uuid references profiles(id),
  unique (user_id, facility_id)
);

create table facility_bookings (
  id            uuid primary key default gen_random_uuid(),
  facility_id   text not null references facilities(id) on delete cascade,
  user_id       uuid not null references profiles(id),
  booking_date  date not null,
  start_time    time not null,
  end_time      time not null,
  purpose       text,
  status        text not null default 'booked' check (status in ('booked','completed','cancelled')),
  created_at    timestamptz not null default now(),
  period tstzrange generated always as (
    tstzrange((booking_date + start_time)::timestamptz, (booking_date + end_time)::timestamptz)
  ) stored,
  exclude using gist (facility_id with =, period with &&) where (status = 'booked')
);
create index on facility_bookings (facility_id, booking_date);

-- HPC is allocated as compute time (node-hours), not physical slots. Small
-- requests self-serve; large ones need the student's faculty supervisor.
create table hpc_allocations (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references profiles(id),
  faculty_approver_id   uuid references profiles(id),
  node_hours_requested  numeric not null check (node_hours_requested > 0),
  purpose               text,
  status                text not null default 'pending' check (status in ('pending','approved','declined')),
  auto_approved         boolean not null default false,
  created_at            timestamptz not null default now(),
  decided_at            timestamptz,
  decided_by            uuid references profiles(id),
  decision_reason       text
);

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
alter table inductions enable row level security;
alter table facility_bookings enable row level security;
alter table hpc_allocations enable row level security;
alter table lost_items enable row level security;
alter table maintenance_reports enable row level security;

create policy "read all - profiles" on profiles for select using (true);
create policy "read all - rooms" on rooms for select using (true);
create policy "read all - timetable" on timetable_slots for select using (true);
create policy "read all - room_bookings" on room_bookings for select using (true);
create policy "read all - blocked_dates" on blocked_dates for select using (true);
create policy "read all - events" on events for select using (true);
create policy "read all - facilities" on facilities for select using (true);
create policy "read all - inductions" on inductions for select using (true);
create policy "read all - facility_bookings" on facility_bookings for select using (true);
create policy "read all - hpc_allocations" on hpc_allocations for select using (true);
create policy "read all - lost_items" on lost_items for select using (true);
create policy "read all - maintenance_reports" on maintenance_reports for select using (true);

create policy "signed-in write - room_bookings" on room_bookings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - blocked_dates" on blocked_dates for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - events" on events for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - timetable" on timetable_slots for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - facilities" on facilities for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - inductions" on inductions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - facility_bookings" on facility_bookings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - hpc_allocations" on hpc_allocations for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - lost_items" on lost_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "signed-in write - maintenance_reports" on maintenance_reports for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Enable Realtime (Database -> Replication, or the snippet below) on the
-- tables the UI live-updates so a booking made on one device shows up on
-- another without a page refresh:
-- alter publication supabase_realtime add table room_bookings, events, facility_bookings, lost_items, maintenance_reports, blocked_dates, timetable_slots;
