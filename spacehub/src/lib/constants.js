// Central vocabulary for CampusConnect: roles, permissions, time slots, and statuses.

export const ROLES = {
  CAMPUS_DIRECTOR: 'campus_director',
  DEAN: 'dean',
  HOD: 'hod',
  STUDENT: 'student',
  CLASS_REP: 'class_rep',
  CLASS_ADVISOR: 'class_advisor',
  FACULTY: 'faculty',
  HPC_FACULTY: 'hpc_faculty',
  LAB_ASSISTANT: 'lab_assistant',
  LAB_ADMIN: 'lab_admin',
  RESOURCE_ADMIN: 'resource_admin',
  LOST_PROPERTY_HANDLER: 'lost_property_handler',
  SYS_ADMIN: 'sys_admin',
  // Backward compatibility aliases
  FACILITY_INCHARGE: 'lab_assistant',
  ADMIN: 'resource_admin',
}

export const ROLE_LABELS = {
  [ROLES.CAMPUS_DIRECTOR]: 'Campus Director',
  [ROLES.DEAN]: 'Dean of School',
  [ROLES.HOD]: 'Head of Department (HOD)',
  [ROLES.STUDENT]: 'Student',
  [ROLES.CLASS_REP]: 'Class Representative',
  [ROLES.CLASS_ADVISOR]: 'Class Advisor',
  [ROLES.FACULTY]: 'Faculty Member',
  [ROLES.HPC_FACULTY]: 'HPC Faculty / HPC Manager',
  [ROLES.LAB_ASSISTANT]: 'Lab Assistant',
  [ROLES.LAB_ADMIN]: 'Lab Administrator',
  [ROLES.RESOURCE_ADMIN]: 'Central Resource Admin',
  [ROLES.LOST_PROPERTY_HANDLER]: 'Student Welfare (Lost Property)',
  [ROLES.SYS_ADMIN]: 'System Administrator',
}

export const ROLE_BADGE_COLORS = {
  [ROLES.CAMPUS_DIRECTOR]: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-400/20',
  [ROLES.DEAN]: 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-1 ring-indigo-400/20',
  [ROLES.HOD]: 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-400/20',
  [ROLES.STUDENT]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [ROLES.CLASS_REP]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  [ROLES.CLASS_ADVISOR]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [ROLES.FACULTY]: 'bg-blue-50 text-blue-700 border-blue-200',
  [ROLES.HPC_FACULTY]: 'bg-violet-50 text-violet-700 border-violet-200',
  [ROLES.LAB_ASSISTANT]: 'bg-amber-50 text-amber-700 border-amber-200',
  [ROLES.LAB_ADMIN]: 'bg-orange-50 text-orange-700 border-orange-200',
  [ROLES.RESOURCE_ADMIN]: 'bg-purple-50 text-purple-700 border-purple-200',
  [ROLES.LOST_PROPERTY_HANDLER]: 'bg-teal-50 text-teal-700 border-teal-200',
  [ROLES.SYS_ADMIN]: 'bg-slate-50 text-slate-700 border-slate-200',
}

export const ROLE_DESCRIPTIONS = {
  [ROLES.CAMPUS_DIRECTOR]: 'Institution-wide final approval authority for event requests and campus resource bookings. Full timetable visibility.',
  [ROLES.DEAN]: 'Authorized school/deanery scope oversight, review department event requests, submit recommendations, view faculty timetables.',
  [ROLES.HOD]: 'Full departmental scope: all department classes, batches, and faculty schedules. Review and recommend department bookings.',
  [ROLES.STUDENT]: 'View registered class timetable, browse approved public events, report lost items, request eligible labs.',
  [ROLES.CLASS_REP]: 'Book free classroom slots for registered section, submit class reschedule proposals, view teaching faculty schedules.',
  [ROLES.CLASS_ADVISOR]: 'Manage assigned classes, review & approve timetable reschedule proposals, review event requests.',
  [ROLES.FACULTY]: 'Manage teaching schedule, view complete timetable for taught classes, submit event venue requests.',
  [ROLES.HPC_FACULTY]: 'Administer dedicated HPC supercomputing cluster, node health, allocation requests and maintenance.',
  [ROLES.LAB_ASSISTANT]: 'Manage assigned equipment, toggle maintenance, process lab slots, update custody.',
  [ROLES.LAB_ADMIN]: 'Configure lab policies, oversee lab assistants, grant safety inductions, review utilization.',
  [ROLES.RESOURCE_ADMIN]: 'Review and triage event venue requests with priority score, provide alternatives, view campus-wide analytics.',
  [ROLES.LOST_PROPERTY_HANDLER]: 'Receive campus lost-item reports, verify claims, record custody handovers and returns.',
  [ROLES.SYS_ADMIN]: 'Manage system configuration, security audit logs, E-Governance integration adapter.',
}

