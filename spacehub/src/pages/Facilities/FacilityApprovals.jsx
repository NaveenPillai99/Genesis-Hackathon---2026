import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { decideFacultyEndorsement, decideLabReview, listFacilityApprovalQueue } from '../../lib/dataClient'

function RequestRow({ request, stage, userId }) {
  async function decide(decision) {
    const action = stage === 'faculty' ? decideFacultyEndorsement : decideLabReview
    await action(request.id, { decision, byUserId: userId })
  }
  return <div className="card flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-semibold text-slate-800">{request.requesterName} · {request.facilityName || request.facilityId}</p><p className="text-xs text-slate-500">{request.date} · {request.startTime}-{request.endTime} · {request.reason}</p></div><div className="flex gap-2"><button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => decide('approved')}>Approve</button><button className="btn-danger !px-3 !py-1.5 text-xs" onClick={() => decide('rejected')}>Reject</button></div></div>
}

export default function FacilityApprovals() {
  const { user } = useAuth()
  const { data: queue } = useLiveData(() => listFacilityApprovalQueue(user), [user.id, user.role])
  const endorsements = queue?.endorsements ?? []
  const reviews = queue?.labReviews ?? []
  return <div className="flex flex-col gap-5"><section><h2 className="mb-2 text-sm font-bold text-slate-800">Faculty endorsements</h2><div className="flex flex-col gap-2">{endorsements.map((request) => <RequestRow key={request.id} request={request} stage="faculty" userId={user.id} />)}{endorsements.length === 0 && <p className="text-xs text-slate-500">No endorsement requests waiting.</p>}</div></section><section><h2 className="mb-2 text-sm font-bold text-slate-800">Facility allocation reviews</h2><div className="flex flex-col gap-2">{reviews.map((request) => <RequestRow key={request.id} request={request} stage="lab" userId={user.id} />)}{reviews.length === 0 && <p className="text-xs text-slate-500">No facility reviews waiting.</p>}</div></section></div>
}
