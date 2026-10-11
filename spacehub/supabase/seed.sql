-- Seed data mirroring src/mock/seedData.js, so a real Supabase project starts
-- with the same rooms, the real Int. M.Sc Data Science VII B timetable,
-- facilities and demo accounts the mock mode uses. Run after schema.sql.

insert into rooms (id, name, building, floor, capacity, type, notes) values
  ('room-ab1-e103b', 'AB1 E103B', 'AB1', 'E1', 65, 'classroom', 'Home room, Int. M.Sc Data Science VII B'),
  ('room-ab1-w102',  'AB1 W102',  'AB1', 'W1', 40, 'classroom', 'Lab-friendly seating'),
  ('room-ab1-e104',  'AB1 E104',  'AB1', 'E1', 70, 'classroom', null),
  ('room-ab2-201',   'AB2 201',   'AB2', '2',  60, 'classroom', null),
  ('room-ab2-305',   'AB2 305',   'AB2', '3',  55, 'classroom', null),
  ('venue-amphitheatre', 'Amphitheatre', 'Central Quad', null, 800, 'event_venue', 'Open-air, flagship events'),
  ('venue-seminar-ab1',  'Seminar Hall, AB1', 'AB1', null, 150, 'event_venue', null),
  ('venue-auditorium',   'Main Auditorium', 'Admin Block', null, 1200, 'event_venue', 'University-level events, needs 2-week lead time');

insert into timetable_slots (room_id, day, slot_id, start_time, end_time, code, course_name, faculty) values
  ('room-ab1-e103b', 'Monday',    'slot4', '10:45', '11:35', '22CSC401',  'Deep Learning', 'Dr Thilaga M'),
  ('room-ab1-e103b', 'Monday',    'slot5', '11:35', '12:25', '22CSC343',  'Business Analytics', 'Dr Subhraaj R'),
  ('room-ab1-e103b', 'Monday',    'slot6', '12:25', '13:15', '22CSC404',  'Data Security', 'Dr Boovamithar Rakshit'),
  ('room-ab1-e103b', 'Monday',    'slot8', '14:05', '14:55', '22CSC541',  'Soft Computing', 'Dr Gnanapriyadarshini'),
  ('room-ab1-e103b', 'Monday',    'slot10','15:45', '16:35', null,        'Mentor Meeting', null),

  ('room-ab1-e103b', 'Tuesday',   'slot4', '10:45', '11:35', '22CSC404',  'Data Security', 'Dr Boovamithar Rakshit'),
  ('room-ab1-w102',  'Tuesday',   'slot5', '11:35', '12:25', '22CSC401L', 'Open Lab-I (Hadoop / Cascading / Web design / RapidMiner / Research gaps)', 'Ms Kavipriya'),
  ('room-ab1-w102',  'Tuesday',   'slot6', '12:25', '13:15', '22CSC401L', 'Open Lab-I (Hadoop / Cascading / Web design / RapidMiner / Research gaps)', 'Ms Kavipriya'),
  ('room-ab1-e103b', 'Tuesday',   'slot8', '14:05', '14:55', '22CSC530',  'Social Network Analysis', 'Dr Megeshwari V'),

  ('room-ab1-e103b', 'Wednesday', 'slot4', '10:45', '11:35', '22CSC401',  'Deep Learning', 'Dr Thilaga M'),
  ('room-ab1-e103b', 'Wednesday', 'slot5', '11:35', '12:25', '22MAT401',  'Probabilistic Graphical Models for Data Science', 'Dr Kalaivani'),
  ('room-ab1-e103b', 'Wednesday', 'slot6', '12:25', '13:15', '22CSC403',  'Reinforcement Learning', 'Dr Jeyaramakrishnan'),

  ('room-ab1-e103b', 'Thursday',  'slot4', '10:45', '11:35', '22MAT401',  'Probabilistic Graphical Models for Data Science', 'Dr Kalaivani'),
  ('room-ab1-e103b', 'Thursday',  'slot5', '11:35', '12:25', '22CSC530',  'Social Network Analysis', 'Dr Megeshwari V'),
  ('room-ab1-e103b', 'Thursday',  'slot6', '12:25', '13:15', '22CSC343',  'Business Analytics', 'Dr Subhraaj R'),
  ('room-ab1-e103b', 'Thursday',  'slot8', '14:05', '14:55', '22CSC404',  'Data Security', 'Dr Boovamithar Rakshit'),

  ('room-ab1-e103b', 'Friday',    'slot4', '10:45', '11:35', '22CSC403',  'Reinforcement Learning', 'Dr Jeyaramakrishnan'),
  ('room-ab1-e103b', 'Friday',    'slot5', '11:35', '12:25', '22MAT401',  'Probabilistic Graphical Models for Data Science', 'Dr Kalaivani'),
  ('room-ab1-e103b', 'Friday',    'slot6', '12:25', '13:15', '22CSC401',  'Deep Learning', 'Dr Thilaga M'),
  ('room-ab1-e103b', 'Friday',    'slot8', '14:05', '14:55', '22CSC553',  'Cloud Computing', 'Dr Kavitha P'),

  ('room-ab1-e104', 'Monday',    'slot2', '08:50', '09:40', '22CSC401', 'Deep Learning', 'Dr Thilaga M'),
  ('room-ab1-e104', 'Monday',    'slot3', '09:40', '10:30', '22CSC404', 'Data Security', 'Dr Boovamithar Rakshit'),
  ('room-ab1-e104', 'Wednesday', 'slot2', '08:50', '09:40', '22CSC401', 'Deep Learning', 'Dr Thilaga M'),
  ('room-ab1-e104', 'Wednesday', 'slot3', '09:40', '10:30', '22CSC404', 'Data Security', 'Dr Boovamithar Rakshit'),
  ('room-ab1-e104', 'Friday',    'slot2', '08:50', '09:40', '22CSC401', 'Deep Learning', 'Dr Thilaga M'),

  ('room-ab2-201', 'Tuesday',  'slot2', '08:50', '09:40', '22CSC343', 'Business Analytics', 'Dr Subhraaj R'),
  ('room-ab2-201', 'Thursday', 'slot2', '08:50', '09:40', '22CSC343', 'Business Analytics', 'Dr Subhraaj R');

