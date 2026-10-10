import { useState } from 'react'
import { ErrorNote } from '../../components/common/Feedback'
import { formatTimeRange } from '../../lib/time'

/** One pending request, with Approve/Decline + an optional reason, used for
 * both the mentor stage and the lab in-charge stage (just pass a different
 * `onDecide`). */
export default function FacilityRequestRow({ request, facilityName, requesterName, extraLine, onDecide }) {
  const [mode, setMode] = useState(null) // 'approve' | 'decline'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function confirm(decision) {
    setBusy(true)
    setError(null)
    try {
      await onDecide(decision, reason)
      setMode(null)
      setReason('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3">
      <p className="text-sm font-semibold text-slate-800">
        {requesterName} · {facilityName}
      </p>
      <p className="text-xs text-slate-500">
        {request.date} · {formatTimeRange(request.start, request.end)}
        {request.nodeHoursRequested ? ` · ${request.nodeHoursRequested} node-hours` : ''}
      </p>
      <p className="mt-1 text-xs text-slate-600">{request.purpose}</p>
      {extraLine && <p className="mt-1 text-xs text-slate-400">{extraLine}</p>}

      <ErrorNote error={error} />

      {mode ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            className="input"
            rows={2}
            placeholder={mode === 'approve' ? 'Reason (optional)' : 'Reason (shown to the requester)'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className={mode === 'approve' ? 'btn-primary flex-1' : 'btn-danger flex-1'}
              disabled={busy}
              onClick={() => confirm(mode === 'approve' ? 'approved' : 'declined')}
            >
              {busy ? 'Saving…' : `Confirm ${mode}`}
            </button>
            <button className="btn-secondary" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button className="btn-primary flex-1 !px-3 !py-1.5 text-xs" onClick={() => setMode('approve')}>
            Approve
          </button>
          <button className="btn-danger flex-1 !px-3 !py-1.5 text-xs" onClick={() => setMode('decline')}>
            Decline
          </button>
        </div>
      )}
    </div>
  )
}
