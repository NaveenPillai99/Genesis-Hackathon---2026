// Central vocabulary for CampusConnect: roles, permissions, time slots, and statuses.

export const ROLES = {
  STUDENT: 'student',
  CLASS_REP: 'class_rep',
  CLASS_ADVISOR: 'class_advisor',
  FACULTY: 'faculty',
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
  [ROLES.STUDENT]: 'Student',
  [ROLES.CLASS_REP]: 'Class Representative',
  [ROLES.CLASS_ADVISOR]: 'Class Advisor',
  [ROLES.FACULTY]: 'Faculty Member',
  [ROLES.LAB_ASSISTANT]: 'Lab Assistant',
  [ROLES.LAB_ADMIN]: 'Lab Administrator',
  [ROLES.RESOURCE_ADMIN]: 'Central Resource Admin',
  [ROLES.LOST_PROPERTY_HANDLER]: 'Student Welfare (Lost Property)',
  [ROLES.SYS_ADMIN]: 'System Administrator',
}

export const ROLE_BADGE_COLORS = {
  [ROLES.STUDENT]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [ROLES.CLASS_REP]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  [ROLES.CLASS_ADVISOR]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [ROLES.FACULTY]: 'bg-blue-50 text-blue-700 border-blue-200',
  [ROLES.LAB_ASSISTANT]: 'bg-amber-50 text-amber-700 border-amber-200',
  [ROLES.LAB_ADMIN]: 'bg-orange-50 text-orange-700 border-orange-200',
  [ROLES.RESOURCE_ADMIN]: 'bg-purple-50 text-purple-700 border-purple-200',
  [ROLES.LOST_PROPERTY_HANDLER]: 'bg-teal-50 text-teal-700 border-teal-200',
  [ROLES.SYS_ADMIN]: 'bg-rose-50 text-rose-700 border-rose-200',
}

export const ROLE_DESCRIPTIONS = {
  [ROLES.STUDENT]: 'View classroom availability, browse approved events, report lost items, request eligible labs.',
  [ROLES.CLASS_REP]: 'Book free classroom slots for your section, submit class prepone/postpone reschedule proposals.',
  [ROLES.CLASS_ADVISOR]: 'Manage assigned classes, review & approve timetable reschedule proposals, handle classroom lost items.',
  [ROLES.FACULTY]: 'Manage teaching schedule, submit event venues, review timetable changes, approve student HPC jobs.',
  [ROLES.LAB_ASSISTANT]: 'Manage assigned equipment, toggle maintenance, process lab slots, update custody.',
  [ROLES.LAB_ADMIN]: 'Configure lab policies, oversee lab assistants, grant safety inductions, review utilization.',
  [ROLES.RESOURCE_ADMIN]: 'Review event venue requests with priority score, override conflicts, view campus-wide analytics.',
  [ROLES.LOST_PROPERTY_HANDLER]: 'Receive campus lost-item reports, verify claims, record custody handovers and returns.',
  [ROLES.SYS_ADMIN]: 'Manage system configuration, security audit logs, E-Governance integration adapter.',
}

// Permissions
export const CAN_BOOK_CLASSROOM = new Set([
  ROLES.CLASS_REP, ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_REQUEST_TIMETABLE_CHANGE = new Set([
  ROLES.CLASS_REP, ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_APPROVE_TIMETABLE_CHANGE = new Set([
  ROLES.CLASS_ADVISOR, ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_REQUEST_EVENT = new Set([
  ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_APPROVE_EVENT = new Set([
  ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_BOOK_FACILITY = new Set([
  ROLES.STUDENT, ROLES.CLASS_REP, ROLES.FACULTY, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_MANAGE_FACILITY = new Set([
  ROLES.LAB_ASSISTANT, ROLES.LAB_ADMIN, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'facility_incharge', 'admin'
])

export const CAN_APPROVE_HPC = new Set([
  ROLES.FACULTY, ROLES.LAB_ADMIN, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
])

export const CAN_PROCESS_LOST_FOUND_CLAIMS = new Set([
  ROLES.CLASS_ADVISOR, ROLES.LOST_PROPERTY_HANDLER, ROLES.RESOURCE_ADMIN, ROLES.SYS_ADMIN, 'admin'
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
