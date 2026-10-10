-- =============================================================================
-- SpaceHub (static-site prototype) — schema
-- GENESIS hackathon, PS7: Centralized Innovation Facility Booking and
-- Utilization Portal.
--
-- Paste this WHOLE file into the Supabase SQL editor and run it once on a
-- fresh project, then run seed.sql. Re-running schema.sql on a project that
-- already has it will error on the `create table`/`create extension`
-- statements — drop the tables first (or use a fresh project) if you need to
-- re-run it.
--
-- Design notes (see the chat for the full phase-1 proposal this implements):
--   - Classrooms are booked instantly via room_bookings; event halls go
--     through event_requests (tentative hold -> admin decision); facility
--     usage (3D printers etc.) goes entirely through facility_queue ->
--     facility_sessions, not a generic bookings table — there's no "slot" to
--     book, just a queue position and an accept-or-pass-along offer.
--   - Double-booking is impossible at the DB level for both room_bookings
--     and event_requests: each has a generated tstzrange column and a
--     partial EXCLUDE USING gist constraint (btree_gist extension), so two
--     overlapping *active* rows for the same room can never both exist, even
--     under concurrent requests.
--   - "If nobody checks in within 15 minutes, treat the booking as
--     released" and "advance the queue when an offer expires" are both
--     computed AT READ TIME by plpgsql functions the client calls (via
--     supabase.rpc) right before it reads — never a cron job / pg_cron.
--     Both functions take an `as_of timestamptz` parameter instead of
--     hardcoding now(), specifically so the client's demo clock (which can
--     be fast-forwarded for the pitch) drives every time-based decision.
-- =============================================================================

create extension if not exists pgcrypto;    -- gen_random_uuid()
create extension if not exists btree_gist;  -- EXCLUDE constraints mixing equality + range

-- ============================================================== blocks ====
create table blocks (
  id    text primary key,   -- 'AB1'..'AB4'
  name  text not null
);

-- ========================================================= departments ====
create table departments (
  id              text primary key,  -- 'MECH', 'ECE', ...
  name            text not null,
  home_block_id   text not null references blocks(id),
  is_placeholder  boolean not null default false  -- flagged in the UI as sample/placeholder data
);

-- ================================================================ users ===
-- No real login (brief: "No real login: use a role switcher for the demo").
-- These are fictional demo accounts the role switcher picks from directly —
-- not Supabase Auth users, so RLS below cannot key off auth.uid().
create table users (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  role           text not null check (role in ('student','class_rep','faculty','facility_incharge','event_admin','super_admin')),
  department_id  text references departments(id),  -- null for roles not tied to one dept (e.g. super_admin)
  email          text,
  created_at     timestamptz not null default now()
);

