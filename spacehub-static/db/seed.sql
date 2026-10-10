-- =============================================================================
-- SpaceHub (static-site prototype) — seed data
-- Run AFTER schema.sql, in the Supabase SQL editor. All names/emails are
-- fictional; MECH and ECE are the two real home-block pairings given in the
-- brief, everything else (CSE/EEE/IT/CIVIL, their home blocks, exact
-- capacities etc.) is placeholder data, flagged as such in departments.is_placeholder.
--
-- The campus-model numbers here (4 blocks, 3 sections, 4 floors, 5 rooms per
-- floor-section, 70%/85% projector/working shares, 40% BYOD share, 80%
-- timetable occupancy, 85% home-block affinity, 30-min facility offer
-- window) mirror config.js (written in Phase 2) — if you change one, change
-- the other and re-run both files on a fresh project.
-- =============================================================================

-- ============================================================== blocks ====
insert into blocks (id, name) values
  ('AB1', 'Academic Block 1'),
  ('AB2', 'Academic Block 2'),
  ('AB3', 'Academic Block 3'),
  ('AB4', 'Academic Block 4');

-- ========================================================= departments ====
-- MECH -> AB1 and ECE -> AB2 are the two pairings given in the brief.
-- CSE / EEE / IT / CIVIL and their block assignments are placeholders,
-- invented only so every block has more than one resident department
-- (needed for the home-block-affinity timetable logic to mean anything).
insert into departments (id, name, home_block_id, is_placeholder) values
  ('MECH',  'Mechanical Engineering',                     'AB1', false),
  ('ECE',   'Electronics & Communication Engineering',    'AB2', false),
  ('CSE',   'Computer Science & Engineering',              'AB3', true),
  ('EEE',   'Electrical & Electronics Engineering',        'AB4', true),
  ('IT',    'Information Technology',                      'AB3', true),
  ('CIVIL', 'Civil Engineering',                            'AB1', true);

-- ================================================================ rooms ===
-- Classrooms: 4 blocks x 3 sections x 4 floors x 5 rooms = 240 rooms.
-- id format AB{block}-{section}{floor}{number}, e.g. 'AB2-W305'.
do $$
declare
  v_block_id text;
  v_section  text;
  v_floor    int;
  v_num      int;
  v_id       text;
  v_cap      int;
  v_has_proj boolean;
  v_proj_ok  boolean;
  v_byod     boolean;
begin
  for v_block_id in select id from blocks order by id loop
    foreach v_section in array array['C','W','E'] loop
      for v_floor in 1..4 loop
        for v_num in 1..5 loop
          v_id       := v_block_id || '-' || v_section || v_floor || lpad(v_num::text, 2, '0');
          v_cap      := (array[40,50,60,70])[1 + floor(random()*4)::int];
          v_has_proj := random() < 0.70;                                  -- 70% of classrooms have a projector
          v_proj_ok  := case when v_has_proj then random() < 0.85 else false end; -- 85% of those work
          v_byod     := random() < 0.40;                                  -- 40% are BYOD (power sockets)
          insert into rooms (id, block_id, section, floor, room_number, type, capacity, has_projector, projector_working, byod)
          values (v_id, v_block_id, v_section, v_floor, v_num, 'classroom', v_cap, v_has_proj, v_proj_ok, v_byod);
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

-- Event halls: 2 per block, 8 total — one large (stage+AV crew, long notice),
-- one small (AC only, short notice).
do $$
declare
  v_block_id text;
begin
  for v_block_id in select id from blocks order by id loop
    insert into rooms (id, block_id, type, capacity, has_av, has_stage, has_ac, requires_av_staff, min_notice_days, min_approval_level, notes)
    values
      (v_block_id || '-HALLA', v_block_id, 'event_hall', 300, true, true,  true, true,  14, 'university', 'Large hall — stage, AV crew, AC'),
      (v_block_id || '-HALLB', v_block_id, 'event_hall', 100, true, false, true, false,  3, 'club',       'Small hall — AC, no stage');
  end loop;
