import { useState } from 'react'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import { ErrorNote } from '../../components/common/Feedback'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { cancelRoomBooking, adminCancelBooking, getProfile } from '../../lib/dataClient'
import { formatTimeRange } from '../../lib/time'
import { ROLES } from '../../lib/constants'
import CheckInModal from '../../components/qr/CheckInModal'

export default function BookingDetailModal({ open, onClose, room, booking }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const { data: booker } = useLiveData(() => (booking ? getProfile(booking.bookedBy) : Promise.resolve(null)), [booking?.id])

  if (!booking || !room) return null

  const isMine = booking.bookedBy === user.id
  const isAdmin = user.role === ROLES.ADMIN

  async function cancel() {
    setBusy(true)
    setError(null)
    try {
      if (isAdmin && !isMine) {
        const reason = window.prompt('Reason for cancelling this booking (shown to the user):') || 'Cancelled by admin'
        await adminCancelBooking(booking.id, reason)
      } else {
        await cancelRoomBooking(booking.id)
      }
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal open={open && !checkInOpen} onClose={onClose} title={room.name}>
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p className="font-semibold text-slate-800">{booking.date}</p>
            <p className="text-slate-500">{formatTimeRange(booking.start, booking.end)}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Booked by</span>
            <span className="font-semibold text-slate-800">{isMine ? 'You' : booker?.name ?? '…'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Purpose</span>
            <span className="font-semibold text-slate-800">{booking.purpose}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Status</span>
            <Badge tone={booking.status === 'checked_in' ? 'green' : 'amber'}>{booking.status.replace('_', ' ')}</Badge>
          </div>

          <ErrorNote error={error} />

          {(isMine || isAdmin) && (
            <div className="flex gap-2 border-t border-slate-100 pt-3">
              {isMine && booking.status === 'booked' && (
                <button className="btn-primary flex-1" onClick={() => setCheckInOpen(true)}>
                  Check in
                </button>
              )}
              <button className="btn-danger flex-1" disabled={busy} onClick={cancel}>
                {busy ? 'Cancelling…' : isAdmin && !isMine ? 'Cancel (override)' : 'Cancel booking'}
              </button>
            </div>
          )}
        </div>
      </Modal>
      <CheckInModal booking={booking} room={room} open={checkInOpen} onClose={() => { setCheckInOpen(false); onClose() }} />
    </>
  )
}
