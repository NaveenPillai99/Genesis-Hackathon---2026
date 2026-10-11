import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { listFacilities, listFacilityApprovalQueue, listMyFacilityRequests } from '../../lib/dataClient'
import { CAN_REQUEST_FACILITY, NEEDS_FACULTY_ENDORSEMENT } from '../../lib/constants'
import FacilityCard from './FacilityCard'
import FacilityScheduleBoard from './FacilityScheduleBoard'
import FacilityApprovals from './FacilityApprovals'
import MyFacilityRequests from './MyFacilityRequests'
import { Spinner } from '../../components/common/Feedback'

/**
 * The Facilities section every role sees. Four tabs:
 *   Browse     — request access to any lab
 *   Schedule   — who's using which facility, when
 *   Approvals  — endorsement / allocation queue (badge-counted)
 *   My requests— where each of my requests sits in the chain
 */
export default function FacilityCatalogue() {
  const { user } = useAuth()
  const [tab, setTab] = useState('browse')

  const { data: facilities, loading } = useLiveData(() => listFacilities(), [])
  const { data: queue } = useLiveData(() => listFacilityApprovalQueue(user), [user.id, user.role])
  const { data: myRequests } = useLiveData(() => listMyFacilityRequests(user.id), [user.id])

  const pendingForMe = (queue?.endorsements?.length ?? 0) + (queue?.labReviews?.length ?? 0)
  const openMine = (myRequests ?? []).filter((r) =>
    ['pending_faculty', 'pending_lab', 'alternative_offered'].includes(r.status)
  ).length

  const tabs = [
    { id: 'browse', label: 'Browse & request' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'approvals', label: 'Approvals', count: pendingForMe },
    { id: 'mine', label: 'My requests', count: openMine },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Campus facilities</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Facilities</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          HPC, 3D printing, VR and electronics labs.{' '}
          {NEEDS_FACULTY_ENDORSEMENT.has(user.role)
            ? 'Your request is endorsed by a faculty mentor, then allocated by the lab team.'
            : 'Your request goes straight to the lab team for allocation.'}
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'browse' &&
        (loading ? (
          <Spinner />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(facilities ?? []).map((f) => (
              <FacilityCard key={f.id} facility={f} />
            ))}
          </div>
        ))}

      {tab === 'schedule' && <FacilityScheduleBoard />}
      {tab === 'approvals' && <FacilityApprovals />}
      {tab === 'mine' && <MyFacilityRequests />}

      {!CAN_REQUEST_FACILITY.has(user.role) && tab === 'browse' && (
        <p className="text-xs text-slate-400">Your role can view facilities but not raise access requests.</p>
      )}
    </div>
  )
}
