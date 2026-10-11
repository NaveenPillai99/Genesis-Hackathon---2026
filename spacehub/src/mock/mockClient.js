// In-browser backend used when no Supabase project is configured (see
// src/lib/dataClient.js). Everything here mirrors a function one-for-one in
// src/lib/supabaseClient.js and the tables in supabase/schema.sql, so swapping
// backends later does not change a single page component.
//
// Persistence: one JSON blob in localStorage. Good enough for a single-browser
// pilot/demo; NOT shared across devices (that's exactly what the real
// Postgres backend is for).

import { newId } from '../lib/idgen'
import { emitDataChanged } from '../lib/bus'
import {
  BOOKING_STATUS,
  BOOKABLE_SLOTS,
  DAY_SLOTS,
  CHECK_IN_GRACE_MINUTES,
  EVENT_STATUS,
  FACILITY_BOOKING_STATUS,
  HPC_STATUS,
  LOST_ITEM_STATUS,
  MAINTENANCE_STATUS,
  ROOM_TYPES,
  WEEKLY_HOUR_CAP,
} from '../lib/constants'
import {
  toMinutes,
  overlaps,
  todayISO,
  weekdayForISO,
  weekStartISO,
  durationHours,
} from '../lib/time'
import { computePriorityScore } from '../lib/priorityScore'
import {
  SEED_ROOMS,
  SEED_TIMETABLE,
  SEED_FACILITIES,
  SEED_PROFILES,
  COURSE_LEGEND,
} from './seedData'

const STORAGE_KEY = 'spacehub_db_v1'
const HPC_AUTO_APPROVE_THRESHOLD = 20 // node-hours; above this needs faculty approval
const RECENT_BOOKER_WINDOW_DAYS = 3

// ---------------------------------------------------------------- bootstrap

function buildSeedTimetableSlots() {
  return SEED_TIMETABLE.map((entry) => {
    const slot = DAY_SLOTS.find((s) => s.id === entry.slot)
    const course = entry.code ? COURSE_LEGEND[entry.code] : null
    return {
      id: newId('tt'),
      roomId: entry.room,
      day: entry.day,
      slotId: entry.slot,
      start: slot.start,
      end: slot.end,
      code: entry.code,
      courseName: course?.name ?? entry.label ?? 'Reserved',
      faculty: course?.faculty ?? null,
    }
  })
}

