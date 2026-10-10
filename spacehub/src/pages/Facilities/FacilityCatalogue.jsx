import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { listFacilities, listMyFacilityBookings, cancelFacilityBooking } from '../../lib/dataClient'
import { formatTimeRange } from '../../lib/time'
import FacilityCard from './FacilityCard'
import EmptyState from '../../components/common/EmptyState'
import { Spinner } from '../../components/common/Feedback'

export default function FacilityCatalogue() {
  const { user } = useAuth()
  const { data: facilities, loading } = useLiveData(() => listFacilities(), [])
  const { data: myBookings } = useLiveData(() => listMyFacilityBookings(user.id), [user.id])

  const upcoming = (myBookings ?? []).filter((b) => b.status === 'booked')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Innovation facilities</h1>
        <p className="text-sm text-slate-500">HPC, 3D printers and more — what they do, where they are, and how to book them.</p>
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

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-800">Your facility bookings</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon="🗓️" title="Nothing booked yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((b) => (
              <div key={b.id} className="card flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">{facilities.find((f) => f.id === b.facilityId)?.name}</p>
                  <p className="text-xs text-slate-500">
                    {b.date} · {formatTimeRange(b.start, b.end)} · {b.purpose}
                  </p>
                </div>
                <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => cancelFacilityBooking(b.id)}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
