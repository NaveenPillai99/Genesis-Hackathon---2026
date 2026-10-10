import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { getAvailability, listPublicEvents, listMyRoomBookings, listRooms } from '../../lib/dataClient'
import { todayISO, nowHHMM, formatTimeRange, toMinutes, upcomingDates } from '../../lib/time'
import { ROLES, ROOM_TYPES } from '../../lib/constants'
import Badge from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import { Spinner } from '../../components/common/Feedback'

export default function Dashboard() {
  const { user } = useAuth()
  const today = todayISO()
  const now = nowHHMM()

  // The nearest teaching day (could be today, or the next weekday if today's
  // a weekend) — timetable_slots only exist Mon-Fri, so checking literal
  // todayISO() on a weekend would find zero classes and misreport every
  // room as free all day, which isn't a useful "open study spaces" view.
  const studyDate = upcomingDates(7)[0]?.iso ?? today
  const studyDateIsToday = studyDate === today

  const { data: classrooms } = useLiveData(() => listRooms({ type: ROOM_TYPES.CLASSROOM }), [])
  const { data: board, loading: boardLoading } = useLiveData(
    () => getAvailability({ date: studyDate, roomIds: (classrooms ?? []).map((r) => r.id) }),
    [studyDate, classrooms?.length]
  )
  const { data: events, loading: eventsLoading } = useLiveData(() => listPublicEvents(), [])
  const { data: myBookings } = useLiveData(() => listMyRoomBookings(user.id), [user.id])

  const isLive = (e) => e.date === today && toMinutes(e.start) <= toMinutes(now) && toMinutes(now) < toMinutes(e.end)
  // Every approved event from today onward, soonest first — not just the ones live this exact minute,
  // so "what's going on at campus" is a real scrollable list rather than an almost-always-empty card.
  const upcomingEvents = (events ?? [])
    .filter((e) => e.date > today || (e.date === today && toMinutes(e.end) > toMinutes(now)))
    .sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1))

  // Every classroom's still-free slots on the nearest teaching day — not
  // just the literal current minute (which is "free" for almost no one
  // almost all day). Purely informational: no booking affordance here, just
  // a live read of the timetable + bookings/check-ins/releases, same data
  // the Classrooms board uses, so it reflects any change there instantly —
  // including an admin's timetable edit or someone else's booking/cancel.
  const openToday = (board ?? [])
    .map((entry) => ({
      room: entry.room,
      freeSlots: entry.slots.filter((s) => s.status === 'free' && (!studyDateIsToday || toMinutes(s.end) > toMinutes(now))),
    }))
    .filter((entry) => entry.freeSlots.length > 0)

  const upcomingMine = (myBookings ?? []).filter((b) => b.status === 'booked' || b.status === 'checked_in').slice(0, 4)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Hi {user.name.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500">Here's what's happening on campus right now.</p>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">🎤 Happening on campus</h2>
          <div className="flex items-center gap-3">
            {user.role === ROLES.ADMIN && (
              <Link to="/events" className="text-xs font-semibold text-brand-600 hover:underline">
                + Add event
              </Link>
            )}
            <Link to="/events" className="text-xs font-semibold text-brand-600 hover:underline">
              Full feed →
            </Link>
          </div>
        </div>
        {eventsLoading ? (
          <Spinner />
        ) : upcomingEvents.length === 0 ? (
          <EmptyState icon="🌤️" title="Nothing scheduled" hint="Approved events will show up here as they're published." />
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {upcomingEvents.map((e) => (
              <li
                key={e.id}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                  isLive(e) ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'
                }`}
              >
                <span className="min-w-0">
                  <span className={`block truncate font-semibold ${isLive(e) ? 'text-rose-800' : 'text-slate-800'}`}>{e.title}</span>
                  <span className={`text-xs ${isLive(e) ? 'text-rose-600' : 'text-slate-500'}`}>
                    {e.date === today ? 'Today' : e.date} · {formatTimeRange(e.start, e.end)}
                  </span>
                </span>
                {isLive(e) && <Badge tone="red">live</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              🪑 Open study spaces {studyDateIsToday ? 'today' : 'next teaching day'}
            </h2>
            <Link to="/classrooms" className="text-xs font-semibold text-brand-600 hover:underline">
              Full board →
            </Link>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            {studyDateIsToday
              ? 'Free classroom slots for the rest of today, straight from the timetable — just for finding a quiet spot, nothing to book here.'
              : `No classes today — showing free slots for ${studyDate} instead, straight from the timetable.`}
          </p>
          {boardLoading ? (
            <Spinner />
          ) : openToday.length === 0 ? (
            <EmptyState icon="🔒" title="Nothing free for the rest of today" />
          ) : (
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {openToday.map(({ room, freeSlots }) => (
                <li key={room.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-emerald-800">{room.name}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {freeSlots.map((s) => (
                      <span key={s.id} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                        {s.start}–{s.end}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">📌 Your upcoming bookings</h2>
            <Link to="/classrooms" className="text-xs font-semibold text-brand-600 hover:underline">
              Manage →
            </Link>
          </div>
          {upcomingMine.length === 0 ? (
            <EmptyState icon="🗓️" title="No bookings yet" hint="Free classroom slots are first-come, first-served." />
          ) : (
            <ul className="flex flex-col gap-2">
              {upcomingMine.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>
                    <span className="block font-semibold text-slate-800">{b.date}</span>
                    <span className="text-xs text-slate-500">{formatTimeRange(b.start, b.end)}</span>
                  </span>
                  <Badge tone={b.status === 'checked_in' ? 'green' : 'amber'}>{b.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: '/classrooms', label: 'Classrooms', icon: '🏫' },
          { to: '/events', label: 'Event Venues', icon: '🎤' },
          { to: '/facilities', label: 'Facilities', icon: '🧪' },
          { to: '/lost-found', label: 'Lost & Found', icon: '🔎' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card flex flex-col items-center gap-1 p-4 text-center transition hover:border-brand-300 hover:shadow-md"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs font-semibold text-slate-700">{item.label}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