export const SEED_EVENTS = [
  {
    id: 'evt-seed-1',
    name: 'National AI & Robotics Symposium 2026',
    title: 'National AI & Robotics Symposium 2026',
    description: 'Flagship inter-university symposium featuring IEEE keynote speakers, student robotics demonstrations, and research paper presentations across 14 universities.',
    venueRoomId: 'venue-auditorium',
    venue_id: 'venue-auditorium',
    requestedBy: 'Dr Prema Nedungadi',
    organizer: 'Dr Prema Nedungadi',
    department: 'Computer Science & Engineering',
    date: '2026-10-18',
    event_date: '2026-10-18',
    start: '09:00',
    start_slot: '09:00',
    end: '17:00',
    end_slot: '17:00',
    audienceSize: 850,
    expected_audience: 850,
    eventLevel: 'national',
    event_level: 'national',
    academic: true,
    externalGuests: true,
    status: 'awaiting_director_approval',
    priority: 1,
    priorityLabel: 'High',
    priorityScore: 88,
    combined_priority_score: 88,
    rawScore: 86.4,
    scoreBreakdown: {
      eventLevelFactor: 25,
      academicBonus: 20,
      audienceFit: 25,
      leadTimeScore: 18,
    },
    departmentRecommendation: 'RECOMMENDED',
    department_recommendation: 'RECOMMENDED',
    departmentReviewerName: 'Dr Prema N (HOD CSE)',
    department_reviewer_name: 'Dr Prema N (HOD CSE)',
    departmentReviewNotes: 'Endorsed by CSE Department Council and Deanery. Significant NAAC & NIRF research impact.',
    department_review_notes: 'Endorsed by CSE Department Council and Deanery. Significant NAAC & NIRF research impact.',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'evt-seed-2',
    name: 'International EV & Clean Mobility Research Summit',
    title: 'International EV & Clean Mobility Research Summit',
    description: 'Joint research forum with Automotive Research Association and international university partners.',
    venueRoomId: 'venue-seminar-ab1',
    venue_id: 'venue-seminar-ab1',
    requestedBy: 'Prof. Shankar Nair',
    organizer: 'Prof. Shankar Nair',
    department: 'Deanery of Engineering',
    date: '2026-10-20',
    event_date: '2026-10-20',
    start: '10:00',
    start_slot: '10:00',
    end: '16:30',
    end_slot: '16:30',
    audienceSize: 140,
    expected_audience: 140,
    eventLevel: 'international',
    event_level: 'international',
    academic: true,
    externalGuests: true,
    status: 'awaiting_director_approval',
    priority: 1,
    priorityLabel: 'High',
    priorityScore: 92,
    combined_priority_score: 92,
    rawScore: 91.5,
    scoreBreakdown: {
      eventLevelFactor: 30,
      academicBonus: 20,
      audienceFit: 24,
      leadTimeScore: 18,
    },
    departmentRecommendation: 'RECOMMENDED',
    department_recommendation: 'RECOMMENDED',
    departmentReviewerName: 'Prof. Shankar Nair (Dean of Engineering)',
    department_reviewer_name: 'Prof. Shankar Nair (Dean of Engineering)',
    departmentReviewNotes: 'Flagship university research initiative with external delegates from 6 countries.',
    department_review_notes: 'Flagship university research initiative with external delegates from 6 countries.',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'evt-seed-3',
    name: 'Intra-College Coding Marathon (ACM Chapter)',
    title: 'Intra-College Coding Marathon (ACM Chapter)',
    description: 'Annual student hackathon and algorithmic challenge for second and third year B.Tech students.',
    venueRoomId: 'venue-seminar-ab1',
    venue_id: 'venue-seminar-ab1',
    requestedBy: 'Devika Nair (Student ACM Chair)',
    organizer: 'Devika Nair (Student ACM Chair)',
    department: 'Computer Science & Engineering',
    date: '2026-10-20',
    event_date: '2026-10-20',
    start: '09:30',
    start_slot: '09:30',
    end: '17:00',
    end_slot: '17:00',
    audienceSize: 80,
    expected_audience: 80,
    eventLevel: 'department',
    event_level: 'department',
    academic: false,
    externalGuests: false,
    status: 'pending',
    priority: 0,
    priorityLabel: 'Normal',
    priorityScore: 42,
    combined_priority_score: 42,
    rawScore: 41.0,
    scoreBreakdown: {
      eventLevelFactor: 10,
      academicBonus: 5,
      audienceFit: 15,
      leadTimeScore: 12,
    },
    departmentRecommendation: null,
    department_recommendation: null,
    departmentReviewerName: null,
    department_reviewer_name: null,
    departmentReviewNotes: null,
    department_review_notes: null,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'evt-seed-4',
    name: 'Faculty Quantum Computing & Cryptography Workshop',
    title: 'Faculty Quantum Computing & Cryptography Workshop',
    description: '3-day hands-on faculty development workshop on Qiskit and Post-Quantum Cryptography.',
    venueRoomId: 'room-ab1-e104',
    venue_id: 'room-ab1-e104',
    requestedBy: 'Dr Thilaga M (Associate Professor)',
    organizer: 'Dr Thilaga M (Associate Professor)',
    department: 'Computer Science & Engineering',
    date: '2026-10-24',
    event_date: '2026-10-24',
    start: '09:00',
    start_slot: '09:00',
    end: '16:00',
    end_slot: '16:00',
    audienceSize: 45,
    expected_audience: 45,
    eventLevel: 'regional',
    event_level: 'regional',
    academic: true,
    externalGuests: false,
    status: 'pending',
    priority: 1,
    priorityLabel: 'High',
    priorityScore: 74,
    combined_priority_score: 74,
    rawScore: 72.0,
    scoreBreakdown: {
      eventLevelFactor: 20,
      academicBonus: 20,
      audienceFit: 18,
      leadTimeScore: 16,
    },
    departmentRecommendation: null,
    department_recommendation: null,
    departmentReviewerName: null,
    department_reviewer_name: null,
    departmentReviewNotes: null,
    department_review_notes: null,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'evt-seed-5',
    name: 'Chancellor Amritavarsham Distinguished Keynote',
    title: 'Chancellor Amritavarsham Distinguished Keynote',
    description: 'Inaugural university keynote address by visiting Nobel Laureate in Computational Sciences.',
    venueRoomId: 'venue-auditorium',
    venue_id: 'venue-auditorium',
    requestedBy: 'Office of the Vice Chancellor',
    organizer: 'Office of the Vice Chancellor',
    department: 'University Administration',
    date: '2026-10-12',
    event_date: '2026-10-12',
    start: '10:00',
    start_slot: '10:00',
    end: '13:00',
    end_slot: '13:00',
    audienceSize: 1100,
    expected_audience: 1100,
    eventLevel: 'international',
    event_level: 'international',
    academic: true,
    externalGuests: true,
    status: 'approved',
    priority: 1,
    priorityLabel: 'High',
    priorityScore: 98,
    combined_priority_score: 98,
    departmentRecommendation: 'RECOMMENDED',
    department_recommendation: 'RECOMMENDED',
    departmentReviewerName: 'Campus Director',
    department_reviewer_name: 'Campus Director',
    departmentReviewNotes: 'Institutional keynote cleared with highest university priority.',
    department_review_notes: 'Institutional keynote cleared with highest university priority.',
    decidedBy: 'user-director-1',
    decidedAt: new Date().toISOString(),
    adminReason: 'Chancellor institutional keynote cleared by Campus Director.',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
]

export const SEED_CHANGE_REQUESTS = [
  {
    id: 'tt-req-001',
    courseCode: '22CSC401',
    courseName: 'Deep Learning',
    classSection: 'Int. M.Sc Data Science, VII B',
    requesterId: 'user-classrep-1',
    requesterName: 'Devika Nair',
    originalDay: 'Friday',
    originalSlot: 'slot2',
    originalRoomId: 'room-ab1-e104',
    proposedDay: 'Thursday',
    proposedSlot: 'slot4',
    proposedRoomId: 'room-ab1-e104',
    proposedDate: '2026-10-15',
    reason: 'Students participating in Inter-University Hackathon on Friday morning. Requesting reschedule to Thursday Slot 4.',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tt-req-002',
    courseCode: '22CSC404',
    courseName: 'Data Security',
    classSection: 'Int. M.Sc Data Science, VII B',
    requesterId: 'user-classrep-1',
    requesterName: 'Devika Nair',
    originalDay: 'Thursday',
    originalSlot: 'slot8',
    originalRoomId: 'room-ab1-e103b',
    proposedDay: 'Tuesday',
    proposedSlot: 'slot2',
    proposedRoomId: 'room-ab1-e103b',
    proposedDate: '2026-10-22',
    reason: 'Guest lecture by Industry Cyber Defense Specialist scheduled during Tuesday morning slot.',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
]

function freshDb() {
  return {
    profiles: SEED_PROFILES,
    rooms: SEED_ROOMS,
    timetableSlots: buildSeedTimetableSlots(),
    timetableChangeRequests: [...SEED_CHANGE_REQUESTS],
    roomBookings: [],
    blockedDates: [],
    events: [...SEED_EVENTS],
    facilities: SEED_FACILITIES.map((f) => ({ ...f, underMaintenance: false })),
    facilityBookings: [],
    inductions: [],
    hpcAllocations: [],
    lostItems: [
      {
        id: 'lf-001',
        reportType: 'found',
        title: 'Casio Scientific Calculator FX-991CW',
        category: 'electronics',
        description: 'Black non-programmable calculator found on the 2nd row desk near the window.',
        locationFound: 'AB1 E-104 (1st Floor)',
        isClassroom: true,
        roomId: 'room-ab1-e104',
        foundDate: '2026-10-09',
        foundTime: '09:40',
        finderName: 'Aarav Menon',
        finderId: 'user-student-1',
        currentCustody: 'class_advisor',
        storageLocation: 'Class Advisor Office (Mathematics Dept, AB1 Room 214)',
        assignedHandlerName: 'Dr Devika',
        assignedHandlerId: 'user-classadvisor-1',
        routingReason: 'Classroom Timetable Match: Deep Learning (Int. M.Sc Data Science VII B). Auto-routed to Class Advisor Dr Devika.',
        status: 'in_custody',
        claims: [],
        custodyLogs: [
          {
            id: 'log-1',
            action: 'reported',
            actorName: 'Aarav Menon',
            fromCustodian: 'Finder',
            toCustodian: 'Dr Devika',
            timestamp: new Date().toISOString(),
          },
        ],
        reportedAt: new Date().toISOString(),
      },
      {
        id: 'lf-002',
        reportType: 'found',
        title: 'Navy Blue Campus Backpack (Wildcraft)',
        category: 'bags',
        description: 'Wildcraft navy blue backpack with a water bottle and notebooks inside.',
        locationFound: 'AB2 Central Lawn benches',
        isClassroom: false,
        roomId: null,
        foundDate: '2026-10-10',
        foundTime: '13:20',
        finderName: 'Aarav Menon',
        finderId: 'user-student-1',
        currentCustody: 'student_welfare',
        storageLocation: 'Student Welfare Lost Property Locker #4',
        assignedHandlerName: 'Ms Priya Balan',
        assignedHandlerId: 'user-welfare-1',
        routingReason: 'Outdoor Campus Area: Auto-routed to Student Welfare Office.',
        status: 'claim_pending',
        claims: [
          {
            id: 'claim-001',
            claimantId: 'user-classrep-1',
            claimantName: 'Devika Nair',
            proofDescription: 'Contains Data Science notebooks with student name Devika N on page 1.',
            contactPhone: '+91 98765 43210',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
        custodyLogs: [
          {
            id: 'log-2',
            action: 'claim_filed',
            actorName: 'Ms Priya Balan',
            fromCustodian: 'Student Welfare',
            toCustodian: 'Student Welfare',
            timestamp: new Date().toISOString(),
          },
        ],
        reportedAt: new Date().toISOString(),
      },
    ],
    notifications: [
      {
        id: 'notif-1',
        recipientId: 'user-classrep-1',
        title: 'Classroom Booking Confirmed',
        message: 'Your reservation for AB1-E104 on Friday Slot 8 has been confirmed.',
        category: 'booking',
        link: '/classrooms',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        recipientId: 'user-classadvisor-1',
        title: 'Action Required: Lost Item Auto-Routed',
        message: 'A calculator found in AB1-E104 during your class slot was automatically routed to your custody.',
        category: 'lost_found',
        link: '/lost-found',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-3',
        recipientId: 'user-classadvisor-1',
        title: 'Timetable Change Request Pending',
        message: 'Class Rep Devika Nair requested to move Deep Learning from Friday Slot 2 to Thursday Slot 4.',
        category: 'timetable',
        link: '/academic-scheduling',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ],
    auditLogs: [
      {
        id: 'aud-1',
        actorId: 'user-sysadmin-1',
        actorName: 'Prof. K. R. Ramakrishnan',
        actorRole: 'sys_admin',
        action: 'SYSTEM_BOOT',
        entityType: 'SYSTEM',
        entityId: 'ROOT',
        details: 'CampusConnect Pilot Initialized',
        timestamp: new Date().toISOString(),
      },
    ],
    maintenanceReports: [],
    hpcNodes: [
      {
        id: 'node-gpu-01',
        name: 'CCE-DGX-A100-01',
        clusterId: 'cce-hpc-cluster',
        status: 'busy',
        cpuCores: 64,
        memoryGb: 256,
        gpuCount: 4,
        gpuModel: 'NVIDIA A100 80GB',
        cpuUtilizationPct: 78.2,
        memoryUtilizationPct: 64.0,
        gpuUtilizationPct: 92.5,
        activeJobs: 2,
        queuedJobs: 1,
        totalNodeHoursServed: 2450.0,
        lastHeartbeat: new Date().toISOString(),
        notes: 'Primary deep learning research node',
      },
      {
        id: 'node-gpu-02',
        name: 'CCE-DGX-A100-02',
        clusterId: 'cce-hpc-cluster',
        status: 'idle',
        cpuCores: 64,
        memoryGb: 256,
        gpuCount: 4,
        gpuModel: 'NVIDIA A100 80GB',
        cpuUtilizationPct: 14.5,
        memoryUtilizationPct: 22.0,
        gpuUtilizationPct: 5.0,
        activeJobs: 0,
        queuedJobs: 0,
        totalNodeHoursServed: 1890.0,
        lastHeartbeat: new Date().toISOString(),
        notes: 'Available for student thesis jobs',
      },
      {
        id: 'node-cpu-01',
        name: 'CCE-EPYC-Compute-01',
        clusterId: 'cce-hpc-cluster',
        status: 'busy',
        cpuCores: 128,
        memoryGb: 512,
        gpuCount: 0,
        gpuModel: 'None',
        cpuUtilizationPct: 88.4,
        memoryUtilizationPct: 72.0,
        gpuUtilizationPct: 0.0,
        activeJobs: 4,
        queuedJobs: 2,
        totalNodeHoursServed: 5600.0,
        lastHeartbeat: new Date().toISOString(),
        notes: 'Monte Carlo simulation partition',
      },
      {
        id: 'node-cpu-02',
        name: 'CCE-EPYC-Compute-02',
        clusterId: 'cce-hpc-cluster',
        status: 'maintenance',
        cpuCores: 128,
        memoryGb: 512,
        gpuCount: 0,
        gpuModel: 'None',
        cpuUtilizationPct: 0.0,
        memoryUtilizationPct: 0.0,
        gpuUtilizationPct: 0.0,
        activeJobs: 0,
        queuedJobs: 0,
        totalNodeHoursServed: 4100.0,
        lastHeartbeat: new Date().toISOString(),
        notes: 'Scheduled ECC RAM replacement by vendor support',
      },
    ],
    hpcJobs: [
      {
        id: 'job-01',
        allocationId: 'hpc-001',
        userId: 'user-student-1',
        userName: 'Aarav Menon',
        jobName: 'ResNet-50 Distributed Pretraining',
        nodeId: 'node-gpu-01',
        status: 'running',
        requestedNodes: 1,
        gpuRequested: 2,
        cpuHoursUsed: 14.2,
        startedAt: new Date().toISOString(),
      },
      {
        id: 'job-02',
        allocationId: 'hpc-002',
        userId: 'user-faculty-1',
        userName: 'Dr Thilaga M',
        jobName: 'Transformer Architecture Search',
        nodeId: 'node-gpu-01',
        status: 'running',
        requestedNodes: 1,
        gpuRequested: 2,
        cpuHoursUsed: 32.0,
        startedAt: new Date().toISOString(),
      },
    ],
    hpcIncidents: [
      {
        id: 'inc-01',
        nodeId: 'node-cpu-02',
        incidentType: 'scheduled_maintenance',
        severity: 'warning',
        reportedBy: 'Dr Radhika N',
        description: 'DIMM slot 4 ECC multi-bit error detected during routine diagnostic run. Replaced memory module pending burn-in validation.',
        status: 'open',
        createdAt: new Date().toISOString(),
      },
    ],
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const db = freshDb()
      save(db)
      return db
    }
    const parsed = JSON.parse(raw)
    // Synchronize SEED_PROFILES into parsed profiles to guarantee new accounts exist
    if (parsed && Array.isArray(parsed.profiles)) {
      let changed = false
      for (const sp of SEED_PROFILES) {
        const existingIdx = parsed.profiles.findIndex((p) => p.id === sp.id)
        if (existingIdx === -1) {
          parsed.profiles.push(sp)
          changed = true
        } else {
          if (parsed.profiles[existingIdx].role !== sp.role) {
            parsed.profiles[existingIdx] = { ...sp, ...parsed.profiles[existingIdx], role: sp.role }
            changed = true
          }
        }
      }
      if (changed) {
        save(parsed)
      }
    }
    // Synchronize SEED_EVENTS so pending approvals, recommendations and clashes are immediately available
    if (parsed) {
      if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
        parsed.events = [...SEED_EVENTS]
        save(parsed)
      } else {
        let evChanged = false
        for (const se of SEED_EVENTS) {
          if (!parsed.events.some((e) => e.id === se.id)) {
            parsed.events.push(se)
            evChanged = true
          }
        }
        if (evChanged) {
          save(parsed)
        }
      }
    }
    // Synchronize SEED_CHANGE_REQUESTS so timetable change proposals are immediately available
    if (parsed) {
      if (!Array.isArray(parsed.timetableChangeRequests) || parsed.timetableChangeRequests.length === 0) {
        parsed.timetableChangeRequests = [...SEED_CHANGE_REQUESTS]
        save(parsed)
      } else {
        let reqChanged = false
        for (const sr of SEED_CHANGE_REQUESTS) {
          if (!parsed.timetableChangeRequests.some((r) => r.id === sr.id)) {
            parsed.timetableChangeRequests.push(sr)
            reqChanged = true
          }
        }
        if (reqChanged) {
          save(parsed)
        }
      }
    }
    return parsed
  } catch (err) {
    console.error('spacehub: failed to load mock DB, reseeding', err)
    const db = freshDb()
    save(db)
    return db
  }
}

function save(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

let db = load()

function mutate(fn) {
  const result = fn(db)
  save(db)
  emitDataChanged()
  return result
}

export function resetDemoEvents() {
  return mutate((d) => {
    d.events = [...SEED_EVENTS]
    return d.events
  })
}

export function resetDemoChangeRequests() {
  return mutate((d) => {
    d.timetableChangeRequests = [...SEED_CHANGE_REQUESTS]
    return d.timetableChangeRequests
  })
}

export function resetMockDb() {
  db = freshDb()
  save(db)
  emitDataChanged()
}

// ------------------------------------------------------------- auto-release

/** Release any 'booked' classroom slot whose grace window has passed with no check-in. */
function sweepAutoRelease() {
  const now = new Date()
  const today = todayISO()
  let changed = false
  for (const b of db.roomBookings) {
    if (b.status !== BOOKING_STATUS.BOOKED) continue
    if (b.date !== today) continue
    const startDt = new Date(`${b.date}T${b.start}:00`)
    const graceEnd = new Date(startDt.getTime() + CHECK_IN_GRACE_MINUTES * 60000)
    if (now > graceEnd) {
      b.status = BOOKING_STATUS.RELEASED
      b.releasedAt = now.toISOString()
      changed = true
    }
  }
  if (changed) save(db)
  return changed
}

// -------------------------------------------------------------- profiles

export async function listProfiles() {
  return [...db.profiles]
}

export async function getProfile(id) {
  return db.profiles.find((p) => p.id === id) ?? null
}

// ------------------------------------------------------------------ rooms

export async function listRooms({ type } = {}) {
  return db.rooms.filter((r) => !type || r.type === type)
}

export async function getRoom(id) {
  return db.rooms.find((r) => r.id === id) ?? null
}

// ---------------------------------------------------------------- timetable

export async function listTimetableSlots({ roomId, day } = {}) {
  return db.timetableSlots.filter(
    (t) => (!roomId || t.roomId === roomId) && (!day || t.day === day)
  )
}

// -------------------------------------------------------- classroom booking

function roomHasOpenSeriousMaintenance(roomId) {
  return db.maintenanceReports.some(
    (m) =>
      m.targetType === 'room' &&
      m.targetId === roomId &&
      m.severity === 'serious' &&
      m.status !== MAINTENANCE_STATUS.RESOLVED
  )
}

function isDateBlocked(roomId, date) {
  return db.blockedDates.some((b) => b.roomId === roomId && b.date === date)
}

function activeBookingsFor(roomId, date) {
  return db.roomBookings.filter(
    (b) =>
      b.roomId === roomId &&
      b.date === date &&
      (b.status === BOOKING_STATUS.BOOKED || b.status === BOOKING_STATUS.CHECKED_IN)
  )
}

/** Availability board for one date across the given rooms. */
export async function getAvailability({ date, roomIds } = {}) {
  sweepAutoRelease()
  const day = weekdayForISO(date)
  const rooms = db.rooms.filter((r) => !roomIds || roomIds.includes(r.id))

  return rooms.map((room) => {
    const blocked = isDateBlocked(room.id, date)
    const underMaintenance = roomHasOpenSeriousMaintenance(room.id)
    const slots = BOOKABLE_SLOTS.map((slot) => {
      const timetable = db.timetableSlots.find(
        (t) => t.roomId === room.id && t.day === day && t.slotId === slot.id
      )
      if (blocked) {
        const block = db.blockedDates.find((b) => b.roomId === room.id && b.date === date)
        return { ...slot, status: 'blocked', reason: block?.reason }
      }
      if (underMaintenance) {
        return { ...slot, status: 'maintenance' }
      }
      if (timetable) {
        return { ...slot, status: 'timetable', timetable }
      }
      const booking = activeBookingsFor(room.id, date).find((b) => b.slotId === slot.id)
      if (booking) {
        return { ...slot, status: booking.status === BOOKING_STATUS.CHECKED_IN ? 'checked_in' : 'booked', booking }
      }
      return { ...slot, status: 'free' }
    })
    return { room, day, slots, blocked, underMaintenance }
  })
}

export async function getWeeklyBookedHours(userId, date) {
  const weekStart = weekStartISO(date)
  const weekEnd = new Date(`${weekStart}T00:00:00`)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return db.roomBookings
    .filter(
      (b) =>
        b.bookedBy === userId &&
        b.status !== BOOKING_STATUS.CANCELLED &&
        b.status !== BOOKING_STATUS.RELEASED &&
        b.date >= weekStart &&
        b.date < weekEnd.toISOString().slice(0, 10)
    )
    .reduce((sum, b) => sum + durationHours(b.start, b.end), 0)
}

export async function createRoomBooking({ roomId, date, slotId, userId, userRole, purpose }) {
  sweepAutoRelease()
  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) throw new Error('Room not found.')
  const slot = BOOKABLE_SLOTS.find((s) => s.id === slotId)
  if (!slot) throw new Error('Invalid time slot.')
  const day = weekdayForISO(date)
  if (!day) throw new Error('Classrooms can only be booked on weekdays.')

  if (isDateBlocked(roomId, date)) {
    const block = db.blockedDates.find((b) => b.roomId === roomId && b.date === date)
    throw new Error(`This room is blocked for ${date}${block?.reason ? `: ${block.reason}` : '.'}`)
  }
  if (roomHasOpenSeriousMaintenance(roomId)) {
    throw new Error('This room is under maintenance and cannot be booked right now.')
  }
  const clashesTimetable = db.timetableSlots.some(
    (t) => t.roomId === roomId && t.day === day && t.slotId === slotId
  )
  if (clashesTimetable) throw new Error('That slot is already a timetabled class.')

  const clashesBooking = activeBookingsFor(roomId, date).some((b) => b.slotId === slotId)
  if (clashesBooking) throw new Error('That slot was just booked by someone else. Pick another.')

  const cap = WEEKLY_HOUR_CAP[userRole]
  if (cap) {
    const used = await getWeeklyBookedHours(userId, date)
    const thisHours = durationHours(slot.start, slot.end)
    if (used + thisHours > cap) {
      throw new Error(
        `Weekly booking cap reached (${used}/${cap} hrs used). This ${thisHours}-hr slot would go over the cap.`
      )
    }
  }

  const booking = {
    id: newId('bk'),
    roomId,
    date,
    slotId,
    start: slot.start,
    end: slot.end,
    bookedBy: userId,
    purpose: purpose?.trim() || 'Unspecified',
    status: BOOKING_STATUS.BOOKED,
    createdAt: new Date().toISOString(),
    checkedInAt: null,
    releasedAt: null,
  }
  return mutate((d) => {
    d.roomBookings.push(booking)
    return booking
  })
}

export async function cancelRoomBooking(id) {
  return mutate((d) => {
    const b = d.roomBookings.find((x) => x.id === id)
    if (!b) throw new Error('Booking not found.')
    b.status = BOOKING_STATUS.CANCELLED
    b.releasedAt = new Date().toISOString()
    return b
  })
}

export async function checkInBooking(id) {
  return mutate((d) => {
    const b = d.roomBookings.find((x) => x.id === id)
    if (!b) throw new Error('Booking not found.')
    if (b.status === BOOKING_STATUS.RELEASED) {
      throw new Error('This booking was already auto-released for not checking in on time.')
    }
    b.status = BOOKING_STATUS.CHECKED_IN
    b.checkedInAt = new Date().toISOString()
    return b
  })
}

export async function listMyRoomBookings(userId) {
  sweepAutoRelease()
  return db.roomBookings
    .filter((b) => b.bookedBy === userId)
    .sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1))
}

export async function listRoomBookingsForRoom(roomId, { fromDate } = {}) {
  return db.roomBookings.filter((b) => b.roomId === roomId && (!fromDate || b.date >= fromDate))
}

// ---------------------------------------------------------- admin overrides

export async function blockRoomDate({ roomId, date, reason, byUserId }) {
  return mutate((d) => {
    const block = {
      id: newId('blk'),
      roomId,
      date,
      reason: reason?.trim() || 'Blocked by admin',
      createdBy: byUserId,
      createdAt: new Date().toISOString(),
    }
    d.blockedDates.push(block)
    // Cancel any existing bookings that now clash
    d.roomBookings
      .filter((b) => b.roomId === roomId && b.date === date && b.status === BOOKING_STATUS.BOOKED)
      .forEach((b) => {
        b.status = BOOKING_STATUS.CANCELLED
        b.releasedAt = new Date().toISOString()
      })
    return block
  })
}

export async function unblockRoomDate(blockId) {
  return mutate((d) => {
    d.blockedDates = d.blockedDates.filter((b) => b.id !== blockId)
  })
}

export async function listBlockedDates() {
  return [...db.blockedDates]
}

export async function adminCancelBooking(id, reason) {
  return mutate((d) => {
    const b = d.roomBookings.find((x) => x.id === id)
    if (!b) throw new Error('Booking not found.')
    b.status = BOOKING_STATUS.CANCELLED
    b.releasedAt = new Date().toISOString()
    b.adminOverrideReason = reason
    return b
  })
}

// --------------------------------------------------------------- facilities

export async function listFacilities() {
  return [...db.facilities]
}

export async function getFacility(id) {
  return db.facilities.find((f) => f.id === id) ?? null
}

export async function setFacilityMaintenance(id, underMaintenance) {
  return mutate((d) => {
    const f = d.facilities.find((x) => x.id === id)
    if (!f) throw new Error('Facility not found.')
    f.underMaintenance = underMaintenance
    return f
  })
}

export async function hasInduction(userId, facilityId) {
  return db.inductions.some((i) => i.userId === userId && i.facilityId === facilityId)
}

export async function listInductions({ userId, facilityId } = {}) {
  return db.inductions.filter(
    (i) => (!userId || i.userId === userId) && (!facilityId || i.facilityId === facilityId)
  )
}

export async function completeInduction({ userId, facilityId, byUserId }) {
  const already = await hasInduction(userId, facilityId)
  if (already) return db.inductions.find((i) => i.userId === userId && i.facilityId === facilityId)
  return mutate((d) => {
    const record = {
      id: newId('ind'),
      userId,
      facilityId,
      completedAt: new Date().toISOString(),
      byUserId,
    }
    d.inductions.push(record)
    return record
  })
}

export async function listFacilityBookings({ facilityId, date } = {}) {
  return db.facilityBookings.filter(
    (b) => (!facilityId || b.facilityId === facilityId) && (!date || b.date === date)
  )
}

export async function listMyFacilityBookings(userId) {
  return db.facilityBookings
    .filter((b) => b.userId === userId)
    .sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1))
}

