// Central vocabulary shared by the mock client, the Supabase client and every page.
// Keeping it in one file means the UI, the mock data layer and supabase/schema.sql
// all agree on the same role names, statuses and slot shape.

export const ROLES = {
  STUDENT: 'student',
  CLASS_REP: 'class_rep',
  FACULTY: 'faculty',
  FACILITY_INCHARGE: 'facility_incharge',
  ADMIN: 'admin',
}

export const ROLE_LABELS = {
  [ROLES.STUDENT]: 'Student',
  [ROLES.CLASS_REP]: 'Class Representative',
  [ROLES.FACULTY]: 'Faculty',
  [ROLES.FACILITY_INCHARGE]: 'Facility In-charge (Lab Staff)',
  [ROLES.ADMIN]: 'Event / Space Admin',
}

export const ROLE_DESCRIPTIONS = {
  [ROLES.STUDENT]: 'View classroom availability, browse events, book facilities after induction.',
  [ROLES.CLASS_REP]: 'Book free classroom slots for your section, first come first served.',
  [ROLES.FACULTY]: 'Book classrooms, submit event venue requests, approve student HPC jobs.',
  [ROLES.FACILITY_INCHARGE]: 'Run inductions, manage equipment, mark maintenance on facilities.',
  [ROLES.ADMIN]: 'Approve event venues, override classroom bookings, see the full dashboard.',
}

// Can this role book a classroom instantly (first-come-first-served)?
export const CAN_BOOK_CLASSROOM = new Set([ROLES.CLASS_REP, ROLES.FACULTY, ROLES.ADMIN])
// Can this role submit an event venue request?
export const CAN_REQUEST_EVENT = new Set([ROLES.FACULTY, ROLES.ADMIN])
// Can this role decide on event venue requests?
export const CAN_APPROVE_EVENT = new Set([ROLES.ADMIN])
// Can this role book facilities (after induction)?
export const CAN_BOOK_FACILITY = new Set([ROLES.STUDENT, ROLES.CLASS_REP, ROLES.FACULTY, ROLES.ADMIN])
// Can this role run inductions / manage equipment?
export const CAN_MANAGE_FACILITY = new Set([ROLES.FACILITY_INCHARGE, ROLES.ADMIN])
// Can this role approve large HPC jobs from their students?
export const CAN_APPROVE_HPC = new Set([ROLES.FACULTY, ROLES.ADMIN])

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// The Int. M.Sc Data Science 7th-sem timetable grid, imported as-is: 2 short morning
// slots, a tea break, 4 more slots with lunch worked in, then 2 afternoon slots.
export const DAY_SLOTS = [
  { id: 'slot2', label: 'Slot 2', start: '08:50', end: '09:40' },
  { id: 'slot3', label: 'Slot 3', start: '09:40', end: '10:30' },
  { id: 'break1', label: 'Break', start: '10:30', end: '10:45', nonBookable: true },
  { id: 'slot4', label: 'Slot 4', start: '10:45', end: '11:35' },
  { id: 'slot5', label: 'Slot 5', start: '11:35', end: '12:25' },
  { id: 'slot6', label: 'Slot 6', start: '12:25', end: '13:15' },
  { id: 'slot7', label: 'Lunch', start: '13:15', end: '14:05', nonBookable: true },
  { id: 'slot8', label: 'Slot 8', start: '14:05', end: '14:55' },
  { id: 'slot9', label: 'Slot 9', start: '14:55', end: '15:45' },
  { id: 'slot10', label: 'Slot 10', start: '15:45', end: '16:35' },
]

export const BOOKABLE_SLOTS = DAY_SLOTS.filter((s) => !s.nonBookable)

export const ROOM_TYPES = {
  CLASSROOM: 'classroom',
  EVENT_VENUE: 'event_venue',
}

export const BOOKING_STATUS = {
  BOOKED: 'booked',
  CHECKED_IN: 'checked_in',
  RELEASED: 'released',
  CANCELLED: 'cancelled',
}

export const EVENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
}

export const FACILITY_BOOKING_STATUS = {
  BOOKED: 'booked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export const HPC_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined',
}

export const MAINTENANCE_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
}

export const LOST_ITEM_STATUS = {
  UNCLAIMED: 'unclaimed',
  CLAIMED: 'claimed',
}

// Safeguard against hoarding: weekly cap on booked classroom hours per class rep.
export const WEEKLY_HOUR_CAP = {
  [ROLES.CLASS_REP]: 6,
  [ROLES.FACULTY]: 12,
}

// Room auto-released if nobody checks in within this many minutes of the start time.
export const CHECK_IN_GRACE_MINUTES = 15

export const EVENT_LEVELS = ['university', 'department', 'club']
export const EVENT_LEVEL_LABELS = {
  university: 'University-level',
  department: 'Department-level',
  club: 'Club-level',
}