-- ================================================================ rooms ===
-- Classrooms AND event halls live in one table (brief's suggested model),
-- discriminated by `type`. Event-hall-only attributes are nullable and
-- unused on classroom rows, and vice versa — enforced loosely by the CHECK
-- below (classrooms must carry section/floor/room_number; halls don't need to).
create table rooms (
  id                   text primary key,  -- room code, e.g. 'AB2-W305'
  block_id             text not null references blocks(id),
  section              text check (section in ('C','W','E')),
  floor                int,
  room_number          int,
  type                 text not null check (type in ('classroom','event_hall')),
  capacity             int not null,
  -- classroom-only
  has_projector        boolean not null default false,
  projector_working    boolean not null default true,
  byod                 boolean not null default false,
  -- event_hall-only
  has_av               boolean,
  has_stage            boolean,
  has_ac               boolean,
  requires_av_staff    boolean,
  min_notice_days      int,
  min_approval_level   text check (min_approval_level in ('university','department','club')),
  notes                text,
  constraint rooms_classroom_needs_location
    check (type <> 'classroom' or (section is not null and floor is not null and room_number is not null))
);
create index on rooms (block_id, type);

-- =========================================================== facilities ===
-- One row per *pooled* resource a queue forms around — e.g. one row for
-- "3D printers, ECE" covering however many physical machines ECE owns, not
-- one row per machine (see facility_units below for the individual units).
-- `type` is free text on purpose: the brief requires new facility types
-- (laser cutter, etc.) to be addable through seed data alone, with no schema
-- migration and no CHECK-constraint enum to update.
create table facilities (
  id                     uuid primary key default gen_random_uuid(),
  type                   text not null,              -- 'hpc' | '3d_printer' | ... (open vocabulary)
  name                   text not null,
  block_id               text not null references blocks(id),
  department_id          text references departments(id),  -- null for block-wide facilities like HPC
  location               text,
  description            text,
  requires_induction     boolean not null default false,
  allocation_model       text not null default 'queue' check (allocation_model in ('queue','compute_time')),
  facility_incharge_id   uuid references users(id),
  status                 text not null default 'available' check (status in ('available','maintenance')),
  cross_department_allowed boolean not null default true
);
create index on facilities (department_id);
create index on facilities (block_id);

-- Physical units behind a 'queue' facility (e.g. each ECE 3D printer is one
-- row here). 'compute_time' facilities (HPC) don't use this table — their
-- usage is tracked as allocations, not unit occupancy.
create table facility_units (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references facilities(id) on delete cascade,
  label         text not null,  -- e.g. 'Printer 1'
  status        text not null default 'available' check (status in ('available','in_use','maintenance'))
);
create index on facility_units (facility_id, status);

-- ===================================================== timetable_slots ====
-- The imported, admin-editable class timetable. A room is "occupied" in a
-- given slot if a timetable_slots row matches it — checked before any
-- instant booking is allowed, same as room_bookings' own conflict check.
create table timetable_slots (
  id             uuid primary key default gen_random_uuid(),
  room_id        text not null references rooms(id) on delete cascade,
  day_of_week    text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  start_time     time not null,
  end_time       time not null,
  department_id  text references departments(id),
  course_code    text,
  course_name    text,
  faculty_name   text,  -- free text; not every generated session needs to map to a real demo user
  unique (room_id, day_of_week, start_time)
);
create index on timetable_slots (room_id, day_of_week);

-- ======================================================= room_bookings ====
-- Classrooms only — instant, first-come-first-served.
create table room_bookings (
  id              uuid primary key default gen_random_uuid(),
  room_id         text not null references rooms(id) on delete cascade,
  booking_date    date not null,
  start_time      time not null,
  end_time        time not null,
  booked_by       uuid not null references users(id),
  purpose         text,
  status          text not null default 'booked' check (status in ('booked','checked_in','released','cancelled')),
  created_at      timestamptz not null default now(),
  checked_in_at   timestamptz,
  -- Plain (timezone-naive) range: a GENERATED column's expression must be
  -- immutable, and casting timestamp -> timestamptz depends on the session's
  -- TimeZone setting, so it isn't. Single-campus wall-clock time doesn't
  -- need timezone awareness anyway.
  period tsrange generated always as (
    tsrange(booking_date + start_time, booking_date + end_time)
  ) stored,
  -- THE double-booking guard — holds under concurrent requests, no app-level race possible.
  exclude using gist (room_id with =, period with &&) where (status in ('booked','checked_in'))
);
create index on room_bookings (room_id, booking_date);
create index on room_bookings (booked_by);

/** "If nobody checks in within 15 minutes, treat the booking as released" —
 *  called by the client (via supabase.rpc) right before it reads
 *  availability, passing the demo-clock-aware `as_of`. Never a cron job. */
create or replace function release_expired_room_bookings(as_of timestamptz default now())
returns void as $$
begin
  update room_bookings
  set status = 'released'
  where status = 'booked'
    and checked_in_at is null
    and as_of > ((booking_date + start_time)::timestamptz + interval '15 minutes');
end;
$$ language plpgsql;

-- ======================================================= event_requests ===
-- A request is a tentative hold, not a confirmed booking. Only an APPROVED
-- request is mutually exclusive with other approved requests for the same
-- hall/time — pending ones are allowed to overlap on purpose, so the admin
-- can compare competing requests side by side.
create table event_requests (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text,
  hall_room_id       text not null references rooms(id),
  requested_by       uuid not null references users(id),
  event_date         date not null,
  start_time         time not null,
  end_time           time not null,
  audience_size      int,
  event_level        text check (event_level in ('university','department','club')),
  academic           boolean not null default true,
  external_guests    boolean not null default false,
  priority_score     numeric,
  score_breakdown    jsonb,     -- includes the lead-time-days component used at scoring time
  status             text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
  decided_by         uuid references users(id),
  decided_at         timestamptz,
  decision_reason    text,      -- required by the app when the admin overrides the suggested score
  overridden         boolean not null default false,
  created_at         timestamptz not null default now(),
  period tsrange generated always as (
    tsrange(event_date + start_time, event_date + end_time)
  ) stored,
  exclude using gist (hall_room_id with =, period with &&) where (status = 'approved')
);
create index on event_requests (hall_room_id, event_date);
create index on event_requests (status);

-- ======================================================= hpc_allocations ==
-- HPC is one facility per block, allocated as compute time (node-hours),
-- never a physical slot — tracked here instead of facility_queue/_units.
create table hpc_allocations (
  id                    uuid primary key default gen_random_uuid(),
  facility_id           uuid not null references facilities(id),
  student_id            uuid not null references users(id),
  faculty_approver_id   uuid references users(id),
  node_hours_requested  numeric not null check (node_hours_requested > 0),
  purpose               text,
  status                text not null default 'pending' check (status in ('pending','approved','declined')),
  auto_approved         boolean not null default false,
  requested_at          timestamptz not null default now(),
  decided_at            timestamptz,
  decided_by            uuid references users(id),
  decision_reason       text
);
create index on hpc_allocations (facility_id, status);

-- ========================================================= facility_queue =
-- One row per person waiting for a pooled facility (e.g. "3D printer, ECE").
-- priority_tier: 1 = same department as the facility (priority), 2 = cross-
-- department (set by join_facility_queue() below, per facilities.
-- cross_department_allowed). Ordered by (priority_tier, joined_at).
create table facility_queue (
  id                 uuid primary key default gen_random_uuid(),
  facility_id        uuid not null references facilities(id),
  user_id            uuid not null references users(id),
  estimated_minutes  int,
  notes              text,
  file_url           text,
  priority_tier      int not null default 2,
  status             text not null default 'waiting' check (status in ('waiting','offered','accepted','expired','cancelled','completed')),
  joined_at          timestamptz not null default now(),
  offered_at         timestamptz,
  offer_expires_at   timestamptz,
  responded_at       timestamptz
);
create index on facility_queue (facility_id, status, priority_tier, joined_at);

-- ====================================================== facility_sessions =
-- Created when a queue offer is accepted — the actual usage record, used
-- for utilization/average-wait stats on the dashboard.
create table facility_sessions (
  id                 uuid primary key default gen_random_uuid(),
  facility_id        uuid not null references facilities(id),
  facility_unit_id   uuid references facility_units(id),
  user_id            uuid not null references users(id),
  queue_entry_id     uuid references facility_queue(id),
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  status             text not null default 'active' check (status in ('active','completed'))
);
create index on facility_sessions (facility_id, status);

/** Join the queue for a pooled facility. Sets priority tier from the
 *  requester's department vs the facility's owning department, then
 *  immediately tries to hand out an offer in case a unit is already free. */
create or replace function join_facility_queue(
  p_facility_id uuid, p_user_id uuid, p_estimated_minutes int,
  p_notes text default null, p_file_url text default null, as_of timestamptz default now()
) returns uuid as $$
declare
  v_facility_dept text;
  v_user_dept     text;
  v_tier          int;
  v_queue_id      uuid;
begin
  select department_id into v_facility_dept from facilities where id = p_facility_id;
  select department_id into v_user_dept from users where id = p_user_id;
  v_tier := case when v_facility_dept is not null and v_facility_dept = v_user_dept then 1 else 2 end;

  insert into facility_queue (facility_id, user_id, estimated_minutes, notes, file_url, status, joined_at, priority_tier)
  values (p_facility_id, p_user_id, p_estimated_minutes, p_notes, p_file_url, 'waiting', as_of, v_tier)
  returning id into v_queue_id;

  perform advance_facility_queue(p_facility_id, as_of);
  return v_queue_id;
end;
$$ language plpgsql;

/** One offer per currently-free unit, to the next people in line (by
 *  priority_tier, joined_at). Units aren't reserved to a specific offer here
 *  — accept_facility_offer() grabs a free unit (FOR UPDATE SKIP LOCKED) at
 *  accept time — but since this never offers more than the free-unit count,
 *  there's always one left for each offer that gets accepted. Existing
 *  'offered' entries are left alone (already have a unit's worth of claim). */
create or replace function advance_facility_queue(p_facility_id uuid, as_of timestamptz default now())
returns void as $$
declare
  v_offer_minutes   int := 30;
  v_free_units      int;
  v_live_offers     int;
  v_slots           int;
  v_next_id         uuid;
begin
  select count(*) into v_free_units from facility_units where facility_id = p_facility_id and status = 'available';
  select count(*) into v_live_offers from facility_queue where facility_id = p_facility_id and status = 'offered';
  v_slots := v_free_units - v_live_offers;

  while v_slots > 0 loop
    select id into v_next_id from facility_queue
      where facility_id = p_facility_id and status = 'waiting'
      order by priority_tier asc, joined_at asc
      limit 1;
    exit when v_next_id is null;

    update facility_queue
    set status = 'offered', offered_at = as_of, offer_expires_at = as_of + (v_offer_minutes || ' minutes')::interval
    where id = v_next_id;

    v_slots := v_slots - 1;
  end loop;
end;
$$ language plpgsql;

/** Expire any offer whose window has passed, then advance the queue behind
 *  it — same "compute at read time, never a cron job" pattern as classroom
 *  auto-release. Call before reading any facility_queue state. */
create or replace function expire_facility_offers(as_of timestamptz default now())
returns void as $$
declare
  r record;
begin
  for r in select * from facility_queue where status = 'offered' and offer_expires_at < as_of loop
    update facility_queue set status = 'expired' where id = r.id;
    perform advance_facility_queue(r.facility_id, as_of);
  end loop;
end;
$$ language plpgsql;

/** The offered person accepts: claims a free unit, starts a session. */
create or replace function accept_facility_offer(p_queue_id uuid, as_of timestamptz default now())
returns uuid as $$
declare
  v_entry    facility_queue%rowtype;
  v_unit_id  uuid;
  v_session  uuid;
begin
  select * into v_entry from facility_queue where id = p_queue_id and status = 'offered';
  if v_entry.id is null then
    raise exception 'This offer is no longer available.';
  end if;
  if as_of > v_entry.offer_expires_at then
    update facility_queue set status = 'expired' where id = p_queue_id;
    perform advance_facility_queue(v_entry.facility_id, as_of);
    raise exception 'This offer has expired.';
  end if;

  select id into v_unit_id from facility_units
    where facility_id = v_entry.facility_id and status = 'available'
    order by label
    limit 1
    for update skip locked;
  if v_unit_id is null then
    raise exception 'No unit is free after all — try again shortly.';
  end if;

  update facility_units set status = 'in_use' where id = v_unit_id;
  update facility_queue set status = 'accepted', responded_at = as_of where id = p_queue_id;

  insert into facility_sessions (facility_id, facility_unit_id, user_id, queue_entry_id, started_at, status)
  values (v_entry.facility_id, v_unit_id, v_entry.user_id, v_entry.id, as_of, 'active')
  returning id into v_session;

  return v_session;
end;
$$ language plpgsql;

/** Facility in-charge frees a unit (session done, or marking it available
 *  again after maintenance) — immediately tries to advance the queue. */
create or replace function release_facility_unit(p_unit_id uuid, as_of timestamptz default now())
returns void as $$
declare
  v_facility_id uuid;
begin
  select facility_id into v_facility_id from facility_units where id = p_unit_id;
  update facility_units set status = 'available' where id = p_unit_id;
  update facility_sessions set status = 'completed', ended_at = as_of
    where facility_unit_id = p_unit_id and status = 'active';
  perform advance_facility_queue(v_facility_id, as_of);
end;
$$ language plpgsql;

-- ============================================================ inductions ==
create table inductions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id),
  facility_id    uuid not null references facilities(id) on delete cascade,
  completed_at   timestamptz not null default now(),
  recorded_by    uuid references users(id),
  unique (user_id, facility_id)
);