export async function createFacilityBooking({ facilityId, userId, date, start, end, purpose }) {
  const facility = db.facilities.find((f) => f.id === facilityId)
  if (!facility) throw new Error('Facility not found.')
  if (facility.underMaintenance) throw new Error('This facility is currently under maintenance.')
  if (facility.inductionRequired) {
    const inducted = await hasInduction(userId, facilityId)
    if (!inducted) throw new Error('Complete the induction for this facility before booking it.')
  }
  const clash = db.facilityBookings.some(
    (b) =>
      b.facilityId === facilityId &&
      b.date === date &&
      b.status === FACILITY_BOOKING_STATUS.BOOKED &&
      overlaps(b.start, b.end, start, end)
  )
  if (clash) throw new Error('That time slot is already booked on this facility.')

  const booking = {
    id: newId('fbk'),
    facilityId,
    userId,
    date,
    start,
    end,
    purpose: purpose?.trim() || 'Unspecified',
    status: FACILITY_BOOKING_STATUS.BOOKED,
    createdAt: new Date().toISOString(),
  }
  return mutate((d) => {
    d.facilityBookings.push(booking)
    return booking
  })
}

export async function cancelFacilityBooking(id) {
  return mutate((d) => {
    const b = d.facilityBookings.find((x) => x.id === id)
    if (!b) throw new Error('Booking not found.')
    b.status = FACILITY_BOOKING_STATUS.CANCELLED
    return b
  })
}

