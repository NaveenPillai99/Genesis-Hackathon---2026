import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { createEventRequest, listRooms } from '../../lib/dataClient'
import { computePriorityScore } from '../../lib/priorityScore'
import { todayISO } from '../../lib/time'
import { EVENT_LEVELS, EVENT_LEVEL_LABELS, ROOM_TYPES } from '../../lib/constants'
import { ErrorNote } from '../../components/common/Feedback'

const EVENT_PURPOSES = [
  { name: 'Meeting / Discussion', score: 100 },
  { name: 'Hackathon / Major Event', score: 90 },
  { name: 'Webinar', score: 75 },
  { name: 'Workshop', score: 65 },
  { name: 'Seminar', score: 55 },
  { name: 'Presentation', score: 45 },
  { name: 'Regular Class', score: 30 },
]

const ROLE_SCORES = {
  campus_director: 100,
  dean: 85,
  principal: 75,
  hod: 65,
  class_advisor: 50,
  faculty: 35,
  class_rep: 20,
  student: 10,
}

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
    eventPurpose: 'Meeting / Discussion',
    academic: true,
    externalGuests: false,
    requiresProjector: true,
    requiresAC: false,
    requiresAudio: false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const venue = venues?.find((v) => v.id === form.venueRoomId)

  // 1. Continuous Priority Calculation P = (0.60 * R) + (0.40 * E)
  const roleScore = ROLE_SCORES[user?.role] || 35
  const selectedPurpose = EVENT_PURPOSES.find((p) => p.name === form.eventPurpose) || EVENT_PURPOSES[0]
  const purposeScore = selectedPurpose.score
  const combinedPriority = Math.round(((0.60 * roleScore) + (0.40 * purposeScore)) * 100) / 100

  // 2. Legacy Sigmoid preview for backward compatibility
  const legacyPreview = useMemo(() => {
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
        event_purpose: form.eventPurpose,
        purpose: form.eventPurpose,
        requires_projector: form.requiresProjector,
        requires_ac: form.requiresAC,
        requires_audio: form.requiresAudio,
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
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-extrabold text-slate-900">Request a campus venue</h1>
      <p className="mb-5 text-sm text-slate-500">
        Constraint-aware priority allocation: competing slots are resolved via verified requester role authority &amp; event purpose.
      </p>

      <div className="grid gap-5 lg:grid-cols-[1fr,280px]">
        <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
          <div>
            <label className="label">Event title</label>
            <input required className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="label">Event purpose &amp; classification</label>
            <select
              className="input font-medium"
              value={form.eventPurpose}
              onChange={(e) => set('eventPurpose', e.target.value)}
            >
              {EVENT_PURPOSES.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} (Purpose Score: {p.score})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Preferred venue</label>
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
            <label className="label">Mandatory Facilities &amp; Equipment</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.requiresProjector}
                  onChange={(e) => set('requiresProjector', e.target.checked)}
                />
                <span>📽️ Projector</span>
              </label>
              <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.requiresAC}
                  onChange={(e) => set('requiresAC', e.target.checked)}
                />
                <span>❄️ Air Conditioning</span>
              </label>
              <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.requiresAudio}
                  onChange={(e) => set('requiresAudio', e.target.checked)}
                />
                <span>🔊 Audio System</span>
              </label>
            </div>
          </div>
          <div>
            <label className="label">Event scope</label>
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
            {busy ? 'Submitting…' : 'Submit venue request'}
          </button>
        </form>

        <aside className="card h-fit p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Priority Rating (P)</span>
              <span className="text-xs font-bold text-brand-700">{combinedPriority} / 100</span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {combinedPriority}
              <span className="text-xs font-normal text-slate-400 ml-1">pts</span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-1">
              P = (0.60 × {roleScore}) + (0.40 × {purposeScore})
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center p-2 rounded bg-slate-50">
              <span className="text-slate-500">Requester Authority (R)</span>
              <span className="font-bold text-slate-800">{roleScore} / 100</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded bg-slate-50">
              <span className="text-slate-500">Event Purpose Score (E)</span>
              <span className="font-bold text-slate-800">{purposeScore} / 100</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded bg-slate-50">
              <span className="text-slate-500">Role Verification</span>
              <span className="font-bold text-emerald-600">Authenticated ✓</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-800 space-y-1">
            <span className="font-bold block">💡 Alternative Venue Guarantee</span>
            <p>If another higher-priority request is submitted for this same slot, our engine will automatically find and rank the top 3 alternative venues or times for you.</p>
          </div>
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
