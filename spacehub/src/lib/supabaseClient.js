// Real backend: talks to the Postgres schema in supabase/schema.sql. Exports
// the exact same function names as src/mock/mockClient.js so dataClient.js
// can hand either module to the rest of the app interchangeably.
//
// Double-booking prevention, the headline feature of the tech stack, is NOT
// re-implemented here in JS — it's enforced by the EXCLUDE constraints in
// schema.sql. This file mostly does friendly pre-checks (so the UI can show
// a nice error before round-tripping) and otherwise trusts the database.

import { createClient } from '@supabase/supabase-js'
import { emitDataChanged } from './bus'
import { BOOKABLE_SLOTS, EVENT_STATUS, MAINTENANCE_STATUS, NEEDS_FACILITY_MENTOR, ROOM_TYPES } from './constants'
import { computePriorityScore } from './priorityScore'
import { weekdayForISO, weekStartISO, durationHours, overlaps } from './time'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

function assertConfigured() {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.')
}

function unwrap({ data, error }) {
  if (error) {
    if (error.code === '23P01') {
      throw new Error('That slot was just taken by someone else (the database blocked the double-booking). Pick another.')
    }
    throw new Error(error.message)
  }
  return data
}

async function after(promise) {
  const result = unwrap(await promise)
  emitDataChanged()
  return result
}