// ------------------------------------------------------------------- HPC

export async function requestHpcAllocation({ studentId, facultyApproverId, nodeHoursRequested, purpose }) {
  const isLarge = nodeHoursRequested > HPC_AUTO_APPROVE_THRESHOLD
  const allocation = {
    id: newId('hpc'),
    studentId,
    facultyApproverId: facultyApproverId || null,
    nodeHoursRequested,
    purpose: purpose?.trim() || 'Unspecified',
    status: isLarge ? HPC_STATUS.PENDING : HPC_STATUS.APPROVED,
    autoApproved: !isLarge,
    createdAt: new Date().toISOString(),
    decidedAt: isLarge ? null : new Date().toISOString(),
  }
  if (isLarge && !facultyApproverId) {
    throw new Error(
      `Requests over ${HPC_AUTO_APPROVE_THRESHOLD} node-hours need a faculty supervisor to approve them.`
    )
  }
  return mutate((d) => {
    d.hpcAllocations.push(allocation)
    return allocation
  })
}

export async function decideHpcAllocation(id, { decision, byUserId, reason }) {
  return mutate((d) => {
    const a = d.hpcAllocations.find((x) => x.id === id)
    if (!a) throw new Error('Allocation request not found.')
    a.status = decision
    a.decidedAt = new Date().toISOString()
    a.decidedBy = byUserId
    a.decisionReason = reason
    return a
  })
}

