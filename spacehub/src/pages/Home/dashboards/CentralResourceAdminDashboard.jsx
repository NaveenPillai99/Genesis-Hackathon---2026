import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listRooms,
  listEvents,
  decideEvent,
  listAuditLogs,
} from '../../../lib/dataClient'

export default function CentralResourceAdminDashboard({ user }) {
  const [rooms, setRooms] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const [rms, evts, logs] = await Promise.all([
        listRooms().catch(() => []),
        listEvents().catch(() => []),
        listAuditLogs().catch(() => []),
      ])
      setRooms(rms || [])
      setAllEvents(evts || [])
      setAuditLogs((logs || []).slice(0, 5))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function flash(msg) {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(''), 4500)
  }

  async function handleDecideEvent(eventId, decision) {
    try {
      await decideEvent(eventId, {
        decision,
        reason: decision === 'approved' ? 'Approved based on academic priority score and auditorium clearance' : 'Declined due to facility maintenance and priority conflict',
        byUserId: user?.id,
      })
      flash(`Venue booking request marked as ${decision.toUpperCase()}! Notification dispatched.`)
      loadData()
    } catch (e) {
      alert(`Error deciding event request: ${e.message}`)
    }
  }

  const pendingVenueRequests = allEvents.filter((e) => e.status === 'pending')
  const approvedVenues = allEvents.filter((e) => e.status === 'approved')
  const classroomsCount = rooms.filter((r) => r.type === 'classroom').length
  const venueCount = rooms.filter((r) => r.type === 'event_venue').length

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-purple-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⚖️</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-purple-200">✕</button>
        </div>
      )}

      {/* Central Resource Admin Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-purple-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-purple-500/20 text-purple-200 border border-purple-400/30">
                🗝️ Central Resource &amp; Event Venue Desk
              </span>
              <span className="text-purple-300 text-xs">• Campus-Wide Venue Authority</span>
              <span className="text-emerald-400 text-xs bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                Primary Venue Administrator
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Welcome, {user?.name}
            </h1>
            <p className="text-purple-200/80 text-xs md:text-sm mt-1 max-w-xl">
              Primary campus venue administrator: Review competing requests for the Main Auditorium and seminar halls with automated academic priority scoring, manage room maintenance blocks, and audit venue utilization.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/events/approvals"
              className="rounded-xl bg-purple-400 text-slate-950 px-3.5 py-2 text-xs font-black hover:bg-purple-300 shadow-sm"
            >
              ⚖️ Approvals Desk ({pendingVenueRequests.length})
            </Link>
            <Link
              to="/governance"
              className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20"
            >
              🛡️ Audit Trail
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-2xs">
          <span className="text-xs font-bold text-purple-800 uppercase">Pending Venue Approvals</span>
          <div className="text-2xl font-black text-purple-950 mt-1">{pendingVenueRequests.length} Requests</div>
          <p className="text-[11px] text-purple-700 mt-1">Main Auditorium &amp; Seminar Halls</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Classroom Utilization</span>
          <div className="text-2xl font-black text-slate-900 mt-1">68.4%</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Peak: 10:45 – 13:15</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Event Venues Managed</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{venueCount} Auditoriums</div>
          <p className="text-[11px] text-slate-500 mt-1">Across Central Academic Blocks</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Active Booked Venues</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{approvedVenues.length} Approved</div>
          <p className="text-[11px] text-slate-500 mt-1">Cleared for campus operations</p>
        </div>
      </section>

      {/* High-Demand Venue Approval Desk */}
      <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              High-Demand Venue Approval &amp; Clash Resolution Desk
            </h2>
            <p className="text-xs text-slate-500">
              Compete requests for Main Auditorium and Seminar Halls with automated priority scoring.
            </p>
          </div>
          <Link to="/events/approvals" className="text-xs font-semibold text-purple-600 hover:underline">
            Approvals Matrix →
          </Link>
        </div>

        {pendingVenueRequests.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            ✨ No pending venue requests. All auditoriums are cleared!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingVenueRequests.map((evt) => (
              <div
                key={evt.id}
                className="rounded-xl border border-purple-200 p-4 bg-purple-50/20 text-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">{evt.title}</h4>
                      <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded text-[10px]">
                        Priority Score: {evt.priorityScore || 85} / 100
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Organizer: {evt.requestedBy || 'Department'} · Venue: {evt.venueRoomId} · Expected: {evt.audienceSize || 300} attendees
                    </p>
                    <p className="text-brand-700 font-semibold text-[11px] mt-0.5">
                      📅 {evt.date} ({evt.start} – {evt.end})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecideEvent(evt.id, 'approved')}
                      className="rounded-lg bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-700 shadow-2xs"
                    >
                      ✓ Approve Venue
                    </button>
                    <button
                      onClick={() => handleDecideEvent(evt.id, 'declined')}
                      className="rounded-lg bg-red-100 text-red-800 px-3 py-1.5 text-xs font-bold hover:bg-red-200"
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Venue Audit Log Snippet */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h3 className="text-sm font-bold text-slate-900">
              Recent Resource Decisions Audit Trail
            </h3>
          </div>
          <Link to="/governance" className="text-xs font-semibold text-brand-600 hover:underline">
            Full Audit Board →
          </Link>
        </div>

        <div className="space-y-2">
          {auditLogs.map((log) => (
            <div key={log.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs flex justify-between items-center font-mono">
              <div>
                <span className="font-bold text-slate-800 mr-2">{log.action}</span>
                <span className="text-slate-500 font-sans">{log.details}</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