end $$;

-- Guarantee a known-good room for the acceptance-test demo path (MECH CR
-- books a free BYOD + working-projector room in AB1 at 14:00): force its
-- attributes and make sure nothing's scheduled on it, regardless of the
-- random generation above or which day you run the demo on.
update rooms set byod = true, has_projector = true, projector_working = true where id = 'AB1-C101';
delete from timetable_slots where room_id = 'AB1-C101';
delete from room_bookings where room_id = 'AB1-C101' and booking_date = current_date;

-- ================================================================ users ===
-- ~30 fictional demo accounts across every role and department. The role
-- switcher (Phase 2+) picks from these directly — there is no real login.
insert into users (name, role, department_id, email) values
  -- students (2 per department)
  ('Rahul Varma',          'student', 'MECH',  'rahul.varma@demo.spacehub.edu'),
  ('Sneha Pillai',         'student', 'MECH',  'sneha.pillai@demo.spacehub.edu'),
  ('Arjun Nair',           'student', 'ECE',   'arjun.nair@demo.spacehub.edu'),
  ('Priya Raman',          'student', 'ECE',   'priya.raman@demo.spacehub.edu'),
  ('Karthik Subramaniam',  'student', 'CSE',   'karthik.s@demo.spacehub.edu'),
  ('Ananya Iyer',          'student', 'CSE',   'ananya.iyer@demo.spacehub.edu'),
  ('Vishnu Prasad',        'student', 'EEE',   'vishnu.prasad@demo.spacehub.edu'),
  ('Meera Krishnan',       'student', 'EEE',   'meera.krishnan@demo.spacehub.edu'),
  ('Nikhil Menon',         'student', 'IT',    'nikhil.menon@demo.spacehub.edu'),
  ('Divya Shankar',        'student', 'IT',    'divya.shankar@demo.spacehub.edu'),
  ('Abhishek Rao',         'student', 'CIVIL', 'abhishek.rao@demo.spacehub.edu'),
  ('Lakshmi Narayan',      'student', 'CIVIL', 'lakshmi.narayan@demo.spacehub.edu'),
  -- class representatives (1 per department)
  ('Vignesh Kumar',        'class_rep', 'MECH',  'vignesh.kumar@demo.spacehub.edu'),
  ('Swathi Mohan',         'class_rep', 'ECE',   'swathi.mohan@demo.spacehub.edu'),
  ('Rohit Balakrishnan',   'class_rep', 'CSE',   'rohit.b@demo.spacehub.edu'),
  ('Pooja Venkatesh',      'class_rep', 'EEE',   'pooja.venkatesh@demo.spacehub.edu'),
  ('Harish Chandran',      'class_rep', 'IT',    'harish.chandran@demo.spacehub.edu'),
  ('Deepika Raghavan',     'class_rep', 'CIVIL', 'deepika.raghavan@demo.spacehub.edu'),
  -- faculty (1 per department)
  ('Dr Ramesh Iyer',           'faculty', 'MECH',  'ramesh.iyer@demo.spacehub.edu'),
  ('Dr Lakshmi Suresh',        'faculty', 'ECE',   'lakshmi.suresh@demo.spacehub.edu'),
  ('Dr Anand Krishnamurthy',   'faculty', 'CSE',   'anand.k@demo.spacehub.edu'),
  ('Dr Kavya Narasimhan',      'faculty', 'EEE',   'kavya.narasimhan@demo.spacehub.edu'),
  ('Dr Suresh Babu',           'faculty', 'IT',    'suresh.babu@demo.spacehub.edu'),
  ('Dr Geetha Raman',          'faculty', 'CIVIL', 'geetha.raman@demo.spacehub.edu'),
  -- facility in-charges (one per block, covers that block's HPC + resident dept's equipment)
  ('Mr Senthil Kumar',   'facility_incharge', 'MECH', 'senthil.kumar@demo.spacehub.edu'),
  ('Ms Divya Prakash',   'facility_incharge', 'ECE',  'divya.prakash@demo.spacehub.edu'),
  ('Mr Arvind Rajan',    'facility_incharge', 'CSE',  'arvind.rajan@demo.spacehub.edu'),
  ('Ms Nithya Balan',    'facility_incharge', 'EEE',  'nithya.balan@demo.spacehub.edu'),
  -- event admin + super admin (not tied to a department)
  ('Mr Suresh Pillai',   'event_admin', null, 'suresh.pillai@demo.spacehub.edu'),
  ('Ms Kamala Devi',     'super_admin', null, 'kamala.devi@demo.spacehub.edu');