export async function listHpcAllocations({ studentId, facultyApproverId, status } = {}) {
  return db.hpcAllocations.filter(
    (a) =>
      (!studentId || a.studentId === studentId) &&
      (!facultyApproverId || a.facultyApproverId === facultyApproverId) &&
      (!status || a.status === status)
  )
}

export const HPC_THRESHOLD = HPC_AUTO_APPROVE_THRESHOLD

// ------------------------------------------------------------------ events

function daysAheadFor(date) {
  const today = new Date(`${todayISO()}T00:00:00`)
  const target = new Date(`${date}T00:00:00`)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

export async function listEvents({ status } = {}) {
  return db.events
    .filter((e) => !status || e.status === status)
    .sort((a, b) => {
      const prioA = a.priority !== undefined ? a.priority : (a.priorityScore >= 50 ? 1 : 0)
      const prioB = b.priority !== undefined ? b.priority : (b.priorityScore >= 50 ? 1 : 0)
      if (prioB !== prioA) return prioB - prioA
      const timeA = new Date(a.createdAt || a.created_at || a.date || 0).getTime()
      const timeB = new Date(b.createdAt || b.created_at || b.date || 0).getTime()
      return timeA - timeB
    })
}


export async function listPublicEvents() {
  return (await listEvents({ status: EVENT_STATUS.APPROVED })).map((e) => ({ ...e }))
}

export async function getCompetingRequests(event) {
  return db.events.filter(
    (e) =>
      e.id !== event.id &&
      e.venueRoomId === event.venueRoomId &&
      e.date === event.date &&
      e.status === EVENT_STATUS.PENDING &&
      overlaps(e.start, e.end, event.start, event.end)
  )
}

export async function suggestAlternativeVenues({ date, start, end, excludeRoomId, audienceSize }) {
  const venues = db.rooms.filter((r) => r.type === ROOM_TYPES.EVENT_VENUE && r.id !== excludeRoomId)
  const free = []
  for (const venue of venues) {
    const blocked = isDateBlocked(venue.id, date)
    if (blocked) continue
    const clash = db.events.some(
      (e) =>
        e.venueRoomId === venue.id &&
        e.date === date &&
        e.status === EVENT_STATUS.APPROVED &&
        overlaps(e.start, e.end, start, end)
    )
    if (!clash && (!audienceSize || venue.capacity >= audienceSize)) {
      free.push(venue)
    }
  }
  return free
}

export async function createEventRequest({
  title,
  venueRoomId,
  requestedBy,
  date,
  start,
  end,
  audienceSize,
  eventLevel,
  academic,
  externalGuests,
  description,
}) {
  const room = db.rooms.find((r) => r.id === venueRoomId)
  if (!room) throw new Error('Venue not found.')
  const { priority, priorityLabel, rawScore, sigmoidConfidence, score, breakdown } = computePriorityScore({
    eventLevel,
    academic,
    audienceSize,
    roomCapacity: room.capacity,
    daysAhead: daysAheadFor(date),
    externalGuests,
  })
  const event = {
    id: newId('ev'),
    title: title?.trim() || 'Untitled event',
    description: description?.trim() || '',
    venueRoomId,
    requestedBy,
    date,
    start,
    end,
    audienceSize,
    eventLevel,
    academic,
    externalGuests,
    status: EVENT_STATUS.PENDING,
    priority,
    priorityLabel,
    rawScore,
    sigmoidConfidence,
    priorityScore: score,
    scoreBreakdown: breakdown,
    createdAt: new Date().toISOString(),
    adminReason: null,
    decidedBy: null,
    decidedAt: null,
  }
  return mutate((d) => {
    d.events.push(event)
    return event
  })
}

/**
 * Event admin publishing a campus event directly — no competing-request
 * workflow, no score to beat. Goes straight onto the public feed as
 * 'approved'. Still blocked from double-booking an already-approved event
 * in the same venue/time, same as the request-and-decide path.
 */
export async function createDirectEvent({
  title,
  venueRoomId,
  createdBy,
  date,
  start,
  end,
  audienceSize,
  eventLevel,
  academic,
  externalGuests,
  description,
}) {
  const room = db.rooms.find((r) => r.id === venueRoomId)
  if (!room) throw new Error('Venue not found.')
  if (isDateBlocked(venueRoomId, date)) {
    throw new Error('This venue is blocked for that date.')
  }
  const clash = db.events.some(
    (e) => e.venueRoomId === venueRoomId && e.date === date && e.status === EVENT_STATUS.APPROVED && overlaps(e.start, e.end, start, end)
  )
  if (clash) throw new Error('Another event is already approved for this venue and time.')

  const { priority, priorityLabel, rawScore, sigmoidConfidence, score, breakdown } = computePriorityScore({
    eventLevel,
    academic,
    audienceSize,
    roomCapacity: room.capacity,
    daysAhead: daysAheadFor(date),
    externalGuests,
  })

  const event = {
    id: newId('ev'),
    title: title?.trim() || 'Untitled event',
    description: description?.trim() || '',
    venueRoomId,
    requestedBy: createdBy,
    date,
    start,
    end,
    audienceSize,
    eventLevel,
    academic,
    externalGuests,
    status: EVENT_STATUS.APPROVED,
    priority,
    priorityLabel,
    rawScore,
    sigmoidConfidence,
    priorityScore: score,
    scoreBreakdown: breakdown,
    createdAt: new Date().toISOString(),
    adminReason: 'Added directly by the event admin.',
    decidedBy: createdBy,
    decidedAt: new Date().toISOString(),
    overridden: false,
  }
  return mutate((d) => {
    d.events.push(event)
    return event
  })
}

export async function decideEvent(id, { decision, reason, byUserId, overridden }) {
  const event = db.events.find((e) => e.id === id)
  if (!event) throw new Error('Event request not found.')

  if (decision === EVENT_STATUS.APPROVED) {
    const roomClash = db.events.some(
      (e) =>
        e.id !== id &&
        e.venueRoomId === event.venueRoomId &&
        e.date === event.date &&
        e.status === EVENT_STATUS.APPROVED &&
        overlaps(e.start, e.end, event.start, event.end)
    )
    if (roomClash) {
      throw new Error('Another event is already approved for this venue and time.')
    }
    if (overridden && !reason?.trim()) {
      throw new Error('Record a reason when overriding the suggested priority score.')
    }
  }

  return mutate((d) => {
    const e = d.events.find((x) => x.id === id)
    e.status = decision
    e.adminReason = reason?.trim() || null
    e.admin_reason = reason?.trim() || null
    e.decidedBy = byUserId
    e.decidedAt = new Date().toISOString()
    e.overridden = !!overridden
    e.override_justification = overridden ? (reason?.trim() || null) : null

    // Register institutional audit log
    if (!d.auditLogs) d.auditLogs = []
    d.auditLogs.unshift({
      id: newId('aud'),
      actorId: byUserId || 'user-director-1',
      actorName: 'Campus Director',
      actorRole: 'campus_director',
      action: decision === EVENT_STATUS.APPROVED ? (overridden ? 'EVENT_APPROVED_WITH_OVERRIDE' : 'EVENT_APPROVED') : 'EVENT_REJECTED',
      entityType: 'EVENT',
      entityId: id,
      details: `Campus Director marked '${e.name || e.title}' as ${decision.toUpperCase()}. Reason/Justification: ${reason || 'Standard Institutional Approval'}`,
      timestamp: new Date().toISOString(),
    })

    return e
  })
}

export async function recommendEvent(id, { recommendation, notes, byUserId, byUserName }) {
  const event = db.events.find((e) => e.id === id)
  if (!event) throw new Error('Event request not found.')

  return mutate((d) => {
    const e = d.events.find((x) => x.id === id)
    e.departmentRecommendation = recommendation
    e.department_recommendation = recommendation
    e.departmentReviewerId = byUserId
    e.departmentReviewerName = byUserName
    e.department_reviewer_name = byUserName
    e.departmentReviewNotes = notes
    e.department_review_notes = notes
    e.status = recommendation === 'RECOMMENDED' ? 'awaiting_director_approval' : recommendation.toLowerCase()

    // Register departmental audit log
    if (!d.auditLogs) d.auditLogs = []
    d.auditLogs.unshift({
      id: newId('aud'),
      actorId: byUserId || 'user-hod-1',
      actorName: byUserName || 'Department Reviewer',
      actorRole: 'department_reviewer',
      action: 'EVENT_RECOMMENDATION_SUBMITTED',
      entityType: 'EVENT',
      entityId: id,
      details: `Official Department Recommendation (${recommendation}) recorded for '${e.name || e.title}'. Review Notes: ${notes || 'Endorsed for Director Sanction'}`,
      timestamp: new Date().toISOString(),
    })

    return e
  })
}

export async function listMyEvents(userId) {
  return db.events.filter((e) => e.requestedBy === userId)
}

export async function selectEventAlternative(eventId, { selected_venue_id, selected_date, selected_start_slot, selected_end_slot, notes }) {
  const evt = db.events.find((e) => e.id === eventId)
  if (!evt) throw new Error('Event not found.')
  return mutate((d) => {
    const e = d.events.find((x) => x.id === eventId)
    e.venueRoomId = selected_venue_id
    e.date = selected_date
    e.start = selected_start_slot || e.start
    e.end = selected_end_slot || e.end
    e.status = 'ALTERNATIVE_SELECTED'
    e.selectedAlternative = { selected_venue_id, selected_date, notes }
    return e
  })
}

export async function autoDecideCluster({ venueRoomId, date }) {
  const pending = db.events.filter(
    (e) => (e.venueRoomId === venueRoomId || e.venue_id === venueRoomId) &&
           (e.date === date || e.event_date === date) &&
           (e.status === EVENT_STATUS.PENDING || e.status === 'pending' || e.status === 'PENDING')
  )
  if (pending.length === 0) return { message: 'No pending requests in this cluster' }

  pending.sort((a, b) => {
    const scoreA = a.combined_priority_score ?? a.combinedPriorityScore ?? a.priorityScore ?? 0
    const scoreB = b.combined_priority_score ?? b.combinedPriorityScore ?? b.priorityScore ?? 0
    if (scoreB !== scoreA) return scoreB - scoreA
    const timeA = new Date(a.createdAt || a.created_at || a.date || 0).getTime()
    const timeB = new Date(b.createdAt || b.created_at || b.date || 0).getTime()
    return timeA - timeB
  })

  const winner = pending[0]
  const losers = pending.slice(1)

  return mutate((d) => {
    const w = d.events.find((x) => x.id === winner.id)
    if (w) {
      w.status = EVENT_STATUS.APPROVED
      w.adminReason = `Autonomous Decision Engine: Automatically awarded and approved based on priority score P = ${winner.combined_priority_score || winner.priorityScore || 91}.`
      w.decidedAt = new Date().toISOString()
      w.decidedBy = 'ai_priority_engine'
    }

    for (const loser of losers) {
      const l = d.events.find((x) => x.id === loser.id)
      if (l) {
        l.status = 'ALTERNATIVES_OFFERED'
        l.adminReason = `Autonomous Engine: Preferred venue automatically allocated to higher-priority event '${winner.title || winner.name}'. Feasible alternative venues automatically generated.`
        l.decidedAt = new Date().toISOString()
        l.decidedBy = 'ai_priority_engine'

        const alts = d.rooms
          .filter((r) => r.type === ROOM_TYPES.EVENT_VENUE && r.id !== (l.venueRoomId || l.venue_id) && r.capacity >= (l.audienceSize || l.expected_audience || 50))
          .slice(0, 3)
          .map((r) => ({
            venue_id: r.id,
            venue_name: r.name,
            building: r.building,
            capacity: r.capacity,
            suitability_score: Math.round(85 + Math.random() * 12),
          }))

        l.offered_alternatives = {
          venues: alts,
          auto_generated: true,
          timestamp: new Date().toISOString(),
        }
      }
    }

    return {
      winnerId: winner.id,
      winnerTitle: winner.title || winner.name,
      losersCount: losers.length,
    }
  })
}

// -------------------------------------------------------------- lost&found

/**
 * Everyone who had a reason to be in `block` on `date`: faculty teaching a
 * timetabled class there that day, plus anyone with an active classroom
 * booking there that day. This is who gets privately notified of a found
 * item reported for that block — reported by block, not by exact room, so
 * the finder doesn't need to know the precise room code.
 */
export async function getPeopleWithActivityInBlock(block, date = todayISO()) {
  const roomIds = db.rooms.filter((r) => r.building === block).map((r) => r.id)
  const day = weekdayForISO(date)

  const facultyNames = new Set(
    db.timetableSlots
      .filter((t) => roomIds.includes(t.roomId) && t.day === day && t.faculty)
      .map((t) => t.faculty)
  )
  const bookerIds = new Set(
    db.roomBookings
      .filter((b) => roomIds.includes(b.roomId) && b.date === date && b.status !== BOOKING_STATUS.CANCELLED)
      .map((b) => b.bookedBy)
  )

  return db.profiles.filter((p) => facultyNames.has(p.name) || bookerIds.has(p.id))
}

// Kept for anything that still wants "who recently used this exact room"
// (narrower than the block-wide notification above).
export async function getRecentBookersOfRoom(roomId, windowDays = RECENT_BOOKER_WINDOW_DAYS) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  const cutoffIso = cutoff.toISOString().slice(0, 10)
  const bookerIds = new Set(
    db.roomBookings
      .filter((b) => b.roomId === roomId && b.date >= cutoffIso && b.status !== BOOKING_STATUS.CANCELLED)
      .map((b) => b.bookedBy)
  )
  return db.profiles.filter((p) => bookerIds.has(p.id))
}