insert into facilities (id, name, type, location, description, contact, induction_required, allocation_model, image) values
  ('fac-hpc', 'HPC Cluster', 'compute', 'Centre for Computational Engineering, AB4', 'Shared GPU/CPU cluster for large training jobs, simulations and research compute.', 'hpc-support@cb.amrita.edu', true, 'compute_time', '🖥️'),
  ('fac-3dprint', '3D Printing Lab', 'equipment', 'Innovation Lab, AB1 Ground Floor', 'FDM and resin 3D printers for prototyping. Bring your own filament or buy on-site.', 'innovationlab@cb.amrita.edu', true, 'time_slot', '🖨️'),
  ('fac-vr', 'VR / AR Lab', 'equipment', 'Innovation Lab, AB1 Ground Floor', 'Headsets and dev kits for immersive-computing projects and demos.', 'innovationlab@cb.amrita.edu', true, 'time_slot', '🥽'),
  ('fac-electronics', 'Electronics Prototyping Lab', 'equipment', 'AB2 Basement', 'Soldering stations, oscilloscopes, Arduino/Raspberry Pi kits for hardware projects.', 'ece-lab@cb.amrita.edu', true, 'time_slot', '🔧');

-- Demo accounts for the pilot's role-select screen (see src/pages/Login).
-- In production these rows are created by whatever syncs Amrita's login
-- (faculty lists, class-rep designations) instead of being hand-seeded.
insert into profiles (id, name, role, department, email) values
  (gen_random_uuid(), 'Aarav Menon', 'student', 'CSE', 'aarav@cb.students.amrita.edu'),
  (gen_random_uuid(), 'Diya Krishnan', 'student', 'Int. M.Sc Data Science', 'diya@cb.students.amrita.edu'),
  (gen_random_uuid(), 'Devika Nair', 'class_rep', 'Int. M.Sc Data Science, VII B', 'devika.rep@cb.students.amrita.edu'),
  (gen_random_uuid(), 'Arjun S', 'class_rep', 'CSE, V A', 'arjun.rep@cb.students.amrita.edu'),
  (gen_random_uuid(), 'Dr Thilaga M', 'faculty', 'Mathematics', 'thilaga@cb.amrita.edu'),
  (gen_random_uuid(), 'Dr Kavitha P', 'faculty', 'Computer Science and Engineering', 'kavitha@cb.amrita.edu'),
  (gen_random_uuid(), 'Dr Devika', 'class_advisor', 'Mathematics (Class Advisor, VII B)', 'devika.advisor@cb.amrita.edu'),
  (gen_random_uuid(), 'Dr Meera Nair', 'class_advisor', 'CSE (Class Advisor, V A)', 'meera.advisor@cb.amrita.edu'),
  (gen_random_uuid(), 'Dr Radhika N', 'hpc_faculty', 'Centre for Computational Engineering', 'radhika.hpc@cb.amrita.edu'),
  (gen_random_uuid(), 'Dr Vivek Rao', 'hpc_faculty', 'High Performance Computing Centre', 'vivek.hpc@cb.amrita.edu'),
  (gen_random_uuid(), 'Mr Suresh Kumar', 'lab_assistant', 'HPC & Innovation Lab', 'suresh.lab@cb.amrita.edu'),
  (gen_random_uuid(), 'Ms Kavipriya', 'lab_assistant', 'Innovation Lab', 'kavipriya.lab@cb.amrita.edu'),
  (gen_random_uuid(), 'Dr Anand Shenoy', 'lab_admin', 'Computational Engineering', 'anand.labadmin@cb.amrita.edu'),
  (gen_random_uuid(), 'Dr Nikhil Joseph', 'lab_admin', 'Innovation and Prototyping Labs', 'nikhil.labadmin@cb.amrita.edu'),
  (gen_random_uuid(), 'Mr Ramesh Iyer', 'resource_admin', 'Event & Space Office', 'ramesh.admin@cb.amrita.edu'),
  (gen_random_uuid(), 'Ms Anitha George', 'resource_admin', 'Campus Resource Management', 'anitha.admin@cb.amrita.edu'),
  (gen_random_uuid(), 'Ms Priya Balan', 'lost_property_handler', 'Office of Student Welfare', 'priya.welfare@cb.amrita.edu'),
  (gen_random_uuid(), 'Mr Joseph Mathew', 'lost_property_handler', 'Student Welfare and Support', 'joseph.welfare@cb.amrita.edu'),
  (gen_random_uuid(), 'Prof. K. R. Ramakrishnan', 'sys_admin', 'ICT & Campus Systems', 'sysadmin@cb.amrita.edu'),
  (gen_random_uuid(), 'Ms Sneha Varghese', 'sys_admin', 'Information and Campus Systems', 'sneha.sysadmin@cb.amrita.edu');