-- ============================================================ facilities ==
-- HPC: one per block, block-wide (no owning department), compute-time model.
insert into facilities (type, name, block_id, department_id, location, description, requires_induction, allocation_model, facility_incharge_id, cross_department_allowed)
select 'hpc', b.id || ' HPC Cluster', b.id, null,
       b.id || ' Computing Centre, Ground Floor',
       'Shared GPU/CPU cluster, allocated as node-hours rather than physical slots.',
       false, 'compute_time',
       (select id from users where department_id = (
         select home.id from departments home
         where home.home_block_id = b.id
         order by home.is_placeholder asc, home.id  -- prefer the non-placeholder dept when a block has one
         limit 1
       ) and role = 'facility_incharge' limit 1),
       true
from blocks b;

-- 3D printers: one pooled facility per department, unequal unit counts,
-- located in the department's home block, induction required. The in-charge
-- is whichever facility_incharge user's own department_id falls within the
-- set of departments sharing this one's home block (each block has exactly
-- one facility_incharge user in the seed, covering every department there).
insert into facilities (type, name, block_id, department_id, location, description, requires_induction, allocation_model, facility_incharge_id, cross_department_allowed)
select '3d_printer', d.name || ' 3D Printing Lab', d.home_block_id, d.id,
       d.home_block_id || ' Fabrication Lab',
       'FDM 3D printers, queue-based access. Induction required before first use.',
       true, 'queue',
       (select u.id from users u
         where u.role = 'facility_incharge'
           and u.department_id in (select id from departments where home_block_id = d.home_block_id)
         limit 1),
       true
from departments d;

-- One Laser Cutter for ECE — demonstrates that a brand-new facility type
-- needs nothing but a seed-data row (no schema change, no enum to update).
insert into facilities (type, name, block_id, department_id, location, description, requires_induction, allocation_model, facility_incharge_id, cross_department_allowed)
values ('laser_cutter', 'ECE Laser Cutting Bay', 'AB2', 'ECE', 'AB2 Fabrication Lab',
        'CO2 laser cutter for acrylic/wood prototyping.', true, 'queue',
        (select id from users where name = 'Ms Divya Prakash'), true);

-- Printer/cutter unit counts (unequal per department, per the brief).
insert into facility_units (facility_id, label, status)
select f.id, 'Printer ' || g, 'available'
from facilities f
join (values ('MECH',3), ('ECE',5), ('CSE',4), ('EEE',2), ('IT',3), ('CIVIL',2)) as counts(dept, n)
  on f.department_id = counts.dept
cross join lateral generate_series(1, counts.n) as g
where f.type = '3d_printer';

insert into facility_units (facility_id, label, status)
select f.id, 'Laser Cutter ' || g, 'available'
from facilities f
cross join lateral generate_series(1, 2) as g
where f.type = 'laser_cutter';

-- ===================================================== timetable_slots ====
-- Mon-Sat, 08:00-17:00 in 1-hour slots, ~80% of classrooms occupied per
-- slot. When occupied, 85% of the time the teaching department is one of
-- the room's own block's home departments (room-centric reading of "a
-- department's classes are mostly in its home block" — symmetric since
-- every block has the same room count).
do $$
declare
  v_room        record;
  v_day         text;
  v_hour        int;
  v_dept_id     text;
  v_course_n    int;
  v_course_name text;
  v_days        text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  v_course_pool text[] := array['Core Theory','Lab Practical','Tutorial','Seminar','Workshop'];