// Subscribe to the tables the UI cares about so changes made from another
// device/browser propagate here too. Call once (e.g. in App.jsx); safe to
// call even if Realtime hasn't been enabled on the project yet (it just
// won't fire, and the app still works via its own emitDataChanged calls).
export function subscribeToRealtimeChanges() {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('spacehub-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => emitDataChanged())
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ------------------------------------------------------------- profiles ---

export async function listProfiles() {
  assertConfigured()
  return unwrap(await supabase.from('profiles').select('*').order('name'))
}

export async function getProfile(id) {
  assertConfigured()
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// ------------------------------------------------------------------ rooms -

export async function listRooms({ type } = {}) {
  assertConfigured()
  let q = supabase.from('rooms').select('*').order('name')
  if (type) q = q.eq('type', type)
  return unwrap(await q)
}

export async function getRoom(id) {
  assertConfigured()
  const { data, error } = await supabase.from('rooms').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// -------------------------------------------------------------- timetable -

function mapTimetableRow(t) {
  return {
    id: t.id,
    roomId: t.room_id,
    day: t.day,
    slotId: t.slot_id,
    start: t.start_time?.slice(0, 5),
    end: t.end_time?.slice(0, 5),
    code: t.code,
    courseName: t.course_name,
    faculty: t.faculty,
  }
}

export async function listTimetableSlots({ roomId, day } = {}) {
  assertConfigured()
  let q = supabase.from('timetable_slots').select('*')
  if (roomId) q = q.eq('room_id', roomId)
  if (day) q = q.eq('day', day)
  const rows = unwrap(await q)
  return rows.map(mapTimetableRow)
}

// -------------------------------------------------------- classroom board -

function mapBookingRow(b) {
  return {
    id: b.id,
    roomId: b.room_id,
    date: b.booking_date,
    slotId: b.slot_id,
    start: b.start_time?.slice(0, 5),
    end: b.end_time?.slice(0, 5),
    bookedBy: b.booked_by,
    purpose: b.purpose,
    status: b.status,
    createdAt: b.created_at,
    checkedInAt: b.checked_in_at,
    releasedAt: b.released_at,
  }
}

export async function getAvailability({ date, roomIds } = {}) {
  assertConfigured()
  const day = weekdayForISO(date)
  let roomsQ = supabase.from('rooms').select('*').order('name')
  if (roomIds) roomsQ = roomsQ.in('id', roomIds)
  const rooms = unwrap(await roomsQ)

  const [timetableRows, bookingRows, blockRows, maintRows] = await Promise.all([
    supabase.from('timetable_slots').select('*').eq('day', day || '__none__'),
    supabase.from('room_bookings').select('*').eq('booking_date', date).in('status', ['booked', 'checked_in']),
    supabase.from('blocked_dates').select('*').eq('block_date', date),
    supabase.from('maintenance_reports').select('*').eq('target_type', 'room').eq('severity', 'serious').neq('status', 'resolved'),
  ])
  const timetable = unwrap(timetableRows).map(mapTimetableRow)
  const bookings = unwrap(bookingRows).map(mapBookingRow)
  const blocks = unwrap(blockRows)
  const maint = unwrap(maintRows)

  return rooms.map((room) => {
    const blocked = blocks.find((b) => b.room_id === room.id)
    const underMaintenance = maint.some((m) => m.target_id === room.id)
    const slots = BOOKABLE_SLOTS.map((slot) => {
      if (blocked) return { ...slot, status: 'blocked', reason: blocked.reason }
      if (underMaintenance) return { ...slot, status: 'maintenance' }
      const tt = timetable.find((t) => t.roomId === room.id && t.slotId === slot.id)
      if (tt) return { ...slot, status: 'timetable', timetable: tt }
      const booking = bookings.find((b) => b.roomId === room.id && b.slotId === slot.id)
      if (booking) return { ...slot, status: booking.status === 'checked_in' ? 'checked_in' : 'booked', booking }
      return { ...slot, status: 'free' }
    })
    return { room, day, slots, blocked: !!blocked, underMaintenance }
  })
}

export async function getWeeklyBookedHours(userId, date) {
  assertConfigured()
  const weekStart = weekStartISO(date)
  const weekEnd = new Date(`${weekStart}T00:00:00`)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const rows = unwrap(
    await supabase
      .from('room_bookings')
      .select('*')
      .eq('booked_by', userId)
      .gte('booking_date', weekStart)
      .lt('booking_date', weekEnd.toISOString().slice(0, 10))
      .in('status', ['booked', 'checked_in'])
  )
  return rows.reduce((sum, b) => sum + durationHours(b.start_time.slice(0, 5), b.end_time.slice(0, 5)), 0)
}

export async function createRoomBooking({ roomId, date, slotId, userId, purpose }) {
  assertConfigured()
  const slot = BOOKABLE_SLOTS.find((s) => s.id === slotId)
  if (!slot) throw new Error('Invalid time slot.')
  return mapBookingRow(
    await after(
      supabase
        .from('room_bookings')
        .insert({
          room_id: roomId,
          booking_date: date,
          slot_id: slotId,
          start_time: slot.start,
          end_time: slot.end,
          booked_by: userId,
          purpose,
        })
        .select()
        .single()
    )
  )
}

export async function cancelRoomBooking(id) {
  assertConfigured()
  return after(
    supabase.from('room_bookings').update({ status: 'cancelled', released_at: new Date().toISOString() }).eq('id', id)
  )
}

export async function checkInBooking(id) {
  assertConfigured()
  return after(
    supabase.from('room_bookings').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', id)
  )
}

export async function listMyRoomBookings(userId) {
  assertConfigured()
  const rows = unwrap(
    await supabase.from('room_bookings').select('*').eq('booked_by', userId).order('booking_date', { ascending: false })
  )
  return rows.map(mapBookingRow)
}

export async function listRoomBookingsForRoom(roomId, { fromDate } = {}) {
  assertConfigured()
  let q = supabase.from('room_bookings').select('*').eq('room_id', roomId)
  if (fromDate) q = q.gte('booking_date', fromDate)
  return unwrap(await q).map(mapBookingRow)
}

// ------------------------------------------------------- admin overrides --

export async function blockRoomDate({ roomId, date, reason, byUserId }) {
  assertConfigured()
  await supabase.from('room_bookings').update({ status: 'cancelled', released_at: new Date().toISOString() }).eq('room_id', roomId).eq('booking_date', date).eq('status', 'booked')
  return after(
    supabase.from('blocked_dates').insert({ room_id: roomId, block_date: date, reason, created_by: byUserId }).select().single()
  )
}

export async function unblockRoomDate(blockId) {
  assertConfigured()
  return after(supabase.from('blocked_dates').delete().eq('id', blockId))
}

export async function listBlockedDates() {
  assertConfigured()
  return unwrap(await supabase.from('blocked_dates').select('*'))
}

export async function adminCancelBooking(id, reason) {
  assertConfigured()
  return after(
    supabase
      .from('room_bookings')
      .update({ status: 'cancelled', released_at: new Date().toISOString(), admin_override_reason: reason })
      .eq('id', id)
  )
}

// ------------------------------------------------------------- facilities -

export async function listFacilities() {
  assertConfigured()
  const rows = unwrap(await supabase.from('facilities').select('*').order('name'))
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    location: f.location,
    description: f.description,
    contact: f.contact,
    allocationModel: f.allocation_model,
    image: f.image,
    underMaintenance: f.under_maintenance,
  }))
}

export async function getFacility(id) {
  const all = await listFacilities()
  return all.find((f) => f.id === id) ?? null
}

export async function setFacilityMaintenance(id, underMaintenance) {
  assertConfigured()
  return after(supabase.from('facilities').update({ under_maintenance: underMaintenance }).eq('id', id))
}

// ------------------------------------------------------- facility requests
// No induction system — access is granted per request instead.
// Submitted -> [Faculty Approval Pending ->] Facility Admin Review ->
// Approved / Rejected / Alternative Suggested. Mirrors mockClient.js
// exactly; the facility_requests table's partial EXCLUDE constraint
// (status = 'approved') is the final backstop against two approved
// requests overlapping on the same facility/time.

function mapFacilityRequestRow(r) {
  return {
    id: r.id,
    facilityId: r.facility_id,
    requestedBy: r.requested_by,
    mentorId: r.mentor_id,
    date: r.request_date,
    start: r.start_time?.slice(0, 5),
    end: r.end_time?.slice(0, 5),
    durationMinutes: r.duration_minutes,
    nodeHoursRequested: r.node_hours_requested,
    purpose: r.purpose,
    status: r.status,
    mentorDecidedBy: r.mentor_decided_by,
    mentorDecidedAt: r.mentor_decided_at,
    mentorReason: r.mentor_reason,
    facilityDecidedBy: r.facility_decided_by,
    facilityDecidedAt: r.facility_decided_at,
    facilityReason: r.facility_reason,
    altDate: r.alt_date,
    altStart: r.alt_start_time?.slice(0, 5),
    altEnd: r.alt_end_time?.slice(0, 5),
    altNote: r.alt_note,
    createdAt: r.created_at,
  }
}

export async function listFacilityRequests({ facilityId, mentorId, status } = {}) {
  assertConfigured()
  let q = supabase.from('facility_requests').select('*')
  if (facilityId) q = q.eq('facility_id', facilityId)
  if (mentorId) q = q.eq('mentor_id', mentorId)
  if (status) q = q.eq('status', status)
  return unwrap(await q).map(mapFacilityRequestRow)
}

export async function listMyFacilityRequests(userId) {
  assertConfigured()
  const rows = unwrap(
    await supabase.from('facility_requests').select('*').eq('requested_by', userId).order('created_at', { ascending: false })
  )
  return rows.map(mapFacilityRequestRow)
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
  assertConfigured()
  const facility = await getFacility(facilityId)
  if (!facility) throw new Error('Facility not found.')
  if (facility.underMaintenance) throw new Error('This facility is currently under maintenance.')
  if (facility.allocationModel === 'compute_time' && !nodeHoursRequested) {
    throw new Error('Specify how many node-hours you need.')
  }

  const needsMentor = NEEDS_FACILITY_MENTOR.has(requesterRole)
  if (needsMentor && !mentorId) throw new Error('Pick a faculty mentor to approve this request first.')

  return mapFacilityRequestRow(
    await after(
      supabase
        .from('facility_requests')
        .insert({
          facility_id: facilityId,
          requested_by: requestedBy,
          mentor_id: needsMentor ? mentorId : null,
          request_date: date,
          start_time: start,
          end_time: end,
          duration_minutes: durationMinutes,
          node_hours_requested: nodeHoursRequested || null,
          purpose,
          status: needsMentor ? 'pending_mentor' : 'pending_facility',
        })
        .select()
        .single()
    )
  )
}

export async function decideMentorStage(id, { decision, byUserId, reason }) {
  assertConfigured()
  return mapFacilityRequestRow(
    await after(
      supabase
        .from('facility_requests')
        .update({
          status: decision === 'approved' ? 'pending_facility' : 'declined',
          mentor_decided_by: byUserId,
          mentor_decided_at: new Date().toISOString(),
          mentor_reason: reason?.trim() || null,
        })
        .eq('id', id)
        .eq('status', 'pending_mentor')
        .select()
        .single()
    )
  )
}

/** Facility administrator's decision: approve at the requested time, reject outright, or propose a different slot. */
export async function decideFacilityStage(id, { decision, byUserId, reason, altDate, altStart, altEnd, altNote }) {
  assertConfigured()
  if (decision === 'alternative' && (!altDate || !altStart || !altEnd)) {
    throw new Error('Pick a date and time to suggest.')
  }
  return mapFacilityRequestRow(
    await after(
      supabase
        .from('facility_requests')
        .update({
          status: decision === 'approved' ? 'approved' : decision === 'alternative' ? 'alternative_suggested' : 'declined',
          facility_decided_by: byUserId,
          facility_decided_at: new Date().toISOString(),
          facility_reason: reason?.trim() || null,
          alt_date: decision === 'alternative' ? altDate : null,
          alt_start_time: decision === 'alternative' ? altStart : null,
          alt_end_time: decision === 'alternative' ? altEnd : null,
          alt_note: decision === 'alternative' ? altNote?.trim() || null : null,
        })
        .eq('id', id)
        .eq('status', 'pending_facility')
        .select()
        .single()
    )
  )
}

/** Requester's response to a suggested alternative time. */
export async function respondToAlternative(id, { decision, byUserId }) {
  assertConfigured()
  if (decision === 'accept') {
    const { data: request } = await supabase.from('facility_requests').select('*').eq('id', id).single()
    if (!request) throw new Error('Request not found.')
    return mapFacilityRequestRow(
      await after(
        supabase
          .from('facility_requests')
          .update({
            status: 'approved',
            request_date: request.alt_date,
            start_time: request.alt_start_time,
            end_time: request.alt_end_time,
            facility_decided_by: byUserId,
            facility_decided_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('status', 'alternative_suggested')
          .select()
          .single()
      )
    )
  }
  return mapFacilityRequestRow(
    await after(
      supabase
        .from('facility_requests')
        .update({ status: 'declined', facility_reason: 'Alternative time declined by requester' })
        .eq('id', id)
        .eq('status', 'alternative_suggested')
        .select()
        .single()
    )
  )
}

export async function cancelFacilityRequest(id) {
  assertConfigured()
  return after(
    supabase
      .from('facility_requests')
      .update({ status: 'declined', facility_reason: 'Cancelled by requester' })
      .eq('id', id)
      .neq('status', 'approved')
  )
}

// ---------------------------------------------------------------- events --

function mapEventRow(e) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    venueRoomId: e.venue_room_id,
    requestedBy: e.requested_by,
    date: e.event_date,
    start: e.start_time?.slice(0, 5),
    end: e.end_time?.slice(0, 5),
    audienceSize: e.audience_size,
    eventLevel: e.event_level,
    academic: e.academic,
    externalGuests: e.external_guests,
    status: e.status,
    priorityScore: e.priority_score,
    scoreBreakdown: e.score_breakdown,
    adminReason: e.admin_reason,
    overridden: e.overridden,
    decidedBy: e.decided_by,
    decidedAt: e.decided_at,
    createdAt: e.created_at,
  }
}

export async function listEvents({ status } = {}) {
  assertConfigured()
  let q = supabase.from('events').select('*').order('event_date')
  if (status) q = q.eq('status', status)
  return unwrap(await q).map(mapEventRow)
}

export async function listPublicEvents() {
  return listEvents({ status: EVENT_STATUS.APPROVED })
}

export async function getCompetingRequests(event) {
  assertConfigured()
  const rows = unwrap(
    await supabase
      .from('events')
      .select('*')
      .eq('venue_room_id', event.venueRoomId)
      .eq('event_date', event.date)
      .eq('status', 'pending')
      .neq('id', event.id)
  )
  return rows.map(mapEventRow).filter((e) => overlaps(e.start, e.end, event.start, event.end))
}

export async function suggestAlternativeVenues({ date, start, end, excludeRoomId, audienceSize }) {
  assertConfigured()
  const venues = unwrap(await supabase.from('rooms').select('*').eq('type', ROOM_TYPES.EVENT_VENUE).neq('id', excludeRoomId))
  const approved = unwrap(await supabase.from('events').select('*').eq('event_date', date).eq('status', 'approved'))
  const blocked = unwrap(await supabase.from('blocked_dates').select('*').eq('block_date', date))
  return venues.filter((venue) => {
    if (blocked.some((b) => b.room_id === venue.id)) return false
    if (audienceSize && venue.capacity < audienceSize) return false
    const clash = approved.some(
      (e) => e.venue_room_id === venue.id && overlaps(e.start_time.slice(0, 5), e.end_time.slice(0, 5), start, end)
    )
    return !clash
  })
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
  assertConfigured()
  const room = await getRoom(venueRoomId)
  if (!room) throw new Error('Venue not found.')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${date}T00:00:00`)
  const daysAhead = Math.round((target - today) / 86400000)
  const { score, breakdown } = computePriorityScore({
    eventLevel,
    academic,
    audienceSize,
    roomCapacity: room.capacity,
    daysAhead,
    externalGuests,
  })
  return mapEventRow(
    await after(
      supabase
        .from('events')
        .insert({
          title,
          description,
          venue_room_id: venueRoomId,
          requested_by: requestedBy,
          event_date: date,
          start_time: start,
          end_time: end,
          audience_size: audienceSize,
          event_level: eventLevel,
          academic,
          external_guests: externalGuests,
          priority_score: score,
          score_breakdown: breakdown,
        })
        .select()
        .single()
    )
  )
}

/**
 * Event admin publishing a campus event directly — no competing-request
 * workflow, no score to beat. Goes straight onto the public feed as
 * 'approved'. Mirrors mockClient.js's createDirectEvent exactly; the
 * `events` table's partial EXCLUDE constraint (status = 'approved') is the
 * final backstop against double-booking a venue even here.
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
  assertConfigured()
  const room = await getRoom(venueRoomId)
  if (!room) throw new Error('Venue not found.')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${date}T00:00:00`)
  const daysAhead = Math.round((target - today) / 86400000)
  const { score, breakdown } = computePriorityScore({
    eventLevel,
    academic,
    audienceSize,
    roomCapacity: room.capacity,
    daysAhead,
    externalGuests,
  })
  return mapEventRow(
    await after(
      supabase
        .from('events')
        .insert({
          title,
          description,
          venue_room_id: venueRoomId,
          requested_by: createdBy,
          event_date: date,
          start_time: start,
          end_time: end,
          audience_size: audienceSize,
          event_level: eventLevel,
          academic,
          external_guests: externalGuests,
          priority_score: score,
          score_breakdown: breakdown,
          status: EVENT_STATUS.APPROVED,
          admin_reason: 'Added directly by the event admin.',
          decided_by: createdBy,
          decided_at: new Date().toISOString(),
          overridden: false,
        })
        .select()
        .single()
    )
  )
}

