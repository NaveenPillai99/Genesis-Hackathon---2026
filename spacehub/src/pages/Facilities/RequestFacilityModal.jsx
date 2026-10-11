import { useState } from 'react'
import Modal from '../../components/common/Modal'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { createFacilityRequest, listProfiles } from '../../lib/dataClient'
import { NEEDS_FACULTY_ENDORSEMENT } from '../../lib/constants'

export default function RequestFacilityModal({ open, onClose, facility }) {
  const { user } = useAuth()
  const { data: profiles } = useLiveData(() => listProfiles(), [])
  const [form, setForm] = useState({ date: '', startTime: '09:00', endTime: '10:00', reason: '', mentorId: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mentors = (profiles ?? []).filter((profile) => profile.role === 'faculty')
  const needsMentor = NEEDS_FACULTY_ENDORSEMENT.has(user.role)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createFacilityRequest({ facilityId: facility.id, requesterId: user.id, requesterRole: user.role, ...form })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Request access: ${facility.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="label">Date<input required type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">Start<input required type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label>
          <label className="label">End<input required type="time" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label>
        </div>
        <label className="label">Purpose<textarea required className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        {needsMentor && <label className="label">Faculty mentor<select required className="input" value={form.mentorId} onChange={(e) => setForm({ ...form, mentorId: e.target.value })}><option value="">Choose faculty mentor</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select></label>}
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit request'}</button>
      </form>
    </Modal>
  )
}