// Permissions
// Class reps, faculty and class advisors all book teaching space directly.
export const CAN_BOOK_CLASSROOM = new Set([
  ROLES.CLASS_REP, ROLES.FACULTY, ROLES.CLASS_ADVISOR, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

// Anyone who can book can also queue for a slot someone else is holding.
export const CAN_JOIN_ROOM_WAITLIST = CAN_BOOK_CLASSROOM

export const WAITLIST_STATUS = {
  WAITING: 'waiting',
  PROMOTED: 'promoted',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
}

export const CAN_REQUEST_TIMETABLE_CHANGE = new Set([
  ROLES.CLASS_REP, ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_APPROVE_TIMETABLE_CHANGE = new Set([
  ROLES.CLASS_ADVISOR, ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_REQUEST_EVENT = new Set([
  ROLES.CAMPUS_DIRECTOR, ROLES.DEAN, ROLES.HOD, ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

// CRITICAL RULE: Campus Director is the final approval authority for event requests and bookings
export const CAN_APPROVE_EVENT = new Set([
  ROLES.CAMPUS_DIRECTOR
])

export const CAN_RECOMMEND_EVENT = new Set([
  ROLES.DEAN, ROLES.HOD, ROLES.CLASS_ADVISOR, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_REVIEW_EVENT = new Set([
  ROLES.CAMPUS_DIRECTOR, ROLES.DEAN, ROLES.HOD, ROLES.CLASS_ADVISOR, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_BOOK_FACILITY = new Set([
  ROLES.STUDENT, ROLES.CLASS_REP, ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_MANAGE_FACILITY = new Set([
  ROLES.LAB_ASSISTANT, ROLES.LAB_ADMIN, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'facility_incharge', 'admin'
])

// ---------------------------------------------------- facility access flow
// Every role can raise a facility access request — the Facilities section is
// available campus-wide, only the routing differs by who is asking.
export const CAN_REQUEST_FACILITY = new Set([
  ROLES.STUDENT, ROLES.CLASS_REP, ROLES.CLASS_ADVISOR, ROLES.FACULTY, ROLES.HPC_FACULTY,
  ROLES.LAB_ASSISTANT, ROLES.LAB_ADMIN, ROLES.RESOURCE_ADMIN, ROLES.LOST_PROPERTY_HANDLER,
  ROLES.SYS_ADMIN, 'facility_incharge', 'admin',
])

// Student-side roles must name a faculty mentor who endorses the request
// before it ever reaches lab staff. Staff roles skip straight to the lab.
export const NEEDS_FACULTY_ENDORSEMENT = new Set([ROLES.STUDENT, ROLES.CLASS_REP])

// Who may be picked as the endorsing mentor on a student request.
export const CAN_BE_FACULTY_MENTOR = new Set([ROLES.FACULTY, ROLES.CLASS_ADVISOR, ROLES.HPC_FACULTY])

// Who sees the "awaiting my endorsement" queue at all (narrowed per-request
// to the named mentor; admins see everything as an oversight override).
export const CAN_ENDORSE_FACILITY_REQUEST = new Set([
  ROLES.FACULTY, ROLES.CLASS_ADVISOR, ROLES.HPC_FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin',
])

// Lab personnel who give the final allocation decision against availability.
export const CAN_REVIEW_LAB_REQUEST = new Set([
  ROLES.LAB_ASSISTANT, ROLES.LAB_ADMIN, ROLES.HPC_FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN,
  'facility_incharge', 'admin',
])

// Submitted -> [Faculty endorsement ->] Lab review -> Approved / Rejected,
// with "alternative slot offered" as a holding state the requester answers.
export const FACILITY_REQUEST_STATUS = {
  PENDING_FACULTY: 'pending_faculty',
  PENDING_LAB: 'pending_lab',
  ALTERNATIVE_OFFERED: 'alternative_offered',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

export const FACILITY_REQUEST_STATUS_LABELS = {
  pending_faculty: 'Faculty endorsement pending',
  pending_lab: 'Lab review pending',
  alternative_offered: 'Alternative slot offered',
  approved: 'Approved — slot allocated',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const FACILITY_REQUEST_STATUS_TONES = {
  pending_faculty: 'amber',
  pending_lab: 'blue',
  alternative_offered: 'purple',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
}

// "Level of request" decides WHICH lab person reviews it: routine usage goes
// to the Lab Assistant on duty, anything elevated escalates to the Lab
// Administrator. See src/lib/facilityRouting.js for the rules.
export const FACILITY_REQUEST_LEVEL = {
  ROUTINE: 'routine',
  ELEVATED: 'elevated',
}

export const FACILITY_REQUEST_LEVEL_LABELS = {
  routine: 'Routine',
  elevated: 'Elevated',
}

export const CAN_APPROVE_HPC = new Set([
  ROLES.HPC_FACULTY, ROLES.FACULTY, ROLES.LAB_ADMIN, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const PERMISSIONS = {
  EVENT_VIEW: 'event.view',
  EVENT_REQUEST_CREATE: 'event.request.create',
  EVENT_REQUEST_VIEW_OWN: 'event.request.view_own',
  EVENT_REQUEST_REVIEW: 'event.request.review',
  EVENT_REQUEST_APPROVE: 'event.request.approve',
  EVENT_REQUEST_REJECT: 'event.request.reject',
  EVENT_VENUE_MANAGE: 'event.venue.manage',
  EVENT_PUBLISH: 'event.publish',
}

export const CAN_PROCESS_LOST_FOUND_CLAIMS = new Set([
  ROLES.CLASS_ADVISOR, ROLES.FACULTY, ROLES.LOST_PROPERTY_HANDLER, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_VIEW_AUDIT_LOGS = new Set([
  ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

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

export const TIMETABLE_CHANGE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MODIFICATION_REQUESTED: 'modification_requested',
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
  AVAILABLE: 'available',
  MAINTENANCE: 'maintenance',
  OFFLINE: 'offline',
}

export const LOST_ITEM_STATUS = {
  REPORTED: 'reported',
  IN_CUSTODY: 'in_custody',
  CLAIM_PENDING: 'claim_pending',
  RETURNED: 'returned',
  UNCLAIMED: 'unclaimed',
  CLOSED: 'closed',
}

export const WEEKLY_HOUR_CAP = {
  [ROLES.CLASS_REP]: 6,
  [ROLES.FACULTY]: 12,
}

export const CHECK_IN_GRACE_MINUTES = 15

export const EVENT_LEVELS = ['university', 'department', 'club']
export const EVENT_LEVEL_LABELS = {
  university: 'University-level',
  department: 'Department-level',
  club: 'Club-level',
}
