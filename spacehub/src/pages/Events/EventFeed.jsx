import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { listPublicEvents, listMyEvents, listRooms } from '../../lib/dataClient'
import { formatTimeRange } from '../../lib/time'
import { CAN_REQUEST_EVENT, EVENT_LEVEL_LABELS, ROLES, ROOM_TYPES } from '../../lib/constants'
import Badge from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import { Spinner } from '../../components/common/Feedback'
import AddEventModal from './AddEventModal'

const STATUS_TONE = { pending: 'amber', approved: 'green', declined: 'red', cancelled: 'slate' }

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
    grouped[e.date] = grouped[e.date] || []
    grouped[e.date].push(e)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Happening on campus</h1>
          <p className="text-sm text-slate-500">Every approved event, visible to everyone — what's running in which venue.</p>
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
                      <p className="font-bold text-slate-800">{e.title}</p>
                      <Badge tone="blue">{EVENT_LEVEL_LABELS[e.eventLevel]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {roomName(e.venueRoomId)} · {formatTimeRange(e.start, e.end)}
                    </p>
                    {e.description && <p className="mt-2 text-xs text-slate-600">{e.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {CAN_REQUEST_EVENT.has(user.role) && mine?.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-800">Your requests</h2>
          <div className="flex flex-col gap-2">
            {mine.map((e) => (
              <div key={e.id} className="card flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {roomName(e.venueRoomId)} · {e.date} · {formatTimeRange(e.start, e.end)}
                  </p>
                  {e.status === 'declined' && e.adminReason && (
                    <p className="mt-1 text-xs text-rose-600">Reason: {e.adminReason}</p>
                  )}
                </div>
                <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && <AddEventModal open={addOpen} onClose={() => setAddOpen(false)} venues={venues} />}
    </div>
  )
}