begin
  for v_room in select id, block_id from rooms where type = 'classroom' loop
    foreach v_day in array v_days loop
      for v_hour in 8..16 loop
        if v_room.id = 'AB1-C101' then
          continue; -- kept clear for the acceptance-test demo room
        end if;
        if random() < 0.80 then -- ~80% occupied
          if random() < 0.85 then
            select id into v_dept_id from departments where home_block_id = v_room.block_id order by random() limit 1;
          else
            select id into v_dept_id from departments where home_block_id <> v_room.block_id order by random() limit 1;
          end if;
          v_course_n    := 1 + floor(random() * array_length(v_course_pool, 1))::int;
          v_course_name := (select name from departments where id = v_dept_id) || ' — ' || v_course_pool[v_course_n];
          insert into timetable_slots (room_id, day_of_week, start_time, end_time, department_id, course_code, course_name, faculty_name)
          values (
            v_room.id, v_day, (v_hour || ':00')::time, ((v_hour+1) || ':00')::time, v_dept_id,
            v_dept_id || (100 + floor(random()*50))::int,
            v_course_name,
            coalesce((select name from users where department_id = v_dept_id and role = 'faculty' limit 1), 'Visiting Faculty')
          );
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- ======================================================= room_bookings ====
-- A handful of instant classroom bookings so the board and "my bookings"
-- views have content from the moment the app loads. Clear any randomly-
-- generated timetable slot that would otherwise clash with each one first —
-- timetable_slots is keyed by day-of-week, not a specific date, so this has
-- to resolve the actual weekday each booking's date falls on.
delete from timetable_slots where room_id = 'AB2-C102' and day_of_week = trim(to_char(current_date, 'FMDay')) and start_time = '15:00';
delete from timetable_slots where room_id = 'AB3-E203' and day_of_week = trim(to_char(current_date, 'FMDay')) and start_time = '09:00';
delete from timetable_slots where room_id = 'AB4-W401' and day_of_week = trim(to_char(current_date + 1, 'FMDay')) and start_time = '11:00';

insert into room_bookings (room_id, booking_date, start_time, end_time, booked_by, purpose, status)
select r.id, current_date, '15:00'::time, '16:00'::time, u.id, 'Extra tutorial session', 'booked'
from rooms r, users u
where r.id = 'AB2-C102' and u.name = 'Swathi Mohan';

insert into room_bookings (room_id, booking_date, start_time, end_time, booked_by, purpose, status, checked_in_at)
select r.id, current_date, '09:00'::time, '10:00'::time, u.id, 'Project discussion', 'checked_in', now()
from rooms r, users u
where r.id = 'AB3-E203' and u.name = 'Rohit Balakrishnan';

insert into room_bookings (room_id, booking_date, start_time, end_time, booked_by, purpose, status)
select r.id, current_date + 1, '11:00'::time, '12:00'::time, u.id, 'Placement prep session', 'booked'
from rooms r, users u
where r.id = 'AB4-W401' and u.name = 'Pooja Venkatesh';

-- ======================================================= event_requests ===
-- The acceptance-test #2 scenario: two faculty request the same AB2 hall,
-- overlapping times, both pending — ready for the admin-decision screen
-- built in Phase 3. Scores/breakdowns here are representative placeholders;
-- Phase 3's JS computes real ones for any NEW request going forward.
insert into event_requests (title, description, hall_room_id, requested_by, event_date, start_time, end_time, audience_size, event_level, academic, external_guests, priority_score, score_breakdown, status)
select 'ECE Signal Processing Symposium', 'Department-level technical symposium with guest speakers.',
       'AB2-HALLB', u.id, current_date + 5, '10:00'::time, '12:00'::time, 90, 'department', true, true,
       62, '{"event_level":25,"academic":15,"audience_fit":15,"lead_time":5,"external_guests":2}'::jsonb, 'pending'
