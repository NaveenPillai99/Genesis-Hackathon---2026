import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { getFacilitySchedule } from '../../lib/dataClient'
import { todayISO, formatTimeRange } from '../../lib/time'
import {
  CAN_REQUEST_FACILITY,
  NEEDS_FACULTY_ENDORSEMENT,
  ROLES,
} from '../../lib/constants'
import Badge from '../../components/common/Badge'
import ReportIssueModal from '../../components/common/ReportIssueModal'
import RequestFacilityModal from './RequestFacilityModal'

export default function FacilityCard({ facility }) {
  const { user } = useAuth()
  const [requestOpen, setRequestOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)

  const canRequest = CAN_REQUEST_FACILITY.has(user.role)
  const needsMentor = NEEDS_FACULTY_ENDORSEMENT.has(user.role)

  // Today at a glance, so the card itself shows whether the lab is free.
  const { data: schedule } = useLiveData(
    () => getFacilitySchedule({ facilityId: facility.id, date: todayISO() }),
    [facility.id]
  )
  const today = schedule?.[0]
  const sessions = today?.sessions ?? []

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
        ) : (
          <Badge tone={sessions.length === 0 ? 'green' : 'amber'}>
            {sessions.length === 0 ? 'Free today' : `${sessions.length} booked today`}
          </Badge>
        )}
      </div>

      <p className="text-sm text-slate-600">{facility.description}</p>

      <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <p>
          Staffed {facility.openTime ?? '09:00'}–{facility.closeTime ?? '17:00'} · Contact {facility.contact}
        </p>
        {sessions.length > 0 && (
          <p className="mt-1 truncate text-slate-600">
            Today: {sessions.map((s) => `${formatTimeRange(s.startTime, s.endTime)} ${s.userName}`).join(' · ')}
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {canRequest && (
          <button
            className="btn-primary flex-1"
            disabled={facility.underMaintenance}
            onClick={() => setRequestOpen(true)}
          >
            Request access
          </button>
        )}
        <button className="btn-secondary" onClick={() => setIssueOpen(true)}>
          Report issue
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        {needsMentor
          ? 'Goes to your faculty mentor first, then the lab team allocates the slot.'
          : `Goes straight to the lab team — ${facility.requiresAdminApproval ? 'this lab needs Lab Administrator sign-off' : 'the Lab Assistant clears routine sessions'}.`}
      </p>

      <RequestFacilityModal open={requestOpen} onClose={() => setRequestOpen(false)} facility={facility} />
      <ReportIssueModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        targetType="facility"
        targetId={facility.id}
        targetLabel={facility.name}
      />
    </div>
  )
}
