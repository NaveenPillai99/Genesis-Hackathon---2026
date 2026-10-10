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
  FACILITY_REQUEST_STATUS,
  LOST_ITEM_STATUS,
  MAINTENANCE_STATUS,
  NEEDS_FACILITY_MENTOR,
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

function freshDb() {
  return {
    profiles: SEED_PROFILES,
    rooms: SEED_ROOMS,
    timetableSlots: buildSeedTimetableSlots(),
    roomBookings: [],
    blockedDates: [],
    events: [],
    facilities: SEED_FACILITIES.map((f) => ({ ...f, underMaintenance: false })),
    facilityRequests: [],
    lostItems: [],
    maintenanceReports: [],
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
    return JSON.parse(raw)
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

// ------------------------------------------------------- facility requests
// No induction system — access is granted per request instead.
// Submitted -> [Faculty Approval Pending ->] Facility Admin Review ->
// Approved / Rejected / Alternative Suggested. Students/class reps need
// their faculty mentor's sign-off first; faculty/admin requests go straight
// to the facility administrator (see NEEDS_FACILITY_MENTOR). Mirrors the
// event-request pattern: a request is a hold, not a grant, until fully
// approved; only approved requests are mutually exclusive on time.

export async function listFacilityRequests({ facilityId, mentorId, status } = {}) {
  return db.facilityRequests.filter(
    (r) =>
      (!facilityId || r.facilityId === facilityId) &&
      (!mentorId || r.mentorId === mentorId) &&
      (!status || r.status === status)
  )
}

export async function listMyFacilityRequests(userId) {
  return db.facilityRequests
    .filter((r) => r.requestedBy === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function requestFacilityAccess({
  facilityId,
  requestedBy,
  requesterRole,
  mentorId,
  date,
  start,
  end,
  durationMinutes,
  nodeHoursRequested,
  purpose,
}) {
  const facility = db.facilities.find((f) => f.id === facilityId)
  if (!facility) throw new Error('Facility not found.')
  if (facility.underMaintenance) throw new Error('This facility is currently under maintenance.')
  if (facility.allocationModel === 'compute_time' && !nodeHoursRequested) {
    throw new Error('Specify how many node-hours you need.')
  }

  const needsMentor = NEEDS_FACILITY_MENTOR.has(requesterRole)
  if (needsMentor && !mentorId) throw new Error('Pick a faculty mentor to approve this request first.')

  const request = {
    id: newId('freq'),
    facilityId,
    requestedBy,
    mentorId: needsMentor ? mentorId : null,
    date,
    start,
    end,
    durationMinutes,
    nodeHoursRequested: nodeHoursRequested || null,
    purpose: purpose?.trim() || 'Unspecified',
    status: needsMentor ? FACILITY_REQUEST_STATUS.PENDING_MENTOR : FACILITY_REQUEST_STATUS.PENDING_FACILITY,
    mentorDecidedBy: null,
    mentorDecidedAt: null,
    mentorReason: null,
    facilityDecidedBy: null,
    facilityDecidedAt: null,
    facilityReason: null,
    altDate: null,
    altStart: null,
    altEnd: null,
    altNote: null,
    createdAt: new Date().toISOString(),
  }
  return mutate((d) => {
    d.facilityRequests.push(request)
    return request
  })
}

export async function decideMentorStage(id, { decision, byUserId, reason }) {
  const request = db.facilityRequests.find((x) => x.id === id)
  if (!request) throw new Error('Request not found.')
  if (request.status !== FACILITY_REQUEST_STATUS.PENDING_MENTOR) {
    throw new Error('This request already moved past the mentor stage.')
  }
  return mutate((d) => {
    const r = d.facilityRequests.find((x) => x.id === id)
    r.mentorDecidedBy = byUserId
    r.mentorDecidedAt = new Date().toISOString()
    r.mentorReason = reason?.trim() || null
    r.status = decision === 'approved' ? FACILITY_REQUEST_STATUS.PENDING_FACILITY : FACILITY_REQUEST_STATUS.DECLINED
    return r
  })
}

function hasApprovedClash(requestId, facilityId, date, start, end) {
  return db.facilityRequests.some(
    (r) =>
      r.id !== requestId &&
      r.facilityId === facilityId &&
      r.date === date &&
      r.status === FACILITY_REQUEST_STATUS.APPROVED &&
      overlaps(r.start, r.end, start, end)
  )
}

/** Facility administrator's decision: approve at the requested time, reject outright, or propose a different slot. */
export async function decideFacilityStage(id, { decision, byUserId, reason, altDate, altStart, altEnd, altNote }) {
  const request = db.facilityRequests.find((x) => x.id === id)
  if (!request) throw new Error('Request not found.')
  if (request.status !== FACILITY_REQUEST_STATUS.PENDING_FACILITY) {
    throw new Error('This request is not awaiting facility admin review.')
  }

  const facility = db.facilities.find((f) => f.id === request.facilityId)

  if (decision === 'approved') {
    if (facility?.underMaintenance) throw new Error('This facility is currently under maintenance.')
    if (hasApprovedClash(id, request.facilityId, request.date, request.start, request.end)) {
      throw new Error('Another approved request already covers this facility at an overlapping time.')
    }
  }
  if (decision === 'alternative') {
    if (!altDate || !altStart || !altEnd) throw new Error('Pick a date and time to suggest.')
    if (hasApprovedClash(id, request.facilityId, altDate, altStart, altEnd)) {
      throw new Error('That alternative slot is already taken too — pick another.')
    }
  }

  return mutate((d) => {
    const r = d.facilityRequests.find((x) => x.id === id)
    r.facilityDecidedBy = byUserId
    r.facilityDecidedAt = new Date().toISOString()
    r.facilityReason = reason?.trim() || null
    if (decision === 'approved') {
      r.status = FACILITY_REQUEST_STATUS.APPROVED
    } else if (decision === 'alternative') {
      r.status = FACILITY_REQUEST_STATUS.ALTERNATIVE_SUGGESTED
      r.altDate = altDate
      r.altStart = altStart
      r.altEnd = altEnd
      r.altNote = altNote?.trim() || null
    } else {
      r.status = FACILITY_REQUEST_STATUS.DECLINED
    }
    return r
  })
}

/** Requester's response to a suggested alternative time. */
export async function respondToAlternative(id, { decision, byUserId }) {
  const request = db.facilityRequests.find((x) => x.id === id)
  if (!request) throw new Error('Request not found.')
  if (request.status !== FACILITY_REQUEST_STATUS.ALTERNATIVE_SUGGESTED) {
    throw new Error('This request has no pending alternative to respond to.')
  }

  if (decision === 'accept') {
    const facility = db.facilities.find((f) => f.id === request.facilityId)
    if (facility?.underMaintenance) throw new Error('This facility is currently under maintenance.')
    if (hasApprovedClash(id, request.facilityId, request.altDate, request.altStart, request.altEnd)) {
      throw new Error('That alternative slot was just taken by someone else — ask the facility admin for another.')
    }
  }

  return mutate((d) => {
    const r = d.facilityRequests.find((x) => x.id === id)
    if (decision === 'accept') {
      r.date = r.altDate
      r.start = r.altStart
      r.end = r.altEnd
      r.status = FACILITY_REQUEST_STATUS.APPROVED
      r.facilityDecidedBy = byUserId
      r.facilityDecidedAt = new Date().toISOString()
    } else {
      r.status = FACILITY_REQUEST_STATUS.DECLINED
      r.facilityReason = r.facilityReason || 'Alternative time declined by requester'
    }
    return r
  })
}

export async function cancelFacilityRequest(id) {
  return mutate((d) => {
    const r = d.facilityRequests.find((x) => x.id === id)
    if (!r) throw new Error('Request not found.')
    if (r.status === FACILITY_REQUEST_STATUS.APPROVED) {
      throw new Error("This request's already been approved — contact the facility administrator to cancel it.")
    }
    r.status = FACILITY_REQUEST_STATUS.DECLINED
    r.facilityReason = r.facilityReason || 'Cancelled by requester'
    return r
  })
}

// ------------------------------------------------------------------ events

function daysAheadFor(date) {
  const today = new Date(`${todayISO()}T00:00:00`)
  const target = new Date(`${date}T00:00:00`)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

export async function listEvents({ status } = {}) {
  return db.events
    .filter((e) => !status || e.status === status)
    .sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1))
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
  const { score, breakdown } = computePriorityScore({
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

  const { score, breakdown } = computePriorityScore({
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
    e.decidedBy = byUserId
    e.decidedAt = new Date().toISOString()
    e.overridden = !!overridden
    return e
  })
}

export async function listMyEvents(userId) {
  return db.events.filter((e) => e.requestedBy === userId)
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
    approved: db.facilityRequests.filter((r) => r.facilityId === f.id && r.status === FACILITY_REQUEST_STATUS.APPROVED).length,
    pending: db.facilityRequests.filter(
      (r) =>
        r.facilityId === f.id &&
        r.status !== FACILITY_REQUEST_STATUS.APPROVED &&
        r.status !== FACILITY_REQUEST_STATUS.DECLINED
    ).length,
  }))

  const openMaintenance = db.maintenanceReports.filter((m) => m.status !== MAINTENANCE_STATUS.RESOLVED).length
  const unclaimedLostItems = db.lostItems.filter((i) => i.status === LOST_ITEM_STATUS.UNCLAIMED).length

  return { roomUtilization, eventCounts, facilityUsage, openMaintenance, unclaimedLostItems }
}

// ----------------------------------------------------------- misc exports

export { toMinutes }
