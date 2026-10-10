import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { getAvailability, listRooms } from '../../lib/dataClient'
import { upcomingDates } from '../../lib/time'
import { CAN_BOOK_CLASSROOM, ROLES, ROOM_TYPES } from '../../lib/constants'
import { Spinner } from '../../components/common/Feedback'
import EmptyState from '../../components/common/EmptyState'
import ReportIssueModal from '../../components/common/ReportIssueModal'
import BookingModal from './BookingModal'
import BookingDetailModal from './BookingDetailModal'
import BlockDateModal from './BlockDateModal'

const STATUS_STYLE = {
  free: 'bg-white hover:bg-brand-50 border-slate-200 text-slate-400 cursor-pointer',
  timetable: 'bg-slate-100 border-slate-200 text-slate-600',
  booked: 'bg-amber-100 border-amber-200 text-amber-800 cursor-pointer',
  checked_in: 'bg-emerald-100 border-emerald-200 text-emerald-800 cursor-pointer',
  blocked: 'bg-rose-50 border-rose-200 text-rose-500',
  maintenance: 'bg-rose-50 border-rose-200 text-rose-500',
}

export default function ClassroomBoard() {
  const { user } = useAuth()
  const dates = upcomingDates(10)
  // Default to the first selectable (weekday) date — todayISO() can be a
  // weekend, which wouldn't match any of the date chips below.
  const [date, setDate] = useState(dates[0].iso)
  const [bookingTarget, setBookingTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [blockTarget, setBlockTarget] = useState(null)
  const [issueTarget, setIssueTarget] = useState(null)

  const { data: rooms } = useLiveData(() => listRooms({ type: ROOM_TYPES.CLASSROOM }), [])
  const { data: board, loading } = useLiveData(
    () => getAvailability({ date, roomIds: (rooms ?? []).map((r) => r.id) }),
    [date, rooms?.length]
  )

  const canBook = CAN_BOOK_CLASSROOM.has(user.role)
  const isAdmin = user.role === ROLES.ADMIN

  function onCellClick(room, slot) {
    if (slot.status === 'free') {
      if (canBook) setBookingTarget({ room, slot })
      return
    }
    if (slot.status === 'booked' || slot.status === 'checked_in') {
      setDetailTarget({ room, booking: slot.booking })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Classrooms</h1>
        <p className="text-sm text-slate-500">
          {canBook
            ? 'Free, first-come-first-served. Timetabled classes are always blocked.'
            : 'View only — ask your class representative or faculty to book a slot.'}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {dates.map((d) => (
          <button
            key={d.iso}
            onClick={() => setDate(d.iso)}
            className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              date === d.iso ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
            }`}
          >
            <span>{d.weekday.slice(0, 3)}</span>
            <span>{d.label.split(', ')[1] ?? d.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <Legend swatch="bg-white border-slate-300" label="Free" />
        <Legend swatch="bg-slate-100 border-slate-200" label="Timetabled class" />
        <Legend swatch="bg-amber-100 border-amber-200" label="Booked" />
        <Legend swatch="bg-emerald-100 border-emerald-200" label="Checked in" />
        <Legend swatch="bg-rose-50 border-rose-200" label="Blocked / maintenance" />
      </div>

      {loading ? (
        <Spinner />
      ) : !board || board.length === 0 ? (
        <EmptyState title="No rooms found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-slate-500">Room</th>
                {board[0].slots.map((s) => (
                  <th key={s.id} className="px-2 py-2 text-center font-semibold text-slate-500">
                    {s.label}
                    <div className="font-normal text-slate-400">{s.start}</div>
                  </th>
                ))}
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {board.map(({ room, slots }) => (
                <tr key={room.id} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 align-top">
                    <p className="font-bold text-slate-800">{room.name}</p>
                    <p className="text-[11px] text-slate-400">{room.building} · {room.capacity} seats</p>
                  </td>
                  {slots.map((slot) => (
                    <td key={slot.id} className="p-1 align-top">
                      <button
                        type="button"
                        onClick={() => onCellClick(room, slot)}
                        title={
                          slot.status === 'timetable'
                            ? `${slot.timetable.code ?? ''} ${slot.timetable.courseName}`.trim()
                            : slot.status === 'blocked'
                              ? slot.reason
                              : undefined
                        }
                        className={`flex h-14 w-24 flex-col items-center justify-center rounded-lg border px-1 text-center text-[10px] font-medium leading-tight ${STATUS_STYLE[slot.status]}`}
                      >
                        {slot.status === 'free' && 'Free'}
                        {slot.status === 'timetable' && (
                          <>
                            <span className="w-full truncate font-bold">{slot.timetable.code ?? slot.timetable.courseName}</span>
                            {slot.timetable.code && <span className="w-full truncate">{slot.timetable.courseName}</span>}
                          </>
                        )}
                        {(slot.status === 'booked' || slot.status === 'checked_in') && (
                          <>
                            <span className="font-bold">{slot.status === 'checked_in' ? 'Checked in' : 'Booked'}</span>
                            <span className="w-full truncate">{slot.booking.purpose}</span>
                          </>
                        )}
                        {slot.status === 'blocked' && 'Blocked'}
                        {slot.status === 'maintenance' && 'Maintenance'}
                      </button>
                    </td>
                  ))}
                  <td className="p-1">
                    <div className="flex flex-col gap-1">
                      {isAdmin && (
                        <button
                          className="rounded-md px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                          onClick={() => setBlockTarget(room)}
                        >
                          Block date
                        </button>
                      )}
                      <button
                        className="rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
                        onClick={() => setIssueTarget(room)}
                      >
                        Report issue
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookingModal
        open={!!bookingTarget}
        onClose={() => setBookingTarget(null)}
        room={bookingTarget?.room}
        date={date}
        slot={bookingTarget?.slot}
      />
      <BookingDetailModal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        room={detailTarget?.room}
        booking={detailTarget?.booking}
      />
      <BlockDateModal open={!!blockTarget} onClose={() => setBlockTarget(null)} room={blockTarget} date={date} />
      <ReportIssueModal
        open={!!issueTarget}
        onClose={() => setIssueTarget(null)}
        targetType="room"
        targetId={issueTarget?.id}
        targetLabel={issueTarget?.name}
      />
    </div>
  )
}

function Legend({ swatch, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded border ${swatch}`} />
      {label}
    </span>
  )
}
