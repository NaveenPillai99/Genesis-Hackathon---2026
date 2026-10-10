import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { CAN_REQUEST_FACILITY, NEEDS_FACILITY_MENTOR } from '../../lib/constants'
import Badge from '../../components/common/Badge'
import ReportIssueModal from '../../components/common/ReportIssueModal'
import RequestAccessModal from './RequestAccessModal'

export default function FacilityCard({ facility }) {
  const { user } = useAuth()
  const [requestOpen, setRequestOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)

  const canRequest = CAN_REQUEST_FACILITY.has(user.role)

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
        {facility.underMaintenance && <Badge tone="red">Under maintenance</Badge>}
      </div>

      <p className="text-sm text-slate-600">{facility.description}</p>
      <p className="text-xs text-slate-400">Contact: {facility.contact}</p>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {canRequest && (
          <button className="btn-primary flex-1" disabled={facility.underMaintenance} onClick={() => setRequestOpen(true)}>
            Request access
          </button>
        )}
        <button className="btn-secondary" onClick={() => setIssueOpen(true)}>
          Report issue
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        {NEEDS_FACILITY_MENTOR.has(user.role)
          ? "Needs your faculty mentor's approval, then the facility administrator's — no separate induction step."
          : 'Goes straight to the facility administrator for review — no mentor step for your role.'}
      </p>

      <RequestAccessModal open={requestOpen} onClose={() => setRequestOpen(false)} facility={facility} />
      <ReportIssueModal open={issueOpen} onClose={() => setIssueOpen(false)} targetType="facility" targetId={facility.id} targetLabel={facility.name} />
    </div>
  )
}
