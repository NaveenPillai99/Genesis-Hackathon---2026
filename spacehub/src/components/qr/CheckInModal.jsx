import { useState } from 'react'
import Modal from '../common/Modal'
import RoomQR from './RoomQR'
import { ErrorNote } from '../common/Feedback'
import { checkInBooking } from '../../lib/dataClient'
import { formatTimeRange } from '../../lib/time'

export default function CheckInModal({ booking, room, open, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  if (!booking || !room) return null

  async function handleScan() {
    setBusy(true)
    setError(null)
    try {
      await checkInBooking(booking.id)
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Check in — ${room.name}`}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-slate-600">
          {formatTimeRange(booking.start, booking.end)} · scan the QR code on the door to confirm you're here.
          Not checking in within 15 minutes auto-releases the room.
        </p>
        <RoomQR roomId={room.id} bookingId={booking.id} />
        <p className="text-center text-xs text-slate-400">
          Pilot note: camera scanning isn't wired up yet — tap below to simulate scanning this code.
        </p>
        <ErrorNote error={error} />
        {done ? (
          <div className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            ✓ Checked in — the room is yours.
          </div>
        ) : (
          <button className="btn-primary w-full" disabled={busy} onClick={handleScan}>
            {busy ? 'Checking in…' : 'Simulate scan — check in'}
          </button>
        )}
      </div>
    </Modal>
  )
}