export async function decideEvent(id, { decision, reason, byUserId, overridden }) {
  assertConfigured()
  if (decision === EVENT_STATUS.APPROVED && overridden && !reason?.trim()) {
    throw new Error('Record a reason when overriding the suggested priority score.')
  }
  return mapEventRow(
    await after(
      supabase
        .from('events')
        .update({
          status: decision,
          admin_reason: reason?.trim() || null,
          decided_by: byUserId,
          decided_at: new Date().toISOString(),
          overridden: !!overridden,
        })
        .eq('id', id)
        .select()
        .single()
    )
  )
}

export async function listMyEvents(userId) {
  assertConfigured()
  const rows = unwrap(await supabase.from('events').select('*').eq('requested_by', userId))
  return rows.map(mapEventRow)
}

export async function selectEventAlternative(id, { selected_venue_id, selected_date, selected_start_slot, selected_end_slot, notes }) {
  assertConfigured()
  return mapEventRow(
    await after(
      supabase
        .from('events')
        .update({
          venue_room_id: selected_venue_id,
          event_date: selected_date,
          status: 'ALTERNATIVE_SELECTED',
          admin_reason: notes,
        })
        .eq('id', id)
        .select()
        .single()
    )
  )
}

export async function autoDecideCluster({ venueRoomId, date }) {
  assertConfigured()
  const rows = unwrap(await supabase.from('events').select('*').eq('venue_room_id', venueRoomId).eq('event_date', date).eq('status', 'pending'))
  if (!rows || rows.length === 0) return { message: 'No pending requests' }
  const events = rows.map(mapEventRow).sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
  const winner = events[0]
  await supabase.from('events').update({ status: 'approved', admin_reason: 'Auto-approved by AI priority engine' }).eq('id', winner.id)
  for (const loser of events.slice(1)) {
    await supabase.from('events').update({ status: 'ALTERNATIVES_OFFERED', admin_reason: 'Alternative options generated by AI engine' }).eq('id', loser.id)
  }
  return { winnerId: winner.id, winnerTitle: winner.title }
}

