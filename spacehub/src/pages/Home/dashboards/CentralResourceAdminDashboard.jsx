import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listRooms,
  listEvents,
  decideEvent,
  autoDecideCluster,
  createEventRequest,
  resetDemoEvents,
  listAuditLogs,
} from '../../../lib/dataClient'

import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function CentralResourceAdminDashboard({ user }) {
  const [rooms, setRooms] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'approved' | 'declined' | 'all'

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedEventForReview, setSelectedEventForReview] = useState(null)

  // Simulation modal
  const [simulateModalOpen, setSimulateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      setAuditLogs((logs || []).slice(0, 6))
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
    setTimeout(() => setFlashMsg(''), 5000)
  }

  function handleOpenReview(evt) {
    setSelectedEventForReview(evt)
    setReviewModalOpen(true)
  }

  async function handleDecideEvent(eventId, decision, reasonText) {
    setIsSubmitting(true)
    try {
      await decideEvent(eventId, {
        decision,
        reason: reasonText || (decision === 'approved' ? 'Approved by Central Resource Admin based on venue availability.' : 'Declined due to facility maintenance or scheduling constraint.'),
        byUserId: user?.id || 'user-resourceadmin-1',
      })
      flash(`Venue booking request marked as ${decision.toUpperCase()}! Notification dispatched.`)
      if (reviewModalOpen) setReviewModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Error deciding event request: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReopenEvent(event) {
    setIsSubmitting(true)
    try {
      await decideEvent(event.id, {
        decision: 'pending',
        reason: 'Re-opened by Central Resource Admin for clearance re-evaluation.',
        byUserId: user?.id || 'user-resourceadmin-1',
      })
      flash(`Venue request '${event.name || event.title}' re-opened. Decision options are active again!`)
      if (reviewModalOpen) setReviewModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Error re-opening request: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetDemoData() {
    if (confirm('Reset demo event and venue requests to initial state?')) {
      setIsSubmitting(true)
      try {
        if (typeof resetDemoEvents === 'function') {
          await resetDemoEvents()
        }
        flash('Demo requests reset! You can test venue decisions repeatedly.')
        await loadData()
      } catch (e) {
        alert(`Error: ${e.message}`)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  async function handleSimulatePreset(preset) {
    setIsSubmitting(true)
    try {
      await createEventRequest(preset)
      flash(`Simulated venue request '${preset.title}' submitted!`)
      setSimulateModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Simulation error: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const pendingVenueRequests = allEvents
    .filter((e) => ['pending', 'awaiting_director_approval', 'recommended', 'under_review'].includes(e.status?.toLowerCase()))
    .sort((a, b) => {
      const scoreA = a.combined_priority_score || a.priorityScore || 0
      const scoreB = b.combined_priority_score || b.priorityScore || 0
      return scoreB - scoreA
    })

  const approvedVenues = allEvents.filter((e) => e.status?.toLowerCase() === 'approved')
  const declinedVenues = allEvents.filter((e) => ['rejected', 'declined', 'changes_requested'].includes(e.status?.toLowerCase()))

  const displayedRequests =
    activeTab === 'pending'
      ? pendingVenueRequests
      : activeTab === 'approved'
      ? approvedVenues
      : activeTab === 'declined'
      ? declinedVenues
      : allEvents

  const venueCount = rooms.filter((r) => r.type === 'event_venue').length

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-purple-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⚖️</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-purple-200 text-base font-bold">✕</button>
        </div>
      )}

      {/* Official Amrita Portal Hero */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'cra-alt-1',
            title: `Venue Clearance Queue: ${pendingVenueRequests.length} competing booking request(s) awaiting priority evaluation`,
            link: '#approvals',
          },
          {
            id: 'cra-alt-2',
            title: `Facility Allocation Policy: Central auditorium and seminar complexes operate under centralized clearance`,
            link: '#approvals',
          },
        ]}
      />

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-2xs">
          <span className="text-xs font-bold text-purple-800 uppercase">Pending Venue Clearances</span>
          <div className="text-2xl font-black text-purple-950 mt-1">{pendingVenueRequests.length} Requests</div>
          <p className="text-[11px] text-purple-700 mt-1">Main Auditorium &amp; Seminar Halls</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Active Booked Venues</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{approvedVenues.length} Cleared</div>
          <p className="text-[11px] text-slate-500 mt-1">Operational University Events</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Event Venues Managed</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{venueCount} Venues</div>
          <p className="text-[11px] text-slate-500 mt-1">Across Academic Blocks</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Declined / Reallocated</span>
          <div className="text-2xl font-black text-rose-600 mt-1">{declinedVenues.length} Events</div>
          <p className="text-[11px] text-slate-500 mt-1">Alternate options offered</p>
        </div>
      </section>

      {/* High-Demand Venue Approval Desk */}
      <section id="approvals" className="rounded-2xl border border-purple-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              High-Demand Venue Clearance &amp; Clash Resolution Desk
            </h2>
            <p className="text-xs text-slate-500">
              Manage venue requests for Main Auditorium, Seminar Halls, and Amphitheatre with re-evaluation capabilities.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {pendingVenueRequests.length > 1 && (
              <button
                onClick={async () => {
                  try {
                    const firstReq = pendingVenueRequests[0]
                    await autoDecideCluster({
                      venueRoomId: firstReq.venueRoomId || firstReq.venue_id,
                      date: firstReq.date || firstReq.event_date,
                    })
                    flash('AI Decision Engine: Automatically awarded slot to highest priority request and generated alternative options!')
                    loadData()
                  } catch (e) {
                    alert(e.message)
                  }
                }}
                className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-3 py-1.5 shadow-xs transition flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>Auto-Resolve Clash via AI</span>
              </button>
            )}

            <button
              onClick={() => setSimulateModalOpen(true)}
              className="rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 font-bold text-xs px-3 py-1.5 transition flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>+ Simulate Request</span>
            </button>

            <button
              onClick={handleResetDemoData}
              className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 transition"
            >
              🔄 Reset Demo Requests
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-purple-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Pending Clearance</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {pendingVenueRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'approved'
                ? 'bg-purple-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Approved Venues</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'approved' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {approvedVenues.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('declined')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'declined'
                ? 'bg-purple-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Declined / Reallocated</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'declined' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {declinedVenues.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-purple-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>All Requests</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {allEvents.length}
            </span>
          </button>
        </div>

        {/* Requests List */}
        {displayedRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <div>✨ No requests currently found in this category.</div>
            <button onClick={handleResetDemoData} className="text-purple-700 font-extrabold hover:underline">
              Click here to load demo requests
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedRequests.map((evt) => {
              const score = evt.combined_priority_score || evt.priorityScore || 50
              const isApproved = evt.status?.toLowerCase() === 'approved'
              const isDeclined = ['rejected', 'declined', 'changes_requested'].includes(evt.status?.toLowerCase())

              return (
                <div
                  key={evt.id}
                  className={`rounded-xl border p-4 text-xs space-y-3 transition ${
                    isApproved
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : isDeclined
                      ? 'border-slate-200 bg-slate-50/60'
                      : 'border-purple-200 bg-purple-50/20 hover:bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-sm">{evt.name || evt.title}</h4>
                        <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded text-[10px]">
                          Priority Score: {score}
                        </span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                          isApproved ? 'bg-emerald-600 text-white' : isDeclined ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-900'
                        }`}>
                          {evt.status?.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <p className="text-slate-500 text-[11px]">
                        Organizer: {evt.requestedBy || evt.organizer || 'Department'} · Venue: {evt.venueRoomId || evt.venue_id} · Expected: {evt.audienceSize || evt.expected_audience || 150} pax
                      </p>
                      <p className="text-purple-700 font-semibold text-[11px]">
                        📅 {evt.date || evt.event_date} ({evt.start || evt.start_slot} – {evt.end || evt.end_slot})
                      </p>
                    </div>

                    {/* Action buttons with re-usability */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleOpenReview(evt)}
                        className="rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs px-3 py-1.5 border border-purple-200 transition flex items-center gap-1"
                      >
                        <span>👁️</span>
                        <span>Review</span>
                      </button>

                      {!isApproved && !isDeclined ? (
                        <>
                          <button
                            onClick={() => handleDecideEvent(evt.id, 'approved')}
                            disabled={isSubmitting}
                            className="rounded-lg bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-700 shadow-2xs transition"
                          >
                            ✓ Approve Venue
                          </button>
                          <button
                            onClick={() => handleDecideEvent(evt.id, 'declined')}
                            disabled={isSubmitting}
                            className="rounded-lg bg-rose-50 text-rose-700 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 border border-rose-200 transition"
                          >
                            ✕ Decline
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleReopenEvent(evt)}
                            disabled={isSubmitting}
                            className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs px-2.5 py-1.5 border border-amber-300 transition flex items-center gap-1"
                            title="Reset back to pending so you can decide again"
                          >
                            <span>🔄</span>
                            <span>Re-open for Decision</span>
                          </button>
                          {isApproved ? (
                            <button
                              onClick={() => handleDecideEvent(evt.id, 'declined')}
                              className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-2.5 py-1.5 border border-rose-200 transition"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDecideEvent(evt.id, 'approved')}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1.5 shadow-xs transition"
                            >
                              ✓ Approve
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
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
            <div key={log.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-800 mr-2">{log.action?.replace(/_/g, ' ')}</span>
                <span className="text-slate-500 font-sans">{log.details}</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ======================= MODALS ======================= */}

      {/* 1. REVIEW DETAILS MODAL */}
      {reviewModalOpen && selectedEventForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-purple-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                  Central Resource Clearance Review
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {selectedEventForReview.name || selectedEventForReview.title}
                </h3>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Venue</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.venueRoomId || selectedEventForReview.venue_id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Date &amp; Slots</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.date || selectedEventForReview.event_date}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected Attendance</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.audienceSize || selectedEventForReview.expected_audience || 150} pax</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Priority Score</span>
                <span className="font-extrabold text-purple-900">{selectedEventForReview.combined_priority_score || selectedEventForReview.priorityScore || 50} / 100</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDecideEvent(selectedEventForReview.id, 'declined')}
                className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3.5 py-2 border border-rose-200"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => handleDecideEvent(selectedEventForReview.id, 'approved')}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 shadow-xs"
              >
                ✓ Approve Venue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SIMULATION MODAL */}
      {simulateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-purple-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                  Simulation Lab
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Inject Venue Booking Proposal
                </h3>
              </div>
              <button onClick={() => setSimulateModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  handleSimulatePreset({
                    title: 'University Annual Convocation Rehearsal',
                    description: 'Full campus auditorium rehearsal with academic marshals.',
                    venueRoomId: 'venue-auditorium',
                    requestedBy: 'Registrar Office',
                    date: '2026-10-29',
                    start: '09:00',
                    end: '13:00',
                    audienceSize: 1000,
                    eventLevel: 'university',
                    academic: true,
                    externalGuests: false,
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">University Convocation Rehearsal</span>
                  <span className="bg-purple-100 text-purple-900 font-bold px-1.5 py-0.2 rounded text-[10px]">Auditorium · 1000 pax</span>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSimulateModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
