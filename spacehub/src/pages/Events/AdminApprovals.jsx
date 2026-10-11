import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import {
  decideEvent,
  autoDecideCluster,
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
  return `${e.venueRoomId || e.venue_id}__${e.date || e.event_date}`
}

export default function AdminApprovals() {
  const { user } = useAuth()
  const { data: pending, loading } = useLiveData(() => listEvents({ status: EVENT_STATUS.PENDING }), [])
  const { data: rooms } = useLiveData(() => listRooms(), [])
  const { data: profiles } = useLiveData(() => listProfiles(), [])

  const roomName = (id) => rooms?.find((r) => r.id === id)?.name ?? id
  const requesterName = (id, fallback) => profiles?.find((p) => p.id === id)?.name ?? fallback ?? 'Authorized User'

  const clusters = {}
  for (const e of pending ?? []) {
    const key = clusterKey(e)
    clusters[key] = clusters[key] || []
    clusters[key].push(e)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Intelligent Venue Approvals &amp; Clash Resolution</h1>
          <p className="text-sm text-slate-500">
            Constraint-aware, priority-based slot booking: P = (0.60 × R) + (0.40 × E). Overriding requires documented justification.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600">
          <span className="font-bold text-brand-700">Policy:</span>
          <span>Role (60%) + Purpose (40%)</span>
        </div>
      </div>

      {Object.keys(clusters).length === 0 ? (
        <EmptyState icon="✅" title="No pending requests" hint="New venue requests will appear here for priority review." />
      ) : (
        Object.entries(clusters).map(([key, items]) => {
          const sorted = [...items].sort((a, b) => {
            const scoreA = a.combined_priority_score ?? a.combinedPriorityScore ?? a.priorityScore ?? 0
            const scoreB = b.combined_priority_score ?? b.combinedPriorityScore ?? b.priorityScore ?? 0
            if (scoreB !== scoreA) {
              return scoreB - scoreA // Descending priority score
            }
            // Submission time / created_at as stable tie-breaker (earlier first)
            const timeA = new Date(a.createdAt || a.created_at || a.date || 0).getTime()
            const timeB = new Date(b.createdAt || b.created_at || b.date || 0).getTime()
            return timeA - timeB
          })
          const topScore = sorted[0]?.combined_priority_score ?? sorted[0]?.priorityScore
          const isAuthorizedStaff = ['resource_admin', 'sys_admin', 'faculty', 'campus_director', 'dean', 'principal', 'hod'].includes(user?.role)

          return (
            <section key={key} className="card p-4 border border-slate-200 shadow-sm">
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-800">
                    🏛️ {roomName(items[0].venueRoomId || items[0].venue_id)} · 📅 {items[0].date || items[0].event_date}
                  </span>
                </div>
                {items.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await autoDecideCluster({
                            venueRoomId: items[0].venueRoomId || items[0].venue_id,
                            date: items[0].date || items[0].event_date,
                          })
                          window.location.reload()
                        } catch (err) {
                          alert(err.message)
                        }
                      }}
                      className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[11px] px-3 py-1.5 shadow-sm transition flex items-center gap-1.5"
                    >
                      <span>⚡</span>
                      <span>Auto-Decide &amp; Allocate Alternatives (AI Model)</span>
                    </button>
                    <Badge tone="amber">
                      ⚠️ {items.length} competing requests
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {sorted.map((e, idx) => (
                  <RequestRow
                    key={e.id}
                    event={e}
                    rank={idx + 1}
                    isTop={idx === 0}
                    requesterName={requesterName(e.requestedBy || e.organizer_id, e.organizer)}
                    roomName={roomName(e.venueRoomId || e.venue_id)}
                    adminId={user.id}
                    isAuthorizedStaff={isAuthorizedStaff}
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

function RequestRow({ event, rank, isTop, requesterName, roomName, adminId, isAuthorizedStaff }) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState(null) // 'approve' | 'decline'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [alternatives, setAlternatives] = useState(null)

  const priorityScore = event.combined_priority_score ?? event.combinedPriorityScore ?? event.priorityScore ?? 45
  const roleScore = event.role_score ?? event.roleScore ?? 35
  const purposeScore = event.purpose_score ?? event.purposeScore ?? 55
  const eventPurpose = event.event_purpose ?? event.eventPurpose ?? event.purpose ?? 'Meeting / Discussion'
  const recommendedAction = event.recommended_action ?? (isTop ? 'RECOMMEND_APPROVAL' : 'RECOMMEND_ALTERNATIVES')

  const offeredAlts = event.offered_alternatives
    ? (typeof event.offered_alternatives === 'string' ? JSON.parse(event.offered_alternatives) : event.offered_alternatives)
    : null

  async function decide(decision) {
    if (decision === 'approved' && !isTop && (!reason || reason.trim().length < 5)) {
      setError(new Error('Written justification (at least 5 characters) is required when approving a lower-priority request over a competing higher-ranked request.'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      await decideEvent(event.id, {
        decision,
        reason,
        override_justification: !isTop ? reason : null,
        byUserId: adminId,
        overridden: decision === 'approved' && !isTop,
      })
      if (decision === 'declined' || decision === 'rejected') {
        const alts = await suggestAlternativeVenues({
          date: event.date || event.event_date,
          start: event.start || event.start_slot,
          end: event.end || event.end_slot,
          excludeRoomId: event.venueRoomId || event.venue_id,
          audienceSize: event.audienceSize || event.expected_audience,
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
    <div className={`rounded-lg border p-3.5 transition ${isTop ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-extrabold ${isTop ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
              #{rank}
            </span>
            <p className="font-extrabold text-slate-900 text-sm">{event.title || event.name}</p>
            {recommendedAction === 'RECOMMEND_APPROVAL' ? (
              <Badge tone="green">✓ Top Recommended</Badge>
            ) : (
              <Badge tone="amber">🔄 Lower Priority · Consider Alternatives</Badge>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
              {eventPurpose}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Requester: <span className="font-medium text-slate-700">{requesterName}</span> ·{' '}
            Time: <span className="font-medium text-slate-700">{formatTimeRange(event.start || event.start_slot, event.end || event.end_slot)}</span> ·{' '}
            Audience: <span className="font-medium text-slate-700">{event.audienceSize || event.expected_audience || 100}</span> attendees
          </p>
        </div>

        {isAuthorizedStaff && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-[11px] font-bold text-slate-400">P =</span>
                <span className="text-base font-black text-brand-700">{priorityScore}</span>
                <span className="text-[10px] text-slate-400">/ 100</span>
              </div>
              <span className="block text-[10px] text-slate-500 font-mono">
                (0.60×{roleScore}) + (0.40×{purposeScore})
              </span>
            </div>
            <button
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:underline px-2 py-1 bg-brand-50 rounded"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Hide Breakdown' : 'Score Details'}
            </button>
          </div>
        )}
      </div>

      {expanded && isAuthorizedStaff && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs border border-slate-200 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
            <div className="p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-400 block text-[10px]">ROLE AUTHORITY (R)</span>
              <span className="text-sm font-bold text-slate-800">{roleScore} / 100</span>
              <span className="text-[10px] text-purple-600 block mt-0.5">Weight: 60%</span>
            </div>
            <div className="p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-400 block text-[10px]">EVENT PURPOSE (E)</span>
              <span className="text-sm font-bold text-slate-800">{purposeScore} / 100</span>
              <span className="text-[10px] text-purple-600 block mt-0.5">Weight: 40%</span>
            </div>
            <div className="p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-400 block text-[10px]">COMBINED SCORE (P)</span>
              <span className="text-sm font-black text-brand-700">{priorityScore} / 100</span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">Continuous scale</span>
            </div>
            <div className="p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-400 block text-[10px]">TIE-BREAKER RULE</span>
              <span className="text-xs font-bold text-slate-700">Timestamp + ID</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Deterministic</span>
            </div>
          </div>

          {offeredAlts && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <p className="text-xs font-bold text-slate-700 mb-1">🎯 Pre-computed Feasible Alternatives for this request:</p>
              {offeredAlts.venues && offeredAlts.venues.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Alternative Venues (Same slot):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {offeredAlts.venues.map((v) => (
                      <div key={v.venue_id} className="p-1.5 rounded bg-white border border-slate-200 text-[11px]">
                        <span className="font-bold text-slate-800">{v.venue_name}</span> ({v.capacity} seats)
                        <span className="block text-emerald-600 text-[10px]">Suitability: {v.suitability_score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ErrorNote error={error} />

      {mode ? (
        <div className="mt-3 flex flex-col gap-2 p-3 rounded-lg bg-amber-50/50 border border-amber-200">
          {mode === 'approve' && !isTop && (
            <p className="text-xs font-bold text-amber-800">
              ⚠️ Strict Policy Requirement: Request #{rank} has a lower priority score ({priorityScore}) than competing top request. A written justification is mandatory and will be recorded in the immutable audit trail.
            </p>
          )}
          <textarea
            className="input text-xs"
            rows={2}
            placeholder={
              mode === 'approve' && !isTop
                ? 'Mandatory override justification (e.g., approved by Dean directive, keynote speaker schedule, etc.)'
                : 'Decision notes (optional, recorded in audit log)'
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className={mode === 'approve' ? 'btn-primary flex-1 text-xs' : 'btn-danger flex-1 text-xs'}
              disabled={busy}
              onClick={() => decide(mode === 'approve' ? 'approved' : 'declined')}
            >
              {busy ? 'Saving…' : `Confirm ${mode === 'approve' ? 'Approval' : 'Decline'}`}
            </button>
            <button className="btn-secondary text-xs" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button className="btn-primary flex-1 text-xs" onClick={() => setMode('approve')}>
            {isTop ? '✓ Approve Recommended' : '⚡ Override & Approve'}
          </button>
          <button className="btn-danger flex-1 text-xs" onClick={() => setMode('decline')}>
            ✕ Decline &amp; Offer Alternatives
          </button>
        </div>
      )}

      {alternatives && (
        <div className="mt-3 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-800 ring-1 ring-inset ring-blue-200">
          {alternatives.length === 0
            ? 'No alternative venues free at this time window.'
            : `Feasible alternatives for ${roomName}'s slot: ${alternatives.map((a) => `${a.name} (${a.capacity} cap)`).join(', ')}.`}
        </div>
      )}
    </div>
  )
}
