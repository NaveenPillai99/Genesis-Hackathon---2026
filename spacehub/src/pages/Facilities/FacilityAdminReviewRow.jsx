import { useState } from 'react'
import { ErrorNote } from '../../components/common/Feedback'
import { formatTimeRange, addHoursToTime } from '../../lib/time'
import { decideFacilityStage } from '../../lib/dataClient'

const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 3, 4]

/** Facility administrator's review of one pending request: approve, reject, or suggest a different slot. */
export default function FacilityAdminReviewRow({ request, facilityName, requesterName, byUserId }) {
  const [mode, setMode] = useState(null) // 'approve' | 'decline' | 'alternative'
  const [reason, setReason] = useState('')
  const [altDate, setAltDate] = useState(request.date)
  const [altStart, setAltStart] = useState(request.start)
  const [altDurationHours, setAltDurationHours] = useState(1)
  const [altNote, setAltNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'alternative') {
        await decideFacilityStage(request.id, {
          decision: 'alternative',
          byUserId,
          reason,
          altDate,
          altStart,
          altEnd: addHoursToTime(altStart, altDurationHours),
          altNote,
        })
      } else {
        await decideFacilityStage(request.id, { decision: mode === 'approve' ? 'approved' : 'declined', byUserId, reason })
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
    <div className="card p-3">
      <p className="text-sm font-semibold text-slate-800">
        {requesterName} · {facilityName}
      </p>
      <p className="text-xs text-slate-500">
        {request.date} · {formatTimeRange(request.start, request.end)}
        {request.nodeHoursRequested ? ` · ${request.nodeHoursRequested} node-hours` : ''}
      </p>
      <p className="mt-1 text-xs text-slate-600">{request.purpose}</p>
      {request.mentorDecidedBy && <p className="mt-1 text-xs text-slate-400">Mentor-approved</p>}

      <ErrorNote error={error} />

      {mode === 'alternative' ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={altDate} onChange={(e) => setAltDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Start</label>
              <input type="time" className="input" value={altStart} onChange={(e) => setAltStart(e.target.value)} />
            </div>
            <div>
              <label className="label">Duration</label>
              <select className="input" value={altDurationHours} onChange={(e) => setAltDurationHours(Number(e.target.value))}>
                {DURATION_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h === 0.5 ? '30 min' : `${h} hr${h !== 1 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder="Note to the requester (optional)"
            value={altNote}
            onChange={(e) => setAltNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={confirm}>
              {busy ? 'Sending…' : 'Send alternative'}
            </button>
            <button className="btn-secondary" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : mode ? (
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
              onClick={confirm}
            >
              {busy ? 'Saving…' : `Confirm ${mode}`}
            </button>
            <button className="btn-secondary" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-primary flex-1 !px-3 !py-1.5 text-xs" onClick={() => setMode('approve')}>
            Approve
          </button>
          <button className="btn-secondary flex-1 !px-3 !py-1.5 text-xs" onClick={() => setMode('alternative')}>
            Suggest alternative
          </button>
          <button className="btn-danger flex-1 !px-3 !py-1.5 text-xs" onClick={() => setMode('decline')}>
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
