import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { cancelFacilityRequest, listMyFacilityRequests } from '../../lib/dataClient'
import Badge from '../../components/common/Badge'

export default function MyFacilityRequests() {
  const { user } = useAuth()
  const { data: requests } = useLiveData(() => listMyFacilityRequests(user.id), [user.id])
  return <div className="flex flex-col gap-2">{(requests ?? []).map((request) => <div key={request.id} className="card flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-semibold text-slate-800">{request.facilityName || request.facilityId}</p><p className="text-xs text-slate-500">{request.date} · {request.startTime}-{request.endTime} · {request.reason}</p></div><div className="flex items-center gap-2"><Badge tone={request.status === 'approved' ? 'green' : request.status === 'rejected' ? 'red' : 'amber'}>{request.status}</Badge>{!['approved', 'rejected', 'cancelled'].includes(request.status) && <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => cancelFacilityRequest(request.id, { byUserId: user.id })}>Cancel</button>}</div></div>)}{(!requests || requests.length === 0) && <p className="text-xs text-slate-500">You have no facility requests.</p>}</div>
}
