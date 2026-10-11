import { ROLES, ROOM_TYPES } from '../lib/constants'

// Static seed data: rooms, the imported timetable, facilities and a handful of
// demo accounts. Dates for bookings/events are deliberately NOT baked in here —
// mockClient.js computes them relative to "today" at first run, so the demo
// always looks current. Room AB1-E103B's timetable is taken from the real
// Int. M.Sc Data Science, 7th Sem B (Odd Sem 2026-27) timetable supplied for
// this project; course codes match its legend.

export const COURSE_LEGEND = {
  '22MAT401': { name: 'Probabilistic Graphical Models for Data Science', faculty: 'Dr Kalaivani' },
  '22CSC401': { name: 'Deep Learning', faculty: 'Dr Thilaga M' },
  '22CSC403': { name: 'Reinforcement Learning', faculty: 'Dr Jeyaramakrishnan' },
  '22CSC404': { name: 'Data Security', faculty: 'Dr Boovamithar Rakshit' },
  '22CSC401L': { name: 'Open Lab-I (Hadoop / Cascading / Web design / RapidMiner / Research gaps)', faculty: 'Ms Kavipriya' },
  '22CSC343': { name: 'Business Analytics', faculty: 'Dr Subhraaj R' },
  '22CSC553': { name: 'Cloud Computing', faculty: 'Dr Kavitha P' },
  '22CSC541': { name: 'Soft Computing', faculty: 'Dr Gnanapriyadarshini' },
  '22CSC530': { name: 'Social Network Analysis', faculty: 'Dr Megeshwari V' },
}

export const SEED_ROOMS = [
  { id: 'room-ab1-e103b', name: 'AB1 E103B', building: 'AB1', floor: 'E1', capacity: 65, type: ROOM_TYPES.CLASSROOM, notes: 'Home room, Int. M.Sc Data Science VII B' },
  { id: 'room-ab1-w102', name: 'AB1 W102', building: 'AB1', floor: 'W1', capacity: 40, type: ROOM_TYPES.CLASSROOM, notes: 'Lab-friendly seating' },
  { id: 'room-ab1-e104', name: 'AB1 E104', building: 'AB1', floor: 'E1', capacity: 70, type: ROOM_TYPES.CLASSROOM },
  { id: 'room-ab2-201', name: 'AB2 201', building: 'AB2', floor: '2', capacity: 60, type: ROOM_TYPES.CLASSROOM },
  { id: 'room-ab2-305', name: 'AB2 305', building: 'AB2', floor: '3', capacity: 55, type: ROOM_TYPES.CLASSROOM },
  { id: 'venue-amphitheatre', name: 'Amphitheatre', building: 'Central Quad', capacity: 800, type: ROOM_TYPES.EVENT_VENUE, notes: 'Open-air, flagship events' },
  { id: 'venue-seminar-ab1', name: 'Seminar Hall, AB1', building: 'AB1', capacity: 150, type: ROOM_TYPES.EVENT_VENUE },
  { id: 'venue-auditorium', name: 'Main Auditorium', building: 'Admin Block', capacity: 1200, type: ROOM_TYPES.EVENT_VENUE, notes: 'University-level events, needs 2-week lead time' },
]

// { room, day, slot, code }
export const SEED_TIMETABLE = [
  // AB1 E103B — Int. M.Sc Data Science VII B
  { room: 'room-ab1-e103b', day: 'Monday', slot: 'slot4', code: '22CSC401' },
  { room: 'room-ab1-e103b', day: 'Monday', slot: 'slot5', code: '22CSC343' },
  { room: 'room-ab1-e103b', day: 'Monday', slot: 'slot6', code: '22CSC404' },
  { room: 'room-ab1-e103b', day: 'Monday', slot: 'slot8', code: '22CSC541' },
  { room: 'room-ab1-e103b', day: 'Monday', slot: 'slot10', code: null, label: 'Mentor Meeting' },

  { room: 'room-ab1-e103b', day: 'Tuesday', slot: 'slot4', code: '22CSC404' },
  { room: 'room-ab1-w102', day: 'Tuesday', slot: 'slot5', code: '22CSC401L' },
  { room: 'room-ab1-w102', day: 'Tuesday', slot: 'slot6', code: '22CSC401L' },
  { room: 'room-ab1-e103b', day: 'Tuesday', slot: 'slot8', code: '22CSC530' },

  { room: 'room-ab1-e103b', day: 'Wednesday', slot: 'slot4', code: '22CSC401' },
  { room: 'room-ab1-e103b', day: 'Wednesday', slot: 'slot5', code: '22MAT401' },
  { room: 'room-ab1-e103b', day: 'Wednesday', slot: 'slot6', code: '22CSC403' },

  { room: 'room-ab1-e103b', day: 'Thursday', slot: 'slot4', code: '22MAT401' },
  { room: 'room-ab1-e103b', day: 'Thursday', slot: 'slot5', code: '22CSC530' },
  { room: 'room-ab1-e103b', day: 'Thursday', slot: 'slot6', code: '22CSC343' },
  { room: 'room-ab1-e103b', day: 'Thursday', slot: 'slot8', code: '22CSC404' },

  { room: 'room-ab1-e103b', day: 'Friday', slot: 'slot4', code: '22CSC403' },
  { room: 'room-ab1-e103b', day: 'Friday', slot: 'slot5', code: '22MAT401' },
  { room: 'room-ab1-e103b', day: 'Friday', slot: 'slot6', code: '22CSC401' },
  { room: 'room-ab1-e103b', day: 'Friday', slot: 'slot8', code: '22CSC553' },

  // A second, lighter section timetable (AB1 E104) so the availability board has contrast
  { room: 'room-ab1-e104', day: 'Monday', slot: 'slot2', code: '22CSC401' },
  { room: 'room-ab1-e104', day: 'Monday', slot: 'slot3', code: '22CSC404' },
  { room: 'room-ab1-e104', day: 'Wednesday', slot: 'slot2', code: '22CSC401' },
  { room: 'room-ab1-e104', day: 'Wednesday', slot: 'slot3', code: '22CSC404' },
  { room: 'room-ab1-e104', day: 'Friday', slot: 'slot2', code: '22CSC401' },

  { room: 'room-ab2-201', day: 'Tuesday', slot: 'slot2', code: '22CSC343' },
  { room: 'room-ab2-201', day: 'Thursday', slot: 'slot2', code: '22CSC343' },
]

