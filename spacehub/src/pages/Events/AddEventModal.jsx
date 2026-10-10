import { useState } from 'react'
import Modal from '../../components/common/Modal'
import { ErrorNote } from '../../components/common/Feedback'
import { useAuth } from '../../context/AuthContext'
import { createDirectEvent } from '../../lib/dataClient'
import { todayISO } from '../../lib/time'
import { EVENT_LEVELS, EVENT_LEVEL_LABELS } from '../../lib/constants'

const BLANK = {
  title: '',
  description: '',
  venueRoomId: '',
  date: todayISO(),
  start: '17:00',
  end: '19:00',
  audienceSize: 100,
  eventLevel: 'university',
  academic: true,
  externalGuests: false,
}

/**
 * Event admin publishing a campus event directly — no competing-request
 * workflow, no priority score to beat. Goes straight onto the public feed.
 */
export default function AddEventModal({ open, onClose, venues }) {
  const { user } = useAuth()
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleClose() {
    setForm(BLANK)
    setError(null)
    onClose()
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createDirectEvent({ ...form, audienceSize: Number(form.audienceSize) || 0, createdBy: user.id })
      handleClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add a campus event" wide>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-xs text-slate-500">
          Published straight to the public feed — no approval queue, since you're the one who decides those.
        </p>
        <div>
          <label className="label">Event title</label>
          <input required className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div>
          <label className="label">Venue</label>
          <select required className="input" value={form.venueRoomId} onChange={(e) => set('venueRoomId', e.target.value)}>
            <option value="">Choose a venue…</option>
            {venues?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.capacity} capacity
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Date</label>
            <input required type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label className="label">Start</label>
            <input required type="time" className="input" value={form.start} onChange={(e) => set('start', e.target.value)} />
          </div>
          <div>
            <label className="label">End</label>
            <input required type="time" className="input" value={form.end} onChange={(e) => set('end', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Expected audience size</label>
          <input
            required
            type="number"
            min={1}
            className="input"
            value={form.audienceSize}
            onChange={(e) => set('audienceSize', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Event level</label>
          <div className="flex gap-2">
            {EVENT_LEVELS.map((lvl) => (
              <button
                type="button"
                key={lvl}
                onClick={() => set('eventLevel', lvl)}
                className={`btn-secondary flex-1 !ring-1 ${form.eventLevel === lvl ? '!bg-brand-600 !text-white !ring-brand-600' : ''}`}
              >
                {EVENT_LEVEL_LABELS[lvl]}
              </button>
            ))}
          </div>
        </div>
        <ErrorNote error={error} />
        <button className="btn-primary" disabled={busy} type="submit">
          {busy ? 'Publishing…' : 'Publish event'}
        </button>
      </form>
    </Modal>
  )
}
