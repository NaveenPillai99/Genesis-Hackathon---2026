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
  [ROLES.STUDENT]: 'View classroom availability, browse events, request facility access.',
  [ROLES.CLASS_REP]: 'Book free classroom slots for your section, first come first served.',
  [ROLES.FACULTY]: 'Book classrooms, submit event venue requests, approve student facility requests.',
  [ROLES.FACILITY_INCHARGE]: 'Give final approval on facility access requests, manage equipment, mark maintenance.',
  [ROLES.ADMIN]: 'Approve event venues, override classroom bookings, see the full dashboard.',
}

// Can this role book a classroom instantly (first-come-first-served)?
export const CAN_BOOK_CLASSROOM = new Set([ROLES.CLASS_REP, ROLES.FACULTY, ROLES.ADMIN])
// Can this role submit an event venue request?
export const CAN_REQUEST_EVENT = new Set([ROLES.FACULTY, ROLES.ADMIN])
// Can this role decide on event venue requests?
export const CAN_APPROVE_EVENT = new Set([ROLES.ADMIN])
// Can this role request facility access?
export const CAN_REQUEST_FACILITY = new Set([ROLES.STUDENT, ROLES.CLASS_REP, ROLES.FACULTY, ROLES.ADMIN])
// Whose requests need faculty-mentor approval first? Everyone else (faculty,
// admin) skips straight to facility admin review — they don't need their
// own sign-off.
export const NEEDS_FACILITY_MENTOR = new Set([ROLES.STUDENT, ROLES.CLASS_REP])
// Who can be picked as the faculty mentor who gives first approval?
export const CAN_BE_FACILITY_MENTOR = new Set([ROLES.FACULTY])
// Can this role see/decide the mentor-approval queue (narrowed to their own
// assigned requests in the UI — admin sees all, as an oversight override)?
export const CAN_APPROVE_FACILITY_MENTOR_STAGE = new Set([ROLES.FACULTY, ROLES.ADMIN])
// Can this role act as facility administrator — final approve/reject/
// suggest-alternative decision, plus manage equipment? Applies uniformly to
// every facility, HPC included — there's no separate HPC approval path.
export const CAN_MANAGE_FACILITY = new Set([ROLES.FACILITY_INCHARGE, ROLES.ADMIN])

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

// Submitted -> [Faculty Approval Pending ->] Facility Admin Review ->
// Approved / Rejected / Alternative Suggested. Student/class-rep requests
// start at pending_mentor; faculty/admin requests start at pending_facility
// directly (see NEEDS_FACILITY_MENTOR). An alternative-time suggestion is
// itself a holding state — the requester accepts (-> approved) or declines
// (-> declined) it.
export const FACILITY_REQUEST_STATUS = {
  PENDING_MENTOR: 'pending_mentor',
  PENDING_FACILITY: 'pending_facility',
  ALTERNATIVE_SUGGESTED: 'alternative_suggested',
  APPROVED: 'approved',
  DECLINED: 'declined',
}

export const FACILITY_REQUEST_STATUS_LABELS = {
  pending_mentor: 'Faculty approval pending',
  pending_facility: 'Facility admin review',
  alternative_suggested: 'Alternative time suggested',
  approved: 'Approved',
  declined: 'Rejected',
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
