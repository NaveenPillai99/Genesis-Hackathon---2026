import { useMemo, useState } from 'react'
import Modal from '../../components/common/Modal'
import { ErrorNote } from '../../components/common/Feedback'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { listProfiles, requestFacilityAccess } from '../../lib/dataClient'
import { todayISO, addHoursToTime, formatTimeRange } from '../../lib/time'
import { CAN_BE_FACILITY_MENTOR, NEEDS_FACILITY_MENTOR } from '../../lib/constants'

const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 3, 4]

/**
 * No induction gate — access is requested instead.
 * Submitted -> [Faculty Approval Pending ->] Facility Admin Review ->
 * Approved / Rejected / Alternative Suggested. Students/class reps need a
 * faculty mentor's sign-off first; faculty/admin requests go straight to
 * the facility administrator (NEEDS_FACILITY_MENTOR).
 */
export default function RequestAccessModal({ open, onClose, facility }) {
  const { user } = useAuth()
  const needsMentor = NEEDS_FACILITY_MENTOR.has(user.role)
  const isCompute = facility?.allocationModel === 'compute_time'
  const { data: profiles } = useLiveData(() => (needsMentor ? listProfiles() : Promise.resolve([])), [needsMentor])
  const mentors = (profiles ?? []).filter((p) => CAN_BE_FACILITY_MENTOR.has(p.role))

  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState('10:00')
  const [durationHoursValue, setDurationHoursValue] = useState(1)
  const [nodeHours, setNodeHours] = useState(5)
  const [mentorId, setMentorId] = useState('')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const end = useMemo(() => addHoursToTime(start, durationHoursValue), [start, durationHoursValue])

  if (!facility) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestFacilityAccess({
        facilityId: facility.id,
        requestedBy: user.id,
        requesterRole: user.role,
        mentorId: needsMentor ? mentorId : null,
        date,
        start,
        end,
        durationMinutes: Math.round(durationHoursValue * 60),
        nodeHoursRequested: isCompute ? Number(nodeHours) : null,
        purpose,
      })
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  function handleClose() {
    setDone(false)
    setPurpose('')
    setMentorId('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Request access — ${facility.name}`}>
      {done ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
            {needsMentor
              ? "✓ Sent to your mentor for approval. Once they approve, it goes to the facility administrator's review."
              : '✓ Sent straight to the facility administrator for review.'}
          </div>
          <button className="btn-secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Date</label>
              <input required type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Start time</label>
              <input required type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label">Duration</label>
              <select className="input" value={durationHoursValue} onChange={(e) => setDurationHoursValue(Number(e.target.value))}>
                {DURATION_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h === 0.5 ? '30 min' : `${h} hr${h !== 1 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="-mt-1 text-xs text-slate-400">Ends at {formatTimeRange(start, end)}.</p>
          {isCompute && (
            <div>
              <label className="label">Node-hours needed</label>
              <input
                required
                type="number"
                min={1}
                className="input"
                value={nodeHours}
                onChange={(e) => setNodeHours(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label">Reason / purpose</label>
            <textarea
              required
              className="input"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Printing a capstone-project enclosure"
            />
          </div>
          {needsMentor && (
            <div>
              <label className="label">Faculty mentor / supervisor (gives first approval)</label>
              <select required className="input" value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
                <option value="">Choose…</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.department ? `— ${m.department}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!needsMentor && (
            <p className="text-xs text-slate-400">No mentor needed — this goes straight to the facility administrator.</p>
          )}
          <ErrorNote error={error} />
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}
    </Modal>
  )
}