-- ========================================================= notifications ==
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  type         text not null,  -- 'queue_offer' | 'booking_released' | 'event_decided' | ...
  title        text not null,
  body         text,
  related_id   uuid,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on notifications (user_id, read);

-- ========================================================== search_log ===
-- Feeds the dashboard's "searches that found nothing" unmet-demand metric.
create table search_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id),
  filters        jsonb,
  result_count   int not null,
  searched_at    timestamptz not null default now()
);

-- ================================================================== RLS ===
-- Demo-only, deliberately wide open: anon key, no real auth, no personal
-- data. DO NOT treat this as a template for a real deployment — before this
-- holds anything real, replace every `using (true)` below with checks tied
-- to an actual authenticated identity.
alter table blocks enable row level security;
alter table departments enable row level security;
alter table users enable row level security;
alter table rooms enable row level security;
alter table facilities enable row level security;
alter table facility_units enable row level security;
alter table timetable_slots enable row level security;
alter table room_bookings enable row level security;
alter table event_requests enable row level security;
alter table hpc_allocations enable row level security;
alter table facility_queue enable row level security;
alter table facility_sessions enable row level security;
alter table inductions enable row level security;
alter table notifications enable row level security;
alter table search_log enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'blocks','departments','users','rooms','facilities','facility_units',
    'timetable_slots','room_bookings','event_requests','hpc_allocations',
    'facility_queue','facility_sessions','inductions','notifications','search_log'
  ]
  loop
    execute format('create policy "demo: anyone can read %1$I" on %1$I for select using (true);', t);
    execute format('create policy "demo: anyone can write %1$I" on %1$I for all using (true) with check (true);', t);
  end loop;
end $$;
