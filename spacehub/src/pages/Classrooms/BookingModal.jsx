import { useEffect, useState } from 'react'
import Modal from '../../components/common/Modal'
import { ErrorNote } from '../../components/common/Feedback'
import { useAuth } from '../../context/AuthContext'
import { createRoomBooking, getWeeklyBookedHours } from '../../lib/dataClient'
import { formatTimeRange, durationHours } from '../../lib/time'
import { WEEKLY_HOUR_CAP } from '../../lib/constants'

export default function BookingModal({ open, onClose, room, date, slot, onBooked }) {
  const { user } = useAuth()
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [weeklyUsed, setWeeklyUsed] = useState(null)

  const cap = WEEKLY_HOUR_CAP[user.role]

  useEffect(() => {
    if (!open) return
    setPurpose('')
    setError(null)
    if (cap) getWeeklyBookedHours(user.id, date).then(setWeeklyUsed)
  }, [open, date, user.id, cap])

  if (!room || !slot) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createRoomBooking({
        roomId: room.id,
        date,
        slotId: slot.id,
        userId: user.id,
        userRole: user.role,
        purpose,
      })
      onBooked?.()
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const thisHours = durationHours(slot.start, slot.end)

  return (
    <Modal open={open} onClose={onClose} title={`Book ${room.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <p className="font-semibold text-slate-800">{date}</p>
          <p className="text-slate-500">{formatTimeRange(slot.start, slot.end)}</p>
        </div>
        {cap && weeklyUsed !== null && (
          <p className="text-xs text-slate-500">
            Weekly cap: {weeklyUsed}/{cap} hrs used this week · this booking adds {thisHours} hr
            {thisHours !== 1 ? 's' : ''}.
          </p>
        )}
        <div>
          <label className="label">Purpose</label>
          <input
            className="input"
            placeholder="e.g. Project discussion, extra class"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>
        <ErrorNote error={error} />
        <button className="btn-primary" disabled={busy} type="submit">
          {busy ? 'Booking…' : 'Confirm booking'}
        </button>
      </form>
    </Modal>
  )
}