export const SEED_FACILITIES = [
  {
    id: 'fac-hpc',
    name: 'HPC Cluster',
    type: 'compute',
    location: 'Centre for Computational Engineering, AB4',
    description: 'Shared GPU/CPU cluster for large training jobs, simulations and research compute.',
    contact: 'hpc-support@cb.amrita.edu',
    inductionRequired: true,
    allocationModel: 'compute_time',
    image: '🖥️',
  },
  {
    id: 'fac-3dprint',
    name: '3D Printing Lab',
    type: 'equipment',
    location: 'Innovation Lab, AB1 Ground Floor',
    description: 'FDM and resin 3D printers for prototyping. Bring your own filament or buy on-site.',
    contact: 'innovationlab@cb.amrita.edu',
    inductionRequired: true,
    allocationModel: 'time_slot',
    image: '🖨️',
  },
  {
    id: 'fac-vr',
    name: 'VR / AR Lab',
    type: 'equipment',
    location: 'Innovation Lab, AB1 Ground Floor',
    description: 'Headsets and dev kits for immersive-computing projects and demos.',
    contact: 'innovationlab@cb.amrita.edu',
    inductionRequired: true,
    allocationModel: 'time_slot',
    image: '🥽',
  },
  {
    id: 'fac-electronics',
    name: 'Electronics Prototyping Lab',
    type: 'equipment',
    location: 'AB2 Basement',
    description: 'Soldering stations, oscilloscopes, Arduino/Raspberry Pi kits for hardware projects.',
    contact: 'ece-lab@cb.amrita.edu',
    inductionRequired: true,
    allocationModel: 'time_slot',
    image: '🔧',
  },
]

export const SEED_PROFILES = [
  { id: 'user-director-1', name: 'Dr Sasangan Ramanathan', role: ROLES.CAMPUS_DIRECTOR, department: 'Campus Administration', email: 'director@cb.amrita.edu', rollNumber: 'EMP.DIR.CAMPUS01' },
  { id: 'user-dean-1', name: 'Dr Shankar K', role: ROLES.DEAN, department: 'Deanery of Engineering', email: 'dean@cb.amrita.edu', rollNumber: 'EMP.DEAN.ENG01' },
  { id: 'user-hod-1', name: 'Dr Prema Nedungadi', role: ROLES.HOD, department: 'Computer Science & Engineering', email: 'hod.cse@cb.amrita.edu', rollNumber: 'EMP.HOD.CSE01' },
  { id: 'user-student-1', name: 'Aarav Menon', role: ROLES.STUDENT, department: 'CSE, V A', email: 'aarav@cb.students.amrita.edu', rollNumber: 'CB.EN.U4CSE21234' },
  { id: 'user-classrep-1', name: 'Devika Nair', role: ROLES.CLASS_REP, department: 'Int. M.Sc Data Science, VII B', email: 'devika.rep@cb.students.amrita.edu', rollNumber: 'CB.PS.I5DAS23157' },
  { id: 'user-classadvisor-1', name: 'Dr Devika', role: ROLES.CLASS_ADVISOR, department: 'Mathematics (Class Advisor, VII B)', email: 'devika.advisor@cb.amrita.edu', rollNumber: 'EMP.FAC.MATH402' },
  { id: 'user-faculty-1', name: 'Dr Thilaga M', role: ROLES.FACULTY, department: 'CSE / Mathematics', email: 'thilaga@cb.amrita.edu', rollNumber: 'EMP.FAC.CSE109' },
  { id: 'user-hpcfaculty-1', name: 'Dr Radhika N', role: ROLES.HPC_FACULTY, department: 'Centre for Computational Engineering', email: 'radhika.hpc@cb.amrita.edu', rollNumber: 'EMP.FAC.CCE301' },
  { id: 'user-labassist-1', name: 'Mr Suresh Kumar', role: ROLES.LAB_ASSISTANT, department: 'HPC & Innovation Lab', email: 'suresh.lab@cb.amrita.edu', rollNumber: 'EMP.STAFF.LAB204' },
  { id: 'user-labadmin-1', name: 'Dr Anand Shenoy', role: ROLES.LAB_ADMIN, department: 'Computational Engineering', email: 'anand.labadmin@cb.amrita.edu', rollNumber: 'EMP.FAC.CCE102' },
  { id: 'user-resourceadmin-1', name: 'Mr Ramesh Iyer', role: ROLES.RESOURCE_ADMIN, department: 'Event & Space Office', email: 'ramesh.admin@cb.amrita.edu', rollNumber: 'EMP.ADMIN.RES005' },
  { id: 'user-welfare-1', name: 'Ms Priya Balan', role: ROLES.LOST_PROPERTY_HANDLER, department: 'Office of Student Welfare', email: 'priya.welfare@cb.amrita.edu', rollNumber: 'EMP.STAFF.SW012' },
  { id: 'user-sysadmin-1', name: 'Prof. K. R. Ramakrishnan', role: ROLES.SYS_ADMIN, department: 'ICT & Campus Systems', email: 'sysadmin@cb.amrita.edu', rollNumber: 'EMP.DIR.ICT001' },
]
