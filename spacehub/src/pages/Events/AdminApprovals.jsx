import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import {
  decideEvent,
  listEvents,
  listProfiles,
  listRooms,
  suggestAlternativeVenues,
} from '../../lib/dataClient'
import { formatTimeRange } from '../../lib/time'
import { EVENT_LEVEL_LABELS, EVENT_STATUS } from '../../lib/constants'
import Badge from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import { ErrorNote, Spinner } from '../../components/common/Feedback'

function clusterKey(e) {
  return `${e.venueRoomId}__${e.date}`
}

export default function AdminApprovals() {
  const { user } = useAuth()
  const { data: pending, loading } = useLiveData(() => listEvents({ status: EVENT_STATUS.PENDING }), [])
  const { data: rooms } = useLiveData(() => listRooms(), [])
  const { data: profiles } = useLiveData(() => listProfiles(), [])

  const roomName = (id) => rooms?.find((r) => r.id === id)?.name ?? id
  const requesterName = (id) => profiles?.find((p) => p.id === id)?.name ?? 'Someone'

  const clusters = {}
  for (const e of pending ?? []) {
    const key = clusterKey(e)
    clusters[key] = clusters[key] || []
    clusters[key].push(e)
  }
  // Within a venue+date cluster, only events whose times actually overlap are "competing";
  // still shown together since they share the venue/day, for easy scanning.

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Venue approvals</h1>
        <p className="text-sm text-slate-500">Compare competing requests and decide. Overriding the suggested score requires a reason.</p>
      </div>

      {Object.keys(clusters).length === 0 ? (
        <EmptyState icon="✅" title="No pending requests" hint="New venue requests will appear here for review." />
      ) : (
        Object.entries(clusters).map(([key, items]) => {
          const sorted = [...items].sort((a, b) => b.priorityScore - a.priorityScore)
          const topScore = sorted[0]?.priorityScore
          return (
            <section key={key} className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">
                  {roomName(items[0].venueRoomId)} · {items[0].date}
                </h2>
                {items.length > 1 && <Badge tone="amber">{items.length} competing requests</Badge>}
              </div>
              <div className="flex flex-col gap-3">
                {sorted.map((e) => (
                  <RequestRow
                    key={e.id}
                    event={e}
                    isTop={e.priorityScore === topScore}
                    requesterName={requesterName(e.requestedBy)}
                    roomName={roomName(e.venueRoomId)}
                    adminId={user.id}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

function RequestRow({ event, isTop, requesterName, roomName, adminId }) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState(null) // 'approve' | 'decline'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [alternatives, setAlternatives] = useState(null)

  async function decide(decision) {
    setBusy(true)
    setError(null)
    try {
      await decideEvent(event.id, {
        decision,
        reason,
        byUserId: adminId,
        overridden: decision === 'approved' && !isTop,
      })
      if (decision === 'declined') {
        const alts = await suggestAlternativeVenues({
          date: event.date,
          start: event.start,
          end: event.end,
          excludeRoomId: event.venueRoomId,
          audienceSize: event.audienceSize,
        })
        setAlternatives(alts)
      }
      setMode(null)
      setReason('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800">
            {event.title} {isTop && <Badge tone="green">top suggested</Badge>}
          </p>
          <p className="text-xs text-slate-500">
            by {requesterName} · {formatTimeRange(event.start, event.end)} · {event.audienceSize} attendees ·{' '}
            {EVENT_LEVEL_LABELS[event.eventLevel]} {event.externalGuests && '· external guests'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-brand-700">{event.priorityScore}</span>
          <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide' : 'Why?'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-2 text-xs sm:grid-cols-5">
          {event.scoreBreakdown?.map((b) => (
            <div key={b.label}>
              <p className="text-slate-400">{b.label}</p>
              <p className="font-semibold text-slate-700">
                {b.points}/{b.max}
              </p>
            </div>
          ))}
        </div>
      )}

      <ErrorNote error={error} />

      {mode ? (
        <div className="mt-3 flex flex-col gap-2">
          {mode === 'approve' && !isTop && (
            <p className="text-xs text-amber-700">This isn't the top-scored request in this cluster — record why you're approving it.</p>
          )}
          <textarea
            className="input"
            rows={2}
            placeholder={mode === 'approve' ? 'Reason (required if overriding the score)' : 'Reason (optional, shown to the requester)'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button className={mode === 'approve' ? 'btn-primary flex-1' : 'btn-danger flex-1'} disabled={busy} onClick={() => decide(mode === 'approve' ? 'approved' : 'declined')}>
              {busy ? 'Saving…' : `Confirm ${mode}`}
            </button>
            <button className="btn-secondary" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button className="btn-primary flex-1" onClick={() => setMode('approve')}>
            Approve
          </button>
          <button className="btn-danger flex-1" onClick={() => setMode('decline')}>
            Decline
          </button>
        </div>
      )}

      {alternatives && (
        <div className="mt-3 rounded-lg bg-blue-50 p-2 text-xs text-blue-700 ring-1 ring-inset ring-blue-200">
          {alternatives.length === 0
            ? 'No alternative venues free at this time.'
            : `Declined. Free alternatives for ${roomName}'s slot: ${alternatives.map((a) => a.name).join(', ')}.`}
        </div>
      )}
    </div>
  )
}
