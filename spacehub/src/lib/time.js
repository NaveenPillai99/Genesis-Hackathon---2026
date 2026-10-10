import { WEEKDAYS } from './constants'

/** 'YYYY-MM-DD' for a Date, in local time (not UTC — avoids the off-by-one-day bug). */
export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO() {
  return toISODate(new Date())
}

/** Weekday name ('Monday'..'Friday') for an ISO date, or null for a weekend. */
export function weekdayForISO(iso) {
  const d = new Date(`${iso}T00:00:00`)
  const idx = d.getDay() // 0 Sun .. 6 Sat
  if (idx === 0 || idx === 6) return null
  return WEEKDAYS[idx - 1]
}

/** The next `count` calendar dates starting today, as { iso, weekday, label }. */
export function upcomingDates(count = 14) {
  const out = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const iso = toISODate(d)
    const weekday = weekdayForISO(iso)
    if (!weekday) continue
    out.push({
      iso,
      weekday,
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    })
  }
  return out
}

/** Minutes since midnight for an 'HH:MM' string. */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
}

/** 'HH:MM' that is `hours` (fractional, e.g. 1.5) after `start`. Clamps to 23:59 — callers deal with same-day scheduling only. */
export function addHoursToTime(start, hours) {
  const total = Math.min(23 * 60 + 59, toMinutes(start) + Math.round(hours * 60))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function durationHours(start, end) {
  return (toMinutes(end) - toMinutes(start)) / 60
}

/** Monday of the week containing this ISO date, as an ISO date (for weekly-cap math). */
export function weekStartISO(iso) {
  const d = new Date(`${iso}T00:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISODate(d)
}

export function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
