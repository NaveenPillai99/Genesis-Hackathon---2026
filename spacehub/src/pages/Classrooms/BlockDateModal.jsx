import { useState } from 'react'
import Modal from '../../components/common/Modal'
import { ErrorNote } from '../../components/common/Feedback'
import { useAuth } from '../../context/AuthContext'
import { blockRoomDate } from '../../lib/dataClient'

/** Admin override: block a whole room for a date (exam, maintenance day, ...). */
export default function BlockDateModal({ open, onClose, room, date }) {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!room) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await blockRoomDate({ roomId: room.id, date, reason, byUserId: user.id })
      setReason('')
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Block ${room.name} — ${date}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-slate-500">
          This blocks every bookable slot on this date and cancels any existing bookings. Use for exams, deep cleaning, inspections,
          etc.
        </p>
        <div>
          <label className="label">Reason</label>
          <input required className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. End-sem exam" />
        </div>
        <ErrorNote error={error} />
        <button className="btn-danger" disabled={busy} type="submit">
          {busy ? 'Blocking…' : 'Block this date'}
        </button>
      </form>
    </Modal>
  )
}