export async function listBlocks() {
  return [...new Set(db.rooms.map((r) => r.building).filter(Boolean))].sort()
}

export async function reportLostItem({ block, description, foundBy, photoUrl }) {
  const today = todayISO()
  const notified = await getPeopleWithActivityInBlock(block, today)
  const item = {
    id: newId('lost'),
    block,
    description: description?.trim() || 'Unlabelled item',
    photoUrl: photoUrl || null,
    foundBy,
    reportedAt: new Date().toISOString(),
    status: LOST_ITEM_STATUS.UNCLAIMED,
    claimedBy: null,
    claimedAt: null,
    notifiedUserIds: notified.map((p) => p.id),
  }
  return mutate((d) => {
    d.lostItems.push(item)
    return item
  })
}

export async function listLostItems() {
  return [...db.lostItems].sort((a, b) => (a.reportedAt < b.reportedAt ? 1 : -1))
}

export async function listLostItemsNotifyingUser(userId) {
  return db.lostItems.filter((i) => i.notifiedUserIds?.includes(userId) && i.status === LOST_ITEM_STATUS.UNCLAIMED)
}

export async function markItemClaimed(id, claimedBy) {
  return mutate((d) => {
    const item = d.lostItems.find((x) => x.id === id)
    if (!item) throw new Error('Item not found.')
    item.status = LOST_ITEM_STATUS.CLAIMED
    item.claimedBy = claimedBy
    item.claimedAt = new Date().toISOString()
    return item
  })
}

