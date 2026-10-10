import { useLiveData } from '../../lib/useLiveData'
import {
  getAvailability,
  getUtilizationStats,
  listBlockedDates,
  listMaintenanceReports,
  listPublicEvents,
  listRooms,
  unblockRoomDate,
  updateMaintenanceStatus,
} from '../../lib/dataClient'
import { todayISO, nowHHMM, toMinutes } from '../../lib/time'
import { ROOM_TYPES } from '../../lib/constants'
import StatTile from '../../components/charts/StatTile'
import { UtilizationChart } from '../../components/charts/UtilizationChart'
import EmptyState from '../../components/common/EmptyState'
import Badge from '../../components/common/Badge'
import { Spinner } from '../../components/common/Feedback'

export default function AdminDashboard() {
  const { data: stats, loading } = useLiveData(() => getUtilizationStats(), [])
  const { data: blocked } = useLiveData(() => listBlockedDates(), [])
  const { data: maintenance } = useLiveData(() => listMaintenanceReports(), [])
  const { data: rooms } = useLiveData(() => listRooms(), [])

  if (loading || !stats) return <Spinner />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Admin dashboard</h1>
        <p className="text-sm text-slate-500">Utilization, approvals pipeline and the things that need your attention.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Pending venue requests" value={stats.eventCounts.pending} status="warning" />
        <StatTile label="Approved events" value={stats.eventCounts.approved} status="good" />
        <StatTile label="Declined requests" value={stats.eventCounts.declined} status="critical" />
        <StatTile label="Open maintenance" value={stats.openMaintenance} status="serious" />
        <StatTile label="Unclaimed lost items" value={stats.unclaimedLostItems} status="neutral" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Classroom utilization this week</h2>
          <UtilizationChart data={stats.roomUtilization} dataKey="utilizationPct" categoryKey="room" suffix="%" />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Facility bookings</h2>
          <UtilizationChart data={stats.facilityUsage} dataKey="bookings" categoryKey="facility" suffix=" bookings" />
        </section>
      </div>

      <LiveOccupancy rooms={rooms} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Blocked dates</h2>
          {!blocked || blocked.length === 0 ? (
            <EmptyState icon="📅" title="No rooms blocked" />
          ) : (
            <div className="flex flex-col gap-2">
              {blocked.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{rooms?.find((r) => r.id === b.roomId)?.name ?? b.roomId}</p>
                    <p className="text-xs text-slate-500">
                      {b.date} · {b.reason}
                    </p>
                  </div>
                  <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => unblockRoomDate(b.id)}>
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">Block a room from its row on the Classrooms board.</p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Maintenance queue</h2>
          {!maintenance || maintenance.length === 0 ? (
            <EmptyState icon="🛠️" title="Nothing reported" />
          ) : (
            <div className="flex flex-col gap-2">
              {maintenance.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{m.issue}</p>
                      <p className="text-xs text-slate-500">
                        {m.targetType} · {m.targetId}
                      </p>
                    </div>
                    <Badge tone={m.severity === 'serious' ? 'red' : 'slate'}>{m.severity}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge tone={m.status === 'resolved' ? 'green' : m.status === 'in_progress' ? 'blue' : 'amber'}>
                      {m.status.replace('_', ' ')}
                    </Badge>
                    {m.status !== 'resolved' && (
                      <div className="flex gap-1">
                        {m.status === 'open' && (
                          <button
                            className="btn-secondary !px-2 !py-1 text-[11px]"
                            onClick={() => updateMaintenanceStatus(m.id, 'in_progress')}
                          >
                            In progress
                          </button>
                        )}
                        <button className="btn-primary !px-2 !py-1 text-[11px]" onClick={() => updateMaintenanceStatus(m.id, 'resolved')}>
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function LiveOccupancy({ rooms }) {
  const today = todayISO()
  const now = nowHHMM()
  const classroomIds = (rooms ?? []).filter((r) => r.type === ROOM_TYPES.CLASSROOM).map((r) => r.id)
  const { data: board } = useLiveData(() => getAvailability({ date: today, roomIds: classroomIds }), [today, classroomIds.length])
  const { data: events } = useLiveData(() => listPublicEvents(), [])

  const occupiedRooms = (board ?? [])
    .map(({ room, slots }) => {
      const current = slots.find((s) => toMinutes(s.start) <= toMinutes(now) && toMinutes(now) < toMinutes(s.end))
      if (current && (current.status === 'timetable' || current.status === 'checked_in')) {
        return { room, label: current.status === 'timetable' ? current.timetable.courseName : 'Checked-in booking' }
      }
      return null
    })
    .filter(Boolean)

  const liveEvents = (events ?? []).filter((e) => e.date === today && toMinutes(e.start) <= toMinutes(now) && toMinutes(now) < toMinutes(e.end))

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-sm font-bold text-slate-800">🚨 Live occupancy (for emergency headcount)</h2>
      <p className="mb-3 text-xs text-slate-400">Rooms occupied right now and a rough headcount, from live bookings and check-ins.</p>
      {occupiedRooms.length === 0 && liveEvents.length === 0 ? (
        <EmptyState icon="🌤️" title="Nothing occupied right now" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {occupiedRooms.map(({ room, label }) => (
            <div key={room.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <p className="font-semibold text-slate-800">{room.name}</p>
              <p className="text-slate-500">{label} · up to {room.capacity} people</p>
            </div>
          ))}
          {liveEvents.map((e) => (
            <div key={e.id} className="rounded-lg bg-rose-50 px-3 py-2 text-xs">
              <p className="font-semibold text-rose-800">{e.title}</p>
              <p className="text-rose-600">event · ~{e.audienceSize} people</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
