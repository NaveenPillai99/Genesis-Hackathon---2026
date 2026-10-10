import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { createEventRequest, listRooms } from '../../lib/dataClient'
import { computePriorityScore } from '../../lib/priorityScore'
import { todayISO } from '../../lib/time'
import { EVENT_LEVELS, EVENT_LEVEL_LABELS, ROOM_TYPES } from '../../lib/constants'
import { ErrorNote } from '../../components/common/Feedback'

export default function RequestVenue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: venues } = useLiveData(() => listRooms({ type: ROOM_TYPES.EVENT_VENUE }), [])

  const [form, setForm] = useState({
    title: '',
    description: '',
    venueRoomId: '',
    date: todayISO(),
    start: '17:00',
    end: '19:00',
    audienceSize: 100,
    eventLevel: 'club',
    academic: true,
    externalGuests: false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const venue = venues?.find((v) => v.id === form.venueRoomId)

  const preview = useMemo(() => {
    const today = new Date(`${todayISO()}T00:00:00`)
    const target = new Date(`${form.date}T00:00:00`)
    const daysAhead = Math.round((target - today) / 86400000)
    return computePriorityScore({
      eventLevel: form.eventLevel,
      academic: form.academic,
      audienceSize: Number(form.audienceSize) || 0,
      roomCapacity: venue?.capacity ?? 0,
      daysAhead,
      externalGuests: form.externalGuests,
    })
  }, [form, venue])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createEventRequest({
        ...form,
        audienceSize: Number(form.audienceSize) || 0,
        requestedBy: user.id,
      })
      navigate('/events')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-extrabold text-slate-900">Request a venue</h1>
      <p className="mb-5 text-sm text-slate-500">
        This places a tentative hold, not a confirmed booking. An admin will decide between any competing requests.
      </p>

      <div className="grid gap-5 lg:grid-cols-[1fr,260px]">
        <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
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
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Academic event" checked={form.academic} onChange={(v) => set('academic', v)} />
            <Toggle label="External guests" checked={form.externalGuests} onChange={(v) => set('externalGuests', v)} />
          </div>
          <ErrorNote error={error} />
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <aside className="card h-fit p-5">
          <p className="label mb-1">Suggested priority score</p>
          <p className="mb-3 text-3xl font-extrabold text-brand-700">
            {preview.score}
            <span className="text-base font-semibold text-slate-400">/{preview.max}</span>
          </p>
          <div className="flex flex-col gap-2">
            {preview.breakdown.map((b) => (
              <div key={b.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{b.label}</span>
                <span className="font-semibold text-slate-700">
                  {b.points}/{b.max}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Shown to the admin to help decide between competing requests. They can always override it, but must record why.
          </p>
        </aside>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition ${
        checked ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
      }`}
    >
      {label}
      <span className={`ml-2 h-4 w-7 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}>
        <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-3' : ''}`} />
      </span>
    </button>
  )
}
