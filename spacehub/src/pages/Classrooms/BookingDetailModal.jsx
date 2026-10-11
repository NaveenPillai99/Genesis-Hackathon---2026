import { useState } from 'react'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import { ErrorNote } from '../../components/common/Feedback'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import {
  cancelRoomBooking,
  adminCancelBooking,
  getProfile,
  joinRoomWaitlist,
  leaveRoomWaitlist,
  listRoomWaitlist,
} from '../../lib/dataClient'
import { formatTimeRange } from '../../lib/time'
import { CAN_JOIN_ROOM_WAITLIST, ROLES } from '../../lib/constants'
import CheckInModal from '../../components/qr/CheckInModal'

export default function BookingDetailModal({ open, onClose, room, booking, slotId, date }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [purpose, setPurpose] = useState('')
  const { data: booker } = useLiveData(
    () => (booking ? getProfile(booking.bookedBy) : Promise.resolve(null)),
    [booking?.id]
  )

  const effectiveSlotId = slotId ?? booking?.slotId
  const effectiveDate = date ?? booking?.date

  const { data: queue } = useLiveData(
    () =>
      room && effectiveSlotId && effectiveDate
        ? listRoomWaitlist({ roomId: room.id, date: effectiveDate, slotId: effectiveSlotId })
        : Promise.resolve([]),
    [room?.id, effectiveDate, effectiveSlotId]
  )

  if (!booking || !room) return null

  const isMine = booking.bookedBy === user.id
  const isAdmin = user.role === ROLES.ADMIN || user.role === ROLES.RESOURCE_ADMIN
  const waitlist = queue ?? []
  const myEntry = waitlist.find((w) => w.userId === user.id)
  const canQueue = CAN_JOIN_ROOM_WAITLIST.has(user.role) && !isMine

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    await run(async () => {
      if (isAdmin && !isMine) {
        const reason = window.prompt('Reason for cancelling this booking (shown to the user):') || 'Cancelled by admin'
        await adminCancelBooking(booking.id, reason)
      } else {
        await cancelRoomBooking(booking.id)
      }
      onClose()
    })
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

          {/* ------- FCFS queue for this slot ------- */}
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Waiting list</p>
              <Badge tone={waitlist.length ? 'blue' : 'slate'}>
                {waitlist.length === 0 ? 'Nobody waiting' : `${waitlist.length} in queue`}
              </Badge>
            </div>

            {waitlist.length > 0 && (
              <ol className="mt-2 flex flex-col gap-1">
                {waitlist.map((w) => (
                  <li
                    key={w.id}
                    className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                      w.userId === user.id ? 'bg-brand-50 font-semibold text-brand-800' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="truncate">
                      #{w.position} {w.userId === user.id ? 'You' : w.userName}
                      {w.purpose ? ` — ${w.purpose}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <p className="mt-2 text-[11px] text-slate-400">
              First come, first served. If this booking is cancelled or auto-released for no check-in, the slot passes
              to whoever is first in line automatically.
            </p>

            {canQueue && !myEntry && (
              <div className="mt-2 flex flex-col gap-2">
                <input
                  className="input !py-1.5 text-xs"
                  placeholder="What you'd use it for (optional)"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
                <button
                  className="btn-secondary !py-1.5 text-xs"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      joinRoomWaitlist({
                        roomId: room.id,
                        date: effectiveDate,
                        slotId: effectiveSlotId,
                        userId: user.id,
                        userRole: user.role,
                        purpose,
                      })
                    )
                  }
                >
                  {busy ? 'Joining…' : `Join queue${waitlist.length ? ` (you'd be #${waitlist.length + 1})` : ''}`}
                </button>
              </div>
            )}

            {myEntry && (
              <button
                className="btn-secondary mt-2 !py-1.5 text-xs"
                disabled={busy}
                onClick={() => run(() => leaveRoomWaitlist(myEntry.id, { byUserId: user.id }))}
              >
                {busy ? 'Leaving…' : `Leave queue (you're #${myEntry.position})`}
              </button>
            )}
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
                {busy
                  ? 'Cancelling…'
                  : isAdmin && !isMine
                    ? 'Cancel (override)'
                    : waitlist.length > 0
                      ? `Cancel — passes to ${waitlist[0].userId === user.id ? 'next in line' : waitlist[0].userName}`
                      : 'Cancel booking'}
              </button>
            </div>
          )}
        </div>
      </Modal>
      <CheckInModal
        booking={booking}
        room={room}
        open={checkInOpen}
        onClose={() => {
          setCheckInOpen(false)
          onClose()
        }}
      />
    </>
  )
}