from users u where u.name = 'Dr Lakshmi Suresh';

insert into event_requests (title, description, hall_room_id, requested_by, event_date, start_time, end_time, audience_size, event_level, academic, external_guests, priority_score, score_breakdown, status)
select 'CSE Alumni Meet', 'Informal alumni networking evening.',
       'AB2-HALLB', u.id, current_date + 5, '11:00'::time, '13:00'::time, 70, 'club', false, true,
       34, '{"event_level":10,"academic":5,"audience_fit":12,"lead_time":5,"external_guests":2}'::jsonb, 'pending'
from users u where u.name = 'Dr Anand Krishnamurthy';

-- A few already-approved events for the public "Happening on campus" feed.
insert into event_requests (title, description, hall_room_id, requested_by, event_date, start_time, end_time, audience_size, event_level, academic, external_guests, priority_score, score_breakdown, status, decided_by, decided_at)
select 'MECH Robotics Showcase', 'Live demos of final-year robotics projects.',
       'AB1-HALLA', u.id, current_date + 2, '14:00'::time, '17:00'::time, 250, 'university', true, true,
       88, '{"event_level":40,"academic":15,"audience_fit":18,"lead_time":12,"external_guests":3}'::jsonb, 'approved',
       (select id from users where role = 'event_admin'), now()
from users u where u.name = 'Dr Ramesh Iyer';

insert into event_requests (title, description, hall_room_id, requested_by, event_date, start_time, end_time, audience_size, event_level, academic, external_guests, priority_score, score_breakdown, status, decided_by, decided_at)
select 'IT Dept Coding Marathon Finals', 'Finals + prize ceremony for the 24-hour hackathon.',
       'AB3-HALLB', u.id, current_date + 1, '18:00'::time, '21:00'::time, 80, 'department', true, false,
       55, '{"event_level":25,"academic":15,"audience_fit":15,"lead_time":0,"external_guests":0}'::jsonb, 'approved',
       (select id from users where role = 'event_admin'), now()
from users u where u.name = 'Dr Suresh Babu';

-- A declined one, with a reason, for the "your requests" view.
insert into event_requests (title, description, hall_room_id, requested_by, event_date, start_time, end_time, audience_size, event_level, academic, external_guests, priority_score, score_breakdown, status, decided_by, decided_at, decision_reason)
select 'EEE Movie Night', 'Casual department movie screening.',
       'AB4-HALLA', u.id, current_date + 2, '19:00'::time, '21:00'::time, 60, 'club', false, false,
       18, '{"event_level":10,"academic":5,"audience_fit":3,"lead_time":0,"external_guests":0}'::jsonb, 'declined',
       (select id from users where role = 'event_admin'), now(), 'Hall already approved for the Robotics Showcase that evening — try AB4-HALLB instead.'
from users u where u.name = 'Dr Kavya Narasimhan';

-- ======================================================= hpc_allocations ==
insert into hpc_allocations (facility_id, student_id, faculty_approver_id, node_hours_requested, purpose, status, auto_approved, decided_at)
select f.id, s.id, null, 8, 'Small CFD test run', 'approved', true, now()
from facilities f, users s
where f.type = 'hpc' and f.block_id = 'AB1' and s.name = 'Rahul Varma';

insert into hpc_allocations (facility_id, student_id, faculty_approver_id, node_hours_requested, purpose, status)
select f.id, s.id, fac.id, 60, 'Final-year thesis model training', 'pending'
from facilities f, users s, users fac
where f.type = 'hpc' and f.block_id = 'AB2' and s.name = 'Arjun Nair' and fac.name = 'Dr Lakshmi Suresh';

