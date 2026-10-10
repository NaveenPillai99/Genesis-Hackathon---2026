import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import {
  cancelFacilityRequest,
  decideMentorStage,
  listFacilities,
  listFacilityRequests,
  listMyFacilityRequests,
  listProfiles,
  respondToAlternative,
} from '../../lib/dataClient'
import { formatTimeRange } from '../../lib/time'
import { CAN_APPROVE_FACILITY_MENTOR_STAGE, CAN_MANAGE_FACILITY, FACILITY_REQUEST_STATUS_LABELS, ROLES } from '../../lib/constants'
import FacilityCard from './FacilityCard'
import FacilityRequestRow from './FacilityRequestRow'
import FacilityAdminReviewRow from './FacilityAdminReviewRow'
import Badge from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import { ErrorNote, Spinner } from '../../components/common/Feedback'

const STATUS_TONE = { pending_mentor: 'amber', pending_facility: 'blue', alternative_suggested: 'purple', approved: 'green', declined: 'red' }

export default function FacilityCatalogue() {
  const { user } = useAuth()
  const { data: facilities, loading } = useLiveData(() => listFacilities(), [])
  const { data: profiles } = useLiveData(() => listProfiles(), [])
  const { data: myRequests } = useLiveData(() => listMyFacilityRequests(user.id), [user.id])

  const isMentorApprover = CAN_APPROVE_FACILITY_MENTOR_STAGE.has(user.role)
  const isFacilityAdmin = CAN_MANAGE_FACILITY.has(user.role)

  const { data: pendingMentor } = useLiveData(
    () => (isMentorApprover ? listFacilityRequests({ status: 'pending_mentor' }) : Promise.resolve([])),
    [isMentorApprover]
  )
  const { data: pendingFacility } = useLiveData(
    () => (isFacilityAdmin ? listFacilityRequests({ status: 'pending_facility' }) : Promise.resolve([])),
    [isFacilityAdmin]
  )

  const facilityName = (id) => facilities?.find((f) => f.id === id)?.name ?? id
  const nameOf = (id) => profiles?.find((p) => p.id === id)?.name ?? 'Someone'

  // Faculty only see requests where they're the chosen mentor; admin sees every one, as oversight.
  const myMentorQueue = (pendingMentor ?? []).filter((r) => user.role === ROLES.ADMIN || r.mentorId === user.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Innovation facilities</h1>
        <p className="text-sm text-slate-500">
          HPC, 3D printers and more — what they do, where they are, and how to request access.
        </p>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f) => (
            <FacilityCard key={f.id} facility={f} />
          ))}
        </div>
      )}

      {isMentorApprover && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-800">Faculty approval pending (requests needing your sign-off)</h2>
          {myMentorQueue.length === 0 ? (
            <EmptyState icon="✅" title="Nothing waiting on you" />
          ) : (
            <div className="flex flex-col gap-2">
              {myMentorQueue.map((r) => (
                <FacilityRequestRow
                  key={r.id}
                  request={r}
                  facilityName={facilityName(r.facilityId)}
                  requesterName={nameOf(r.requestedBy)}
                  onDecide={(decision, reason) => decideMentorStage(r.id, { decision, byUserId: user.id, reason })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {isFacilityAdmin && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-800">Facility admin review</h2>
          {!pendingFacility || pendingFacility.length === 0 ? (
            <EmptyState icon="🔧" title="Nothing waiting on review" />
          ) : (
            <div className="flex flex-col gap-2">
              {pendingFacility.map((r) => (
                <FacilityAdminReviewRow
                  key={r.id}
                  request={r}
                  facilityName={facilityName(r.facilityId)}
                  requesterName={nameOf(r.requestedBy)}
                  byUserId={user.id}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-800">Your requests</h2>
        {!myRequests || myRequests.length === 0 ? (
          <EmptyState icon="🗓️" title="Nothing requested yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {myRequests.map((r) => (
              <MyRequestRow key={r.id} request={r} facilityName={facilityName(r.facilityId)} userId={user.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function MyRequestRow({ request: r, facilityName, userId }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function respond(decision) {
    setBusy(true)
    setError(null)
    try {
      await respondToAlternative(r.id, { decision, byUserId: userId })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">{facilityName}</p>
          <p className="text-xs text-slate-500">
            {r.date} · {formatTimeRange(r.start, r.end)}
            {r.nodeHoursRequested ? ` · ${r.nodeHoursRequested} node-hours` : ''} · {r.purpose}
          </p>
          {r.status === 'declined' && (r.facilityReason || r.mentorReason) && (
            <p className="mt-1 text-xs text-rose-600">Reason: {r.facilityReason || r.mentorReason}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone={STATUS_TONE[r.status]}>{FACILITY_REQUEST_STATUS_LABELS[r.status]}</Badge>
          {r.status === 'pending_mentor' && (
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => cancelFacilityRequest(r.id)}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {r.status === 'alternative_suggested' && (
        <div className="mt-2 rounded-lg bg-violet-50 p-2 ring-1 ring-inset ring-violet-200">
          <p className="text-xs font-semibold text-violet-800">
            Facility admin suggested: {r.altDate} · {formatTimeRange(r.altStart, r.altEnd)}
          </p>
          {r.altNote && <p className="mt-1 text-xs text-violet-700">{r.altNote}</p>}
          <ErrorNote error={error} />
          <div className="mt-2 flex gap-2">
            <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => respond('accept')}>
              Accept
            </button>
            <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => respond('decline')}>
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
