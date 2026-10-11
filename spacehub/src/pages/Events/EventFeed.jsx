import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { listPublicEvents, listMyEvents, listRooms, selectEventAlternative } from '../../lib/dataClient'
import { formatTimeRange } from '../../lib/time'
import { CAN_REQUEST_EVENT, EVENT_LEVEL_LABELS, ROLES, ROOM_TYPES } from '../../lib/constants'
import Badge from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import { Spinner } from '../../components/common/Feedback'
import AddEventModal from './AddEventModal'

const STATUS_TONE = {
  pending: 'amber',
  PENDING: 'amber',
  approved: 'green',
  APPROVED: 'green',
  declined: 'red',
  rejected: 'red',
  REJECTED: 'red',
  alternatives_offered: 'blue',
  ALTERNATIVES_OFFERED: 'blue',
  alternative_selected: 'purple',
  ALTERNATIVE_SELECTED: 'purple',
  cancelled: 'slate',
  CANCELLED: 'slate',
}

export default function EventFeed() {
  const { user } = useAuth()
  const { data: events, loading } = useLiveData(() => listPublicEvents(), [])
  const { data: rooms } = useLiveData(() => listRooms(), [])
  const { data: mine } = useLiveData(() => listMyEvents(user.id), [user.id])
  const [addOpen, setAddOpen] = useState(false)

  const roomName = (id) => rooms?.find((r) => r.id === id)?.name ?? id
  const venues = rooms?.filter((r) => r.type === ROOM_TYPES.EVENT_VENUE)
  const isAdmin = user.role === ROLES.ADMIN

  const grouped = {}
  for (const e of events ?? []) {
    const d = e.date || e.event_date
    grouped[d] = grouped[d] || []
    grouped[d].push(e)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Happening on campus</h1>
          <p className="text-sm text-slate-500">Every approved event, visible to everyone — verified slot allocations across campus.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button className="btn-secondary whitespace-nowrap" onClick={() => setAddOpen(true)}>
              + Add event
            </button>
          )}
          {CAN_REQUEST_EVENT.has(user.role) && (
            <Link to="/events/new" className="btn-primary whitespace-nowrap">
              + Request a venue
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState icon="🎤" title="No approved events yet" hint="Approved venue requests will show up here." />
      ) : (
        <div className="flex max-h-[32rem] flex-col gap-5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{date}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((e) => (
                  <div key={e.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-800">{e.title || e.name}</p>
                      <Badge tone="blue">{EVENT_LEVEL_LABELS[e.eventLevel || e.level] || e.level}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {roomName(e.venueRoomId || e.venue_id)} · {formatTimeRange(e.start || e.start_slot, e.end || e.end_slot)}
                    </p>
                    {(e.description || e.purpose) && <p className="mt-2 text-xs text-slate-600">{e.description || e.purpose}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {CAN_REQUEST_EVENT.has(user.role) && mine?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">Your Booking Requests &amp; Recommendations</h2>
            <span className="text-xs text-slate-400 font-medium">Automatic alternative suggestions active</span>
          </div>
          <div className="flex flex-col gap-3">
            {mine.map((e) => (
              <UserRequestCard key={e.id} event={e} roomName={roomName} />
            ))}
          </div>
        </section>
      )}

      {isAdmin && <AddEventModal open={addOpen} onClose={() => setAddOpen(false)} venues={venues} />}
    </div>
  )
}

function UserRequestCard({ event, roomName }) {
  const [busy, setBusy] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errMsg, setErrMsg] = useState('')

  const rawAlts = event.offered_alternatives || event.offeredAlternatives
  const alternatives = typeof rawAlts === 'string' ? JSON.parse(rawAlts) : rawAlts

  async function handleSelect(alt) {
    setBusy(true)
    setErrMsg('')
    try {
      await selectEventAlternative(event.id, {
        selected_venue_id: alt.venue_id,
        selected_date: alt.event_date || event.date,
        selected_start_slot: alt.start_slot || event.start,
        selected_end_slot: alt.end_slot || event.end,
        notes: `Requester accepted recommendation: ${alt.venue_name || alt.venue_id}`,
      })
      setSuccessMsg(`Selected ${alt.venue_name || alt.venue_id}! Submitted for clearance.`)
    } catch (err) {
      setErrMsg(err.message || 'Failed to select alternative')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3.5 text-sm space-y-2 border border-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-extrabold text-slate-800">{event.title || event.name}</p>
            {event.combined_priority_score != null && (
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                Priority Score: {event.combined_priority_score}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            🏛️ {roomName(event.venueRoomId || event.venue_id)} · 📅 {event.date || event.event_date} · ⏰ {formatTimeRange(event.start || event.start_slot, event.end || event.end_slot)}
          </p>
          {((event.status?.toLowerCase() === 'declined' || event.status?.toLowerCase() === 'rejected') && (event.adminReason || event.admin_notes)) && (
            <p className="mt-1 text-xs text-rose-600 font-medium">Reason: {event.adminReason || event.admin_notes}</p>
          )}
          {(event.status === 'alternatives_offered' || event.status === 'ALTERNATIVES_OFFERED') && (
            <div className="mt-1.5 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900 font-medium">
              <span className="font-bold block text-purple-950">🤖 Autonomous Priority Decision:</span>
              <span>{event.adminReason || event.admin_notes || 'Preferred slot awarded to a higher-priority competing request. Feasible alternative options have been automatically generated for you below.'}</span>
            </div>
          )}
        </div>
        <Badge tone={STATUS_TONE[event.status] || 'slate'}>
          {event.status?.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      {successMsg && (
        <div className="p-2 rounded bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
          ✓ {successMsg}
        </div>
      )}
      {errMsg && (
        <div className="p-2 rounded bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200">
          ✕ {errMsg}
        </div>
      )}

      {/* Alternatives Offered Section */}
      {alternatives && alternatives.venues && alternatives.venues.length > 0 && event.status !== 'approved' && event.status !== 'APPROVED' && (
        <div className="mt-2 pt-2 border-t border-slate-100 bg-amber-50/40 p-2.5 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
              <span>💡</span> Recommended Alternatives for your request (Top Fit):
            </span>
            <span className="text-[10px] text-amber-700 font-medium">Verified Available</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {alternatives.venues.map((v) => (
              <div key={v.venue_id} className="p-2 bg-white rounded border border-amber-200 text-xs flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">{v.venue_name}</span>
                  <span className="text-[10px] text-slate-500 block">{v.building} · {v.capacity} seats</span>
                  <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Suitability: {v.suitability_score}%</span>
                </div>
                <button
                  disabled={busy}
                  onClick={() => handleSelect(v)}
                  className="mt-2 w-full py-1 text-[11px] font-bold rounded bg-brand-600 text-white hover:bg-brand-700 transition"
                >
                  {busy ? 'Selecting…' : 'Select This Venue'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