-- ============================================================ inductions ==
-- Everyone who appears below as either already using or queued for the ECE
-- 3D printer is inducted on it — their scenario has to be internally
-- consistent in case Phase 4 enforces "induction required" at queue-join
-- time, not just at accept time. Nobody else is: induction is opt-in seed
-- data, so the "needs induction" blocked state is just the default for
-- every other user/facility pairing — e.g. Vishnu Prasad (EEE) hitting the
-- MECH 3D printer's discover page with no induction row demonstrates it
-- with no extra seeding needed.
insert into inductions (user_id, facility_id, recorded_by)
select u.id, f.id, ic.id
from users u, facilities f, users ic
where u.name in ('Arjun Nair', 'Priya Raman', 'Swathi Mohan', 'Ananya Iyer', 'Karthik Subramaniam')
  and f.type = '3d_printer' and f.department_id = 'ECE'
  and ic.name = 'Ms Divya Prakash';

-- ===================================================== facility queue =====
-- ECE 3D printer lab, busy on purpose (acceptance test #3): ALL 5 units in
-- active sessions, so the two people who then join via the real
-- join_facility_queue() function land genuinely 'waiting' (advance_facility_
-- queue sees zero free units and makes no offer) — matching "join the queue,
-- see position and estimated wait" before anything is freed. During the live
-- demo, the facility in-charge calls release_facility_unit() on one busy
-- unit, which immediately offers it to whoever's first by (priority_tier,
-- joined_at) — an ECE student/CR joining live would jump ahead of these two
-- (both cross-department CSE, tier 2) to show the priority tiering in action.
do $$
declare
  v_facility_id uuid;
  v_unit        record;
  v_i           int := 0;
  v_user        uuid;
  v_names       text[] := array['Arjun Nair','Priya Raman','Dr Lakshmi Suresh','Swathi Mohan','Rohit Balakrishnan'];
begin
  select id into v_facility_id from facilities where type = '3d_printer' and department_id = 'ECE';

  for v_unit in select id from facility_units where facility_id = v_facility_id order by label loop
    v_i := v_i + 1;
    select id into v_user from users where name = v_names[v_i];
    update facility_units set status = 'in_use' where id = v_unit.id;
    insert into facility_sessions (facility_id, facility_unit_id, user_id, started_at, status)
    values (v_facility_id, v_unit.id, v_user, now() - interval '20 minutes', 'active');
  end loop;

  perform join_facility_queue(v_facility_id, (select id from users where name = 'Ananya Iyer'), 90, 'Need it for a class project model.', null, now() - interval '10 minutes');
  perform join_facility_queue(v_facility_id, (select id from users where name = 'Karthik Subramaniam'), 45, null, null, now() - interval '5 minutes');
end $$;

-- ========================================================= notifications ==
insert into notifications (user_id, type, title, body, read)
select u.id, 'queue_offer', 'A 3D printer is free', 'You have 30 minutes to accept your turn on the ECE 3D Printing Lab queue.', false
from users u where u.name in ('Ananya Iyer', 'Karthik Subramaniam');

insert into notifications (user_id, type, title, body, read)
select u.id, 'event_decided', 'Your event request was declined', 'EEE Movie Night was declined — see suggested alternative halls.', false
from users u where u.name = 'Dr Kavya Narasimhan';

-- ========================================================== search_log ===
-- A spread of searches, including a couple that found nothing, so the
-- dashboard's unmet-demand metric has something to show.
insert into search_log (user_id, filters, result_count)
select u.id, '{"block":"AB1","time":"14:00","byod":true}'::jsonb, 6 from users u where u.name = 'Vignesh Kumar';

insert into search_log (user_id, filters, result_count)
select u.id, '{"block":"AB2","projector_working":true,"capacity_min":100}'::jsonb, 0 from users u where u.name = 'Swathi Mohan';

insert into search_log (user_id, filters, result_count)
select u.id, '{"block":"AB4","section":"W","floor":4}'::jsonb, 0 from users u where u.name = 'Pooja Venkatesh';