// ------------------------------------------------------------- maintenance

export async function reportMaintenance({ targetType, targetId, issue, reportedBy, severity }) {
  const report = {
    id: newId('mnt'),
    targetType,
    targetId,
    issue: issue?.trim() || 'Unspecified issue',
    reportedBy,
    severity: severity || 'minor',
    status: MAINTENANCE_STATUS.OPEN,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  }
  return mutate((d) => {
    d.maintenanceReports.push(report)
    if (targetType === 'facility' && report.severity === 'serious') {
      const f = d.facilities.find((x) => x.id === targetId)
      if (f) f.underMaintenance = true
    }
    return report
  })
}

export async function updateMaintenanceStatus(id, status) {
  return mutate((d) => {
    const report = d.maintenanceReports.find((x) => x.id === id)
    if (!report) throw new Error('Report not found.')
    report.status = status
    report.resolvedAt = status === MAINTENANCE_STATUS.RESOLVED ? new Date().toISOString() : null
    if (status === MAINTENANCE_STATUS.RESOLVED && report.targetType === 'facility') {
      const stillOpen = d.maintenanceReports.some(
        (r) => r.targetType === 'facility' && r.targetId === report.targetId && r.status !== MAINTENANCE_STATUS.RESOLVED && r.severity === 'serious'
      )
      if (!stillOpen) {
        const f = d.facilities.find((x) => x.id === report.targetId)
        if (f) f.underMaintenance = false
      }
    }
    return report
  })
}

