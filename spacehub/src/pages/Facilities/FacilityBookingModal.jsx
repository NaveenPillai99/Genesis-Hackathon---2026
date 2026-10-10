import { useState } from 'react'
import Modal from '../../components/common/Modal'
import { ErrorNote } from '../../components/common/Feedback'
import { useAuth } from '../../context/AuthContext'
import { createFacilityBooking } from '../../lib/dataClient'
import { todayISO } from '../../lib/time'

export default function FacilityBookingModal({ open, onClose, facility }) {
  const { user } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('11:00')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  if (!facility) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createFacilityBooking({ facilityId: facility.id, userId: user.id, date, start, end, purpose })
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
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Book ${facility.name}`}>
      {done ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
            ✓ Booked for {date}, {start}–{end}.
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
              <label className="label">Start</label>
              <input required type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label">End</label>
              <input required type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Purpose</label>
            <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Capstone prototype" />
          </div>
          <ErrorNote error={error} />
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? 'Booking…' : 'Confirm booking'}
          </button>
        </form>
      )}
    </Modal>
  )
}
