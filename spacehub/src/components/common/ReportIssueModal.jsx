import { useState } from 'react'
import Modal from './Modal'
import { ErrorNote } from './Feedback'
import { useAuth } from '../../context/AuthContext'
import { reportMaintenance } from '../../lib/dataClient'

/** "Projector broken" from a room/facility page goes straight to maintenance. */
export default function ReportIssueModal({ open, onClose, targetType, targetId, targetLabel }) {
  const { user } = useAuth()
  const [issue, setIssue] = useState('')
  const [severity, setSeverity] = useState('minor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await reportMaintenance({ targetType, targetId, issue, severity, reportedBy: user.id })
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  function handleClose() {
    setIssue('')
    setSeverity('minor')
    setDone(false)
    setError(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Report an issue — ${targetLabel}`}>
      {done ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
            Thanks — maintenance has been notified.
            {severity === 'serious' && ' This booking target is blocked until it is marked resolved.'}
          </div>
          <button className="btn-secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="label">What's wrong?</label>
            <textarea
              required
              className="input"
              rows={3}
              placeholder="e.g. Projector not turning on"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Severity</label>
            <div className="flex gap-2">
              {['minor', 'serious'].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`btn-secondary flex-1 !ring-1 ${severity === s ? '!bg-brand-600 !text-white !ring-brand-600' : ''}`}
                >
                  {s === 'serious' ? 'Serious — blocks bookings' : 'Minor'}
                </button>
              ))}
            </div>
          </div>
          <ErrorNote error={error} />
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? 'Reporting…' : 'Submit report'}
          </button>
        </form>
      )}
    </Modal>
  )
}