// ----------------------------------------------------------- lost & found -

function mapLostItemRow(i) {
  return {
    id: i.id,
    block: i.block,
    description: i.description,
    photoUrl: i.photo_url,
    foundBy: i.found_by,
    reportedAt: i.reported_at,
    status: i.status,
    claimedBy: i.claimed_by,
    claimedAt: i.claimed_at,
    notifiedUserIds: i.notified_user_ids ?? [],
  }
}

export async function listBlocks() {
  assertConfigured()
  const rows = unwrap(await supabase.from('rooms').select('building'))
  return [...new Set(rows.map((r) => r.building).filter(Boolean))].sort()
}

/** Everyone with a reason to be in `block` on `date` — see mockClient.js for the full rationale. */
export async function getPeopleWithActivityInBlock(block, date) {
  assertConfigured()
  const day = weekdayForISO(date)
  const roomIds = unwrap(await supabase.from('rooms').select('id').eq('building', block)).map((r) => r.id)
  if (roomIds.length === 0) return []

  const [timetableRows, bookingRows] = await Promise.all([
    supabase.from('timetable_slots').select('faculty').in('room_id', roomIds).eq('day', day || '__none__'),
    supabase.from('room_bookings').select('booked_by').in('room_id', roomIds).eq('booking_date', date).neq('status', 'cancelled'),
  ])
  const facultyNames = new Set(unwrap(timetableRows).map((t) => t.faculty).filter(Boolean))
  const bookerIds = new Set(unwrap(bookingRows).map((b) => b.booked_by))

  const allProfiles = await listProfiles()
  return allProfiles.filter((p) => facultyNames.has(p.name) || bookerIds.has(p.id))
}

