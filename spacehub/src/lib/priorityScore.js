// Suggested priority score for competing event-venue requests (0-100).
// This is a *suggestion* shown to the admin, never a binding decision — the
// admin can always override it, but must record a reason (enforced in the UI
// and in events.admin_reason being required on an override in schema.sql).
//
// Criteria, from the problem statement:
//  - Event level (university > department > club)
//  - Academic vs non-academic
//  - How well the audience size fits the venue
//  - How far in advance it was requested
//  - Whether external guests are involved

const EVENT_LEVEL_POINTS = { university: 40, department: 25, club: 10 }

export function computePriorityScore({
  eventLevel,
  academic,
  audienceSize,
  roomCapacity,
  daysAhead,
  externalGuests,
}) {
  const levelPts = EVENT_LEVEL_POINTS[eventLevel] ?? 10

  const academicPts = academic ? 15 : 5

  let fitPts = 0
  let fitNote = 'No capacity on record'
  if (roomCapacity > 0 && audienceSize > 0) {
    const ratio = audienceSize / roomCapacity
    if (ratio > 1) {
      fitPts = 0
      fitNote = `Over capacity (${audienceSize} for ${roomCapacity} seats)`
    } else if (ratio >= 0.5) {
      fitPts = 20
      fitNote = `Good fit (${Math.round(ratio * 100)}% of capacity)`
    } else if (ratio >= 0.3) {
      fitPts = 12
      fitNote = `Fair fit (${Math.round(ratio * 100)}% of capacity)`
    } else {
      fitPts = 5
      fitNote = `Venue much larger than audience (${Math.round(ratio * 100)}%)`
    }
  }

  let noticePts = 0
  let noticeNote = 'Requested very last-minute'
  if (daysAhead >= 14) {
    noticePts = 15
    noticeNote = `${daysAhead} days' notice`
  } else if (daysAhead >= 7) {
    noticePts = 10
    noticeNote = `${daysAhead} days' notice`
  } else if (daysAhead >= 3) {
    noticePts = 5
    noticeNote = `${daysAhead} days' notice`
  } else {
    noticeNote = `Only ${Math.max(daysAhead, 0)} days' notice`
  }

  const guestPts = externalGuests ? 10 : 0

  const score = levelPts + academicPts + fitPts + noticePts + guestPts

  return {
    score,
    max: 100,
    breakdown: [
      { label: 'Event level', points: levelPts, max: 40, note: eventLevel },
      { label: 'Academic / non-academic', points: academicPts, max: 15, note: academic ? 'Academic' : 'Non-academic' },
      { label: 'Audience fit', points: fitPts, max: 20, note: fitNote },
      { label: 'Advance notice', points: noticePts, max: 15, note: noticeNote },
      { label: 'External guests', points: guestPts, max: 10, note: externalGuests ? 'Involves external guests' : 'Internal only' },
    ],
  }
}