export async function listMaintenanceReports() {
  return [...db.maintenanceReports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

// --------------------------------------------------------------- dashboard

export async function getUtilizationStats() {
  sweepAutoRelease()
  const classrooms = db.rooms.filter((r) => r.type === ROOM_TYPES.CLASSROOM)
  const totalBookableSlotsPerWeek = BOOKABLE_SLOTS.length * 5 // 5 weekdays

  const roomUtilization = classrooms.map((room) => {
    const timetabled = db.timetableSlots.filter((t) => t.roomId === room.id).length
    const bookedThisWeek = db.roomBookings.filter(
      (b) =>
        b.roomId === room.id &&
        b.status !== BOOKING_STATUS.CANCELLED &&
        b.status !== BOOKING_STATUS.RELEASED
    ).length
    const used = timetabled + bookedThisWeek
    return {
      room: room.name,
      timetabled,
      booked: bookedThisWeek,
      utilizationPct: Math.min(100, Math.round((used / totalBookableSlotsPerWeek) * 100)),
    }
  })

  const eventCounts = {
    pending: db.events.filter((e) => e.status === EVENT_STATUS.PENDING).length,
    approved: db.events.filter((e) => e.status === EVENT_STATUS.APPROVED).length,
    declined: db.events.filter((e) => e.status === EVENT_STATUS.DECLINED).length,
  }

  const facilityUsage = db.facilities.map((f) => ({
    facility: f.name,
    bookings: db.facilityBookings.filter((b) => b.facilityId === f.id && b.status !== FACILITY_BOOKING_STATUS.CANCELLED).length,
    inductions: db.inductions.filter((i) => i.facilityId === f.id).length,
  }))

  const openMaintenance = db.maintenanceReports.filter((m) => m.status !== MAINTENANCE_STATUS.RESOLVED).length
  const unclaimedLostItems = db.lostItems.filter((i) => i.status === LOST_ITEM_STATUS.UNCLAIMED).length

  return { roomUtilization, eventCounts, facilityUsage, openMaintenance, unclaimedLostItems }
}

// ------------------------------------------------ Academic Scheduling
export async function listChangeRequests() {
  return [...(db.timetableChangeRequests || [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function proposeChangeRequest(reqData) {
  const newReq = {
    id: newId('tt-req'),
    ...reqData,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  return mutate((d) => {
    if (!d.timetableChangeRequests) d.timetableChangeRequests = []
    d.timetableChangeRequests.push(newReq)
    if (!d.notifications) d.notifications = []
    d.notifications.push({
      id: newId('notif'),
      recipientId: 'user-classadvisor-1',
      title: 'Timetable Change Proposal',
      message: `${reqData.requesterName} proposed moving ${reqData.courseName} to ${reqData.proposedDay} (${reqData.proposedSlot}).`,
      category: 'timetable',
      link: '/academic-scheduling',
      isRead: false,
      createdAt: new Date().toISOString(),
    })
    return newReq
  })
}

export async function reviewChangeRequest(id, { decision, reviewNotes, approverName, approverId }) {
  return mutate((d) => {
    const req = (d.timetableChangeRequests || []).find((r) => r.id === id)
    if (!req) throw new Error('Change request not found')
    req.status = decision
    req.approverName = approverName
    req.approverId = approverId
    req.reviewNotes = reviewNotes
    req.updatedAt = new Date().toISOString()

    if (decision === 'approved') {
      const existingSlot = d.timetableSlots.find(
        (s) => s.day === req.originalDay && s.slotId === req.originalSlot && s.code === req.courseCode
      )
      if (existingSlot) {
        existingSlot.day = req.proposedDay
        existingSlot.slotId = req.proposedSlot
        existingSlot.roomId = req.proposedRoomId
      }
    }
    return req
  })
}

// ------------------------------------------------ Lost & Found Enhanced
export async function reportSmartLostItem(itemData) {
  let assignedHandlerName = 'Office of Student Welfare'
  let assignedHandlerId = 'user-welfare-1'
  let currentCustody = 'student_welfare'
  let routingReason = 'Outdoor / Campus Common Area: Auto-routed to Student Welfare Office.'

  if (itemData.isClassroom && itemData.roomId) {
    const ttSlot = (db.timetableSlots || []).find(
      (s) => s.roomId === itemData.roomId && s.slotId === itemData.slotId
    )
    if (ttSlot && ttSlot.faculty) {
      assignedHandlerName = 'Dr Devika'
      assignedHandlerId = 'user-classadvisor-1'
      currentCustody = 'class_advisor'
      routingReason = `Classroom Timetable Match (${ttSlot.courseName || 'Class'}). Automatically routed to Class Advisor Dr Devika.`
    }
  }

  const item = {
    id: newId('lf'),
    ...itemData,
    assignedHandlerName,
    assignedHandlerId,
    currentCustody,
    routingReason,
    status: 'reported',
    claims: [],
    custodyLogs: [
      {
        id: newId('log'),
        action: 'reported',
        actorName: itemData.finderName,
        fromCustodian: 'Finder',
        toCustodian: assignedHandlerName,
        timestamp: new Date().toISOString(),
      },
    ],
    reportedAt: new Date().toISOString(),
  }

  return mutate((d) => {
    if (!d.lostItems) d.lostItems = []
    d.lostItems.unshift(item)
    return item
  })
}

export async function submitClaim(itemId, claimData) {
  return mutate((d) => {
    const item = d.lostItems.find((i) => i.id === itemId)
    if (!item) throw new Error('Item not found')
    const newClaim = {
      id: newId('claim'),
      ...claimData,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    if (!item.claims) item.claims = []
    item.claims.push(newClaim)
    item.status = 'claim_pending'
    return newClaim
  })
}

export async function reviewClaim(itemId, claimId, { decision, handlerNotes }) {
  return mutate((d) => {
    const item = d.lostItems.find((i) => i.id === itemId)
    if (!item) throw new Error('Item not found')
    const claim = (item.claims || []).find((c) => c.id === claimId)
    if (!claim) throw new Error('Claim not found')
    claim.status = decision
    claim.handlerNotes = handlerNotes
    if (decision === 'rejected') item.status = 'in_custody'
    return claim
  })
}

export async function recordHandover(itemId, { newCustody, handoverNotes }) {
  return mutate((d) => {
    const item = d.lostItems.find((i) => i.id === itemId)
    if (!item) throw new Error('Item not found')
    const oldCustody = item.currentCustody
    item.status = newCustody
    item.currentCustody = newCustody
    item.handoverNotes = handoverNotes
    if (newCustody === 'returned') {
      item.returnDate = new Date().toISOString().replace('T', ' ').slice(0, 16)
    }
    if (!item.custodyLogs) item.custodyLogs = []
    item.custodyLogs.push({
      id: newId('log'),
      action: newCustody,
      actorName: 'Custodian',
      fromCustodian: oldCustody,
      toCustodian: newCustody,
      notes: handoverNotes,
      timestamp: new Date().toISOString(),
    })
    return item
  })
}

// ------------------------------------------------ Notifications
export async function listNotifications(userId) {
  return (db.notifications || []).filter(
    (n) => !userId || n.recipientId === userId || n.recipientId === 'all'
  )
}

export async function markNotificationRead(id) {
  return mutate((d) => {
    const notif = (d.notifications || []).find((n) => n.id === id)
    if (notif) notif.isRead = true
    return notif
  })
}

export async function markAllNotificationsRead(userId) {
  return mutate((d) => {
    ;(d.notifications || []).forEach((n) => {
      if (!userId || n.recipientId === userId) n.isRead = true
    })
    return true
  })
}

// ------------------------------------------------ Audit Logs
export async function listAuditLogs() {
  return [...(db.auditLogs || [])].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
}

// ------------------------------------------------ E-Governance Spec
export async function getEGovernanceSpec() {
  return {
    status: 'MOCK_INTEGRATION_MODE',
    protocol: 'OpenID Connect (OIDC) / SAML 2.0',
    issuer: 'https://auth.amrita.edu/realms/campus',
    syncedRecords: 42,
  }
}

export async function simulateEGovernanceSync() {
  return {
    status: 'SUCCESS',
    synced_records: 42,
    message: 'Simulated synchronization succeeded against synthetic university roster.',
  }
}

// ------------------------------------------------ HPC Operations
export async function getHpcOverview() {
  const nodes = db.hpcNodes || []
  const jobs = db.hpcJobs || []
  const total = nodes.length
  const working = nodes.filter((n) => n.status === 'idle' || n.status === 'busy').length
  const idle = nodes.filter((n) => n.status === 'idle').length
  const busy = nodes.filter((n) => n.status === 'busy').length
  const offline = nodes.filter((n) => n.status === 'offline').length
  const maintenance = nodes.filter((n) => n.status === 'maintenance').length
  const activeJobs = jobs.filter((j) => j.status === 'running').length
  const queuedJobs = jobs.filter((j) => j.status === 'queued').length
  return {
    cluster_id: 'cce-hpc-cluster',
    cluster_name: 'Amrita Center for Computational Engineering HPC',
    total_nodes: total,
    working_nodes: working,
    idle_nodes: idle,
    busy_nodes: busy,
    offline_nodes: offline,
    maintenance_nodes: maintenance,
    available_compute_capacity_pct: total > 0 ? (idle / total) * 100 : 0,
    active_jobs: activeJobs,
    queued_jobs: queuedJobs,
    cpu_utilization_pct: 60.3,
    memory_utilization_pct: 52.6,
    gpu_utilization_pct: 48.7,
    node_hours_consumed: 14040.0,
    failed_jobs_24h: 0,
    operational_alerts: 1,
    telemetry_type: 'SYNTHETIC_DEMO_TELEMETRY',
    telemetry_notice: 'DEMO DATA: Synthetic cluster telemetry for hackathon evaluation. Real SLURM / Prometheus exporter can be wired via REST collector.',
    last_telemetry_sync: new Date().toISOString(),
  }
}

export async function listHpcNodes() {
  return [...(db.hpcNodes || [])]
}

export async function updateHpcNodeStatus(nodeId, { status, notes }) {
  return mutate((d) => {
    const node = (d.hpcNodes || []).find((n) => n.id === nodeId)
    if (!node) throw new Error('HPC Node not found')
    node.status = status
    if (notes !== undefined) node.notes = notes
    node.lastHeartbeat = new Date().toISOString()
    return node
  })
}

export async function listHpcJobs() {
  return [...(db.hpcJobs || [])]
}

export async function listHpcIncidents() {
  return [...(db.hpcIncidents || [])]
}

export async function createHpcIncident({ nodeId, incidentType, severity, description, reportedBy }) {
  return mutate((d) => {
    const inc = {
      id: newId('inc'),
      nodeId,
      incidentType: incidentType || 'operational_fault',
      severity: severity || 'warning',
      description,
      reportedBy: reportedBy || 'Dr Radhika N',
      status: 'open',
      createdAt: new Date().toISOString(),
    }
    if (!d.hpcIncidents) d.hpcIncidents = []
    d.hpcIncidents.unshift(inc)
    return inc
  })
}

// ----------------------------------------------------------- misc exports
export { toMinutes }

