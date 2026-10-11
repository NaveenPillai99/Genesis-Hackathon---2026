import { useLiveData } from '../../lib/useLiveData'
import { getFacilitySchedule, listFacilities } from '../../lib/dataClient'
import { todayISO, formatTimeRange } from '../../lib/time'

export default function FacilityScheduleBoard() {
  const { data: facilities } = useLiveData(() => listFacilities(), [])
  const { data: schedules } = useLiveData(
    () => Promise.all((facilities ?? []).map(async (facility) => ({ facility, rows: await getFacilitySchedule({ facilityId: facility.id, date: todayISO() }) }))),
    [facilities?.length]
  )
  return <section className="grid gap-3 md:grid-cols-2">{(schedules ?? []).map(({ facility, rows }) => <div key={facility.id} className="card p-4"><h2 className="font-bold text-slate-800">{facility.name}</h2>{rows?.flatMap((row) => row.sessions ?? []).map((session) => <p key={session.id} className="mt-2 text-xs text-slate-500">{formatTimeRange(session.startTime, session.endTime)} · {session.userName}</p>)}{!rows?.some((row) => row.sessions?.length) && <p className="mt-2 text-xs text-emerald-700">No bookings today</p>}</div>)}</section>
}