export async function reportLostItem({ block, description, foundBy, photoUrl }) {
  assertConfigured()
  const today = new Date().toISOString().slice(0, 10)
  const notified = await getPeopleWithActivityInBlock(block, today)
  return mapLostItemRow(
    await after(
      supabase
        .from('lost_items')
        .insert({ block, description, photo_url: photoUrl || null, found_by: foundBy, notified_user_ids: notified.map((p) => p.id) })
        .select()
        .single()
    )
  )
}

export async function listLostItems() {
  assertConfigured()
  const rows = unwrap(await supabase.from('lost_items').select('*').order('reported_at', { ascending: false }))
  return rows.map(mapLostItemRow)
}

export async function listLostItemsNotifyingUser(userId) {
  const items = await listLostItems()
  return items.filter((i) => i.notifiedUserIds?.includes(userId) && i.status === 'unclaimed')
}

export async function markItemClaimed(id, claimedBy) {
  assertConfigured()
  return mapLostItemRow(
    await after(
      supabase
        .from('lost_items')
        .update({ status: 'claimed', claimed_by: claimedBy, claimed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    )
  )
}

// ----------------------------------------------------------- maintenance --

function mapMaintenanceRow(m) {
  return {
    id: m.id,
    targetType: m.target_type,
    targetId: m.target_id,
    issue: m.issue,
    reportedBy: m.reported_by,
    severity: m.severity,
    status: m.status,
    createdAt: m.created_at,
    resolvedAt: m.resolved_at,
  }
}

export async function reportMaintenance({ targetType, targetId, issue, reportedBy, severity }) {
  assertConfigured()
  const report = mapMaintenanceRow(
    await after(
      supabase
        .from('maintenance_reports')
        .insert({ target_type: targetType, target_id: targetId, issue, reported_by: reportedBy, severity })
        .select()
        .single()
    )
  )
  if (targetType === 'facility' && severity === 'serious') {
    await setFacilityMaintenance(targetId, true)
  }
  return report
}

export async function updateMaintenanceStatus(id, status) {
  assertConfigured()
  const { data: report } = await supabase.from('maintenance_reports').select('*').eq('id', id).single()
  const updated = mapMaintenanceRow(
    await after(
      supabase
        .from('maintenance_reports')
        .update({ status, resolved_at: status === MAINTENANCE_STATUS.RESOLVED ? new Date().toISOString() : null })
        .eq('id', id)
        .select()
        .single()
    )
  )
  if (status === MAINTENANCE_STATUS.RESOLVED && report?.target_type === 'facility') {
    const { data: stillOpen } = await supabase
      .from('maintenance_reports')
      .select('id')
      .eq('target_type', 'facility')
      .eq('target_id', report.target_id)
      .eq('severity', 'serious')
      .neq('status', 'resolved')
    if (!stillOpen?.length) await setFacilityMaintenance(report.target_id, false)
  }
  return updated
}

export async function listMaintenanceReports() {
  assertConfigured()
  const rows = unwrap(await supabase.from('maintenance_reports').select('*').order('created_at', { ascending: false }))
  return rows.map(mapMaintenanceRow)
}

// -------------------------------------------------------------- dashboard -

export async function getUtilizationStats() {
  assertConfigured()
  const classrooms = await listRooms({ type: ROOM_TYPES.CLASSROOM })
  const totalBookableSlotsPerWeek = BOOKABLE_SLOTS.length * 5

  const roomUtilization = []
  for (const room of classrooms) {
    const [{ count: timetabled }, { count: booked }] = await Promise.all([
      supabase.from('timetable_slots').select('id', { count: 'exact', head: true }).eq('room_id', room.id),
      supabase.from('room_bookings').select('id', { count: 'exact', head: true }).eq('room_id', room.id).in('status', ['booked', 'checked_in']),
    ])
    const used = (timetabled || 0) + (booked || 0)
    roomUtilization.push({
      room: room.name,
      timetabled: timetabled || 0,
      booked: booked || 0,
      utilizationPct: Math.min(100, Math.round((used / totalBookableSlotsPerWeek) * 100)),
    })
  }

  const [{ count: pending }, { count: approved }, { count: declined }] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'declined'),
  ])

  const facilities = await listFacilities()
  const facilityUsage = []
  for (const f of facilities) {
    const [{ count: approved }, { count: pending }] = await Promise.all([
      supabase.from('facility_requests').select('id', { count: 'exact', head: true }).eq('facility_id', f.id).eq('status', 'approved'),
      supabase.from('facility_requests').select('id', { count: 'exact', head: true }).eq('facility_id', f.id).in('status', ['pending_mentor', 'pending_facility', 'alternative_suggested']),
    ])
    facilityUsage.push({ facility: f.name, approved: approved || 0, pending: pending || 0 })
  }

  const { count: openMaintenance } = await supabase.from('maintenance_reports').select('id', { count: 'exact', head: true }).neq('status', 'resolved')
  const { count: unclaimedLostItems } = await supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'unclaimed')

  return {
    roomUtilization,
    eventCounts: { pending: pending || 0, approved: approved || 0, declined: declined || 0 },
    facilityUsage,
    openMaintenance: openMaintenance || 0,
    unclaimedLostItems: unclaimedLostItems || 0,
  }
}

// HPC Cluster Operations
export {
  getHpcOverview,
  listHpcNodes,
  updateHpcNodeStatus,
  listHpcJobs,
  listHpcIncidents,
  createHpcIncident,
} from '../mock/mockClient'

