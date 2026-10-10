import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { completeInduction, hasInduction, listProfiles } from '../../lib/dataClient'
import { CAN_BOOK_FACILITY, CAN_MANAGE_FACILITY, ROLES } from '../../lib/constants'
import Badge from '../../components/common/Badge'
import { ErrorNote } from '../../components/common/Feedback'
import ReportIssueModal from '../../components/common/ReportIssueModal'
import FacilityBookingModal from './FacilityBookingModal'

export default function FacilityCard({ facility }) {
  const { user } = useAuth()
  const [bookingOpen, setBookingOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const { data: inducted } = useLiveData(() => hasInduction(user.id, facility.id), [facility.id, user.id])

  const canManage = CAN_MANAGE_FACILITY.has(user.role)
  const canBook = CAN_BOOK_FACILITY.has(user.role)
  const needsInduction = facility.inductionRequired && !inducted
  const isHpc = facility.allocationModel === 'compute_time'

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{facility.image}</span>
          <div>
            <p className="font-bold text-slate-800">{facility.name}</p>
            <p className="text-xs text-slate-400">{facility.location}</p>
          </div>
        </div>
        {facility.underMaintenance ? (
          <Badge tone="red">Under maintenance</Badge>
        ) : facility.inductionRequired ? (
          <Badge tone={inducted ? 'green' : 'amber'}>{inducted ? 'Inducted' : 'Needs induction'}</Badge>
        ) : null}
      </div>

      <p className="text-sm text-slate-600">{facility.description}</p>
      <p className="text-xs text-slate-400">Contact: {facility.contact}</p>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {isHpc ? (
          canBook && (
            <Link to="/facilities/hpc" className="btn-primary flex-1 text-center">
              Request compute time
            </Link>
          )
        ) : (
          <button
            className="btn-primary flex-1"
            disabled={facility.underMaintenance || !canBook || needsInduction}
            onClick={() => setBookingOpen(true)}
          >
            {needsInduction ? 'Induction required' : 'Book a slot'}
          </button>
        )}
        <button className="btn-secondary" onClick={() => setIssueOpen(true)}>
          Report issue
        </button>
        {canManage && (
          <button className="btn-secondary" onClick={() => setManageOpen((v) => !v)}>
            {manageOpen ? 'Hide manage' : 'Manage'}
          </button>
        )}
      </div>

      {needsInduction && !canManage && (
        <p className="text-xs text-amber-700">Ask a facility in-charge to complete your induction before booking.</p>
      )}

      {manageOpen && canManage && <ManagePanel facility={facility} />}

      <FacilityBookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} facility={facility} />
      <ReportIssueModal open={issueOpen} onClose={() => setIssueOpen(false)} targetType="facility" targetId={facility.id} targetLabel={facility.name} />
    </div>
  )
}

function ManagePanel({ facility }) {
  const { user } = useAuth()
  const { data: profiles } = useLiveData(() => listProfiles(), [])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const bookableUsers = (profiles ?? []).filter((p) => p.role !== ROLES.FACILITY_INCHARGE && p.role !== ROLES.ADMIN)

  async function induct() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await completeInduction({ userId: selected, facilityId: facility.id, byUserId: user.id })
      setDone(profiles.find((p) => p.id === selected)?.name)
      setSelected('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="label mb-2">Run induction</p>
      <div className="flex gap-2">
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Pick a person…</option>
          {bookableUsers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.role.replace('_', ' ')})
            </option>
          ))}
        </select>
        <button className="btn-primary whitespace-nowrap" disabled={!selected || busy} onClick={induct}>
          {busy ? 'Saving…' : 'Mark inducted'}
        </button>
      </div>
      <ErrorNote error={error} />
      {done && <p className="mt-2 text-xs font-semibold text-emerald-700">✓ {done} can now book {facility.name}.</p>}
    </div>
  )
}
