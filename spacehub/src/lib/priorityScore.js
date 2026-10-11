// Sigmoid-Based Binary Priority Scoring for People and Campus Events
// 
// Formula:
//   S = sum(weight_i * feature_i), where features in [0, 1] and weights sum to 1.
//   sigmoid(S) = 1 / (1 + exp(-10 * (S - 0.60)))
//   priority = 1 if sigmoid(S) >= 0.5 else 0
//   (1 = High Priority, 0 = Normal Priority)

export const DEFAULT_CUTOFF = 0.60
export const DEFAULT_STEEPNESS = 10.0

export const ROLE_PRIORITY_WEIGHTS = {
  hod: 1.00,
  department_head: 1.00,
  sys_admin: 0.95,
  resource_admin: 0.90,
  faculty: 0.75,
  hpc_faculty: 0.75,
  class_advisor: 0.70,
  lab_admin: 0.65,
  lost_property_handler: 0.60,
  lab_assistant: 0.50,
  class_rep: 0.45,
  student: 0.30,
}

export const EVENT_LEVEL_WEIGHTS = {
  university: 1.00,
  department: 0.70,
  club: 0.40,
}

export function sigmoid(s, cutoff = DEFAULT_CUTOFF, steepness = DEFAULT_STEEPNESS) {
  const z = -steepness * (s - cutoff)
  if (z > 80) return 0.0
  if (z < -80) return 1.0
  return 1.0 / (1.0 + Math.exp(z))
}

export function computePersonPriority(role, cutoff = DEFAULT_CUTOFF, steepness = DEFAULT_STEEPNESS) {
  const cleanRole = String(role || '').trim().toLowerCase()
  const rawScore = ROLE_PRIORITY_WEIGHTS[cleanRole] ?? 0.30
  const confidence = sigmoid(rawScore, cutoff, steepness)
  const priority = confidence >= 0.5 ? 1 : 0

  return {
    priority,
    priorityLabel: priority === 1 ? 'High Priority' : 'Normal Priority',
    rawScore: Number(rawScore.toFixed(4)),
    sigmoidConfidence: Number(confidence.toFixed(4)),
    cutoff,
    steepness,
  }
}

export function computePriorityScore({
  eventLevel = 'department',
  academic = true,
  audienceSize = 100,
  daysAhead = 7,
  externalGuests = false,
  organizerRole = null,
  cutoff = DEFAULT_CUTOFF,
  steepness = DEFAULT_STEEPNESS,
}) {
  // 1. Event Level (weight 0.35)
  const fLevel = EVENT_LEVEL_WEIGHTS[eventLevel] ?? 0.40
  const wLevel = 0.35

  // 2. Academic Importance (weight 0.25)
  const fAcademic = academic ? 1.00 : 0.00
  const wAcademic = 0.25

  // 3. Expected Audience normalized over [10, 500] (weight 0.15)
  const aud = Math.max(0, Number(audienceSize) || 0)
  const fAudience = Math.max(0, Math.min(1, (aud - 10) / (500 - 10)))
  const wAudience = 0.15

  // 4. Urgency based on notice/event date (weight 0.15)
  let fUrgency = 0.20
  if (daysAhead <= 3) fUrgency = 1.00
  else if (daysAhead <= 7) fUrgency = 0.80
  else if (daysAhead <= 14) fUrgency = 0.60
  else if (daysAhead <= 30) fUrgency = 0.40
  const wUrgency = 0.15

  // 5. Institutional Stakeholders (weight 0.10)
  let fStakeholder = 0.00
  if (externalGuests) {
    fStakeholder = 1.00
  } else if (organizerRole) {
    const r = String(organizerRole).toLowerCase()
    if (['hod', 'department_head', 'sys_admin', 'resource_admin'].includes(r)) fStakeholder = 1.00
    else if (['faculty', 'hpc_faculty'].includes(r)) fStakeholder = 0.80
    else if (['class_advisor', 'lab_admin'].includes(r)) fStakeholder = 0.60
  }
  const wStakeholder = 0.10

  // Normalized weighted score S in [0, 1]
  const rawScore = (
    wLevel * fLevel +
    wAcademic * fAcademic +
    wAudience * fAudience +
    wUrgency * fUrgency +
    wStakeholder * fStakeholder
  )

  const confidence = sigmoid(rawScore, cutoff, steepness)
  const priority = confidence >= 0.5 ? 1 : 0
  const score = Math.round(confidence * 100)

  return {
    priority,
    priorityLabel: priority === 1 ? 'High Priority' : 'Normal Priority',
    rawScore: Number(rawScore.toFixed(4)),
    sigmoidConfidence: Number(confidence.toFixed(4)),
    score,
    max: 100,
    breakdown: [
      {
        label: 'Event level',
        points: Math.round(fLevel * 100),
        weight: '35%',
        max: 100,
        note: `${eventLevel} (${(fLevel * 100).toFixed(0)}%)`
      },
      {
        label: 'Academic relevance',
        points: Math.round(fAcademic * 100),
        weight: '25%',
        max: 100,
        note: academic ? 'Curricular / Academic' : 'Extra-curricular'
      },
      {
        label: 'Audience scale',
        points: Math.round(fAudience * 100),
        weight: '15%',
        max: 100,
        note: `${aud} attendees (${(fAudience * 100).toFixed(0)}% normalized)`
      },
      {
        label: 'Date urgency',
        points: Math.round(fUrgency * 100),
        weight: '15%',
        max: 100,
        note: `${daysAhead} days notice (${(fUrgency * 100).toFixed(0)}%)`
      },
      {
        label: 'Stakeholder presence',
        points: Math.round(fStakeholder * 100),
        weight: '10%',
        max: 100,
        note: externalGuests ? 'External guests / VIPs' : (organizerRole ? `${organizerRole} organizer` : 'Internal')
      },
    ],
  }
}
