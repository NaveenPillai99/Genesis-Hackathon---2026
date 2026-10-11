import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listRooms,
  listEvents,
  decideEvent,
  selectEventAlternative,
  createEventRequest,
  resetDemoEvents,
  listAuditLogs,
  listTimetableSlots,
} from '../../../lib/dataClient'
import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function CampusDirectorDashboard({ user }) {
  const [rooms, setRooms] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [timetableSlots, setTimetableSlots] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'all' | 'approved' | 'rejected'

  // Modal States
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedEventForReview, setSelectedEventForReview] = useState(null)

  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [selectedEventForApproval, setSelectedEventForApproval] = useState(null)
  const [overrideJustification, setOverrideJustification] = useState('')

  const [declineModalOpen, setDeclineModalOpen] = useState(false)
  const [selectedEventForDecline, setSelectedEventForDecline] = useState(null)
  const [declineReasonType, setDeclineReasonType] = useState('Schedule conflict with university priority event')
  const [declineNotes, setDeclineNotes] = useState('')

  const [altVenueModalOpen, setAltVenueModalOpen] = useState(false)
  const [selectedEventForAlt, setSelectedEventForAlt] = useState(null)

  const [simulateModalOpen, setSimulateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [rms, evts, slots, logs] = await Promise.all([
        listRooms().catch(() => []),
        listEvents().catch(() => []),
        listTimetableSlots().catch(() => []),
        listAuditLogs().catch(() => []),
      ])
      setRooms(rms || [])
      setAllEvents(evts || [])
      setTimetableSlots(slots || [])
      setAuditLogs((logs || []).slice(0, 8))
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
    setTimeout(() => setFlashMsg(''), 6000)
  }

  // Find competing requests for an event
  function getClashingRequests(event) {
    if (!event) return []
    const venueId = event.venue_id || event.venueRoomId
    const eventDate = event.event_date || event.date
    return allEvents.filter(
      (e) =>
        e.id !== event.id &&
        (e.venue_id === venueId || e.venueRoomId === venueId) &&
        (e.event_date === eventDate || e.date === eventDate) &&
        ['pending', 'awaiting_director_approval', 'recommended', 'approved'].includes(e.status?.toLowerCase())
    )
  }

  function handleOpenReview(event) {
    setSelectedEventForReview(event)
    setReviewModalOpen(true)
  }

  async function handleApproveClick(event) {
    const competing = getClashingRequests(event)
    const currentScore = event.combined_priority_score || event.priorityScore || 50

    const higherPriorityCompetitors = competing.filter(
      (c) =>
        ['pending', 'awaiting_director_approval', 'recommended'].includes(c.status?.toLowerCase()) &&
        (c.combined_priority_score || c.priorityScore || 0) > currentScore
    )

    if (higherPriorityCompetitors.length > 0) {
      // Must provide written justification
      setSelectedEventForApproval(event)
      setOverrideJustification('')
      setOverrideModalOpen(true)
    } else {
      // Direct approval
      setIsSubmitting(true)
      try {
        await decideEvent(event.id, {
          decision: 'approved',
          reason: 'Officially sanctioned and cleared by Campus Director.',
          byUserId: user?.id || 'user-director-1',
        })
        flash(`Event '${event.name || event.title}' officially APPROVED by Campus Director. Resource booking confirmed!`)
        if (reviewModalOpen) setReviewModalOpen(false)
        await loadData()
      } catch (e) {
        alert(`Error approving request: ${e.message}`)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  async function handleConfirmOverrideApproval() {
    if (!overrideJustification.trim() || overrideJustification.trim().length < 5) {
      alert('A written justification of at least 5 characters is strictly required to override priority per university governance.')
      return
    }

    setIsSubmitting(true)
    try {
      await decideEvent(selectedEventForApproval.id, {
        decision: 'approved',
        reason: overrideJustification.trim(),
        override_justification: overrideJustification.trim(),
        overridden: true,
        byUserId: user?.id || 'user-director-1',
      })
      flash(`Priority override recorded! Event '${selectedEventForApproval.name || selectedEventForApproval.title}' SANCTIONED with logged justification.`)
      setOverrideModalOpen(false)
      if (reviewModalOpen) setReviewModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Approval error: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenDecline(event) {
    setSelectedEventForDecline(event)
    setDeclineReasonType('Schedule conflict with university priority event')
    setDeclineNotes('')
    setDeclineModalOpen(true)
  }

  async function handleConfirmDecline() {
    if (!selectedEventForDecline) return
    setIsSubmitting(true)
    try {
      const fullReason = declineNotes.trim()
        ? `${declineReasonType}: ${declineNotes.trim()}`
        : declineReasonType

      await decideEvent(selectedEventForDecline.id, {
        decision: 'rejected',
        reason: fullReason,
        byUserId: user?.id || 'user-director-1',
      })
      flash(`Event request '${selectedEventForDecline.name || selectedEventForDecline.title}' declined. Requester and department council notified.`)
      setDeclineModalOpen(false)
      if (reviewModalOpen) setReviewModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Error declining request: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenAltVenue(event) {
    setSelectedEventForAlt(event)
    setAltVenueModalOpen(true)
  }

  async function handleReassignVenue(newRoomId) {
    if (!selectedEventForAlt) return
    setIsSubmitting(true)
    try {
      const targetRoom = rooms.find((r) => r.id === newRoomId)
      await selectEventAlternative(selectedEventForAlt.id, {
        selected_venue_id: newRoomId,
        selected_date: selectedEventForAlt.event_date || selectedEventForAlt.date,
        notes: `Reassigned to ${targetRoom?.name || newRoomId} by Campus Director to eliminate scheduling bottleneck.`,
      })
      flash(`Venue successfully reassigned to '${targetRoom?.name || newRoomId}'. Event status updated.`)
      setAltVenueModalOpen(false)
      if (reviewModalOpen) setReviewModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Error reassigning venue: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetDemoData() {
    if (confirm('Reset all demo event requests to standard initial testing state?')) {
      setIsSubmitting(true)
      try {
        if (typeof resetDemoEvents === 'function') {
          await resetDemoEvents()
        }
        flash('Demo requests reset to initial test state with pending symposium, summit, and competing hackathon clash!')
        await loadData()
      } catch (e) {
        alert(`Error resetting demo data: ${e.message}`)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  async function handleSimulatePreset(preset) {
    setIsSubmitting(true)
    try {
      await createEventRequest(preset)
      flash(`Simulated request '${preset.title}' successfully added!`)
      setSimulateModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Simulation error: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const pendingRequests = allEvents
    .filter((e) => ['pending', 'awaiting_director_approval', 'recommended', 'alternative_selected'].includes(e.status?.toLowerCase()))
    .sort((a, b) => {
      const scoreA = a.combined_priority_score || a.priorityScore || 0
      const scoreB = b.combined_priority_score || b.priorityScore || 0
      return scoreB - scoreA
    })

  const approvedEvents = allEvents.filter((e) => e.status?.toLowerCase() === 'approved')
  const rejectedEvents = allEvents.filter((e) => ['rejected', 'declined', 'changes_requested'].includes(e.status?.toLowerCase()))

  const displayedEvents =
    activeTab === 'pending'
      ? pendingRequests
      : activeTab === 'approved'
      ? approvedEvents
      : activeTab === 'rejected'
      ? rejectedEvents
      : allEvents

  const totalVenues = rooms.filter((r) => r.type === 'event_venue').length
  const totalClassrooms = rooms.filter((r) => r.type === 'classroom').length

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-rose-700 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🏛️</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-rose-200 text-base font-bold">✕</button>
        </div>
      )}

      {/* Official Amrita Portal Hero */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'dir-alert-1',
            title: `Central Approval Desk: ${pendingRequests.length} high-impact campus event & booking request(s) awaiting your final institutional clearance`,
            link: '#approvals',
          },
          {
            id: 'dir-alert-2',
            title: `Institution Governance Rule: Campus Director holds exclusive final approval authority for all campus resource bookings`,
            link: '#governance',
          },
        ]}
      />

      {/* Institutional KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-2xs">
          <span className="text-xs font-bold text-rose-800 uppercase">Awaiting Director Sanction</span>
          <div className="text-2xl font-black text-rose-950 mt-1">{pendingRequests.length} Requests</div>
          <p className="text-[11px] text-rose-700 mt-1">HOD &amp; Dean Reviewed</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Sanctioned Campus Events</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{approvedEvents.length} Approved</div>
          <p className="text-[11px] text-slate-500 mt-1">Confirmed University Events</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Institution Timetable Slots</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{timetableSlots.length} Scheduled</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Across All Departments</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Campus Facilities Monitored</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalVenues + totalClassrooms} Spaces</div>
          <p className="text-[11px] text-slate-500 mt-1">{totalVenues} Auditoriums · {totalClassrooms} Classrooms</p>
        </div>
      </section>

      {/* Centralized Director Approval Desk */}
      <section id="approvals" className="rounded-2xl border border-rose-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏛️</span>
              <h2 className="text-base font-bold text-slate-900">
                Centralized Final Approval Authority Desk
              </h2>
              <span className="bg-rose-100 text-rose-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Director Authority
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review, approve, or decline campus event requests and resource bookings with algorithmic priority scoring and override auditing.
            </p>
          </div>

          {/* Quick Action Simulation Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSimulateModalOpen(true)}
              className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs px-3 py-1.5 transition flex items-center gap-1.5 shadow-2xs"
            >
              <span>⚡</span>
              <span>+ Simulate Request</span>
            </button>
            <button
              onClick={handleResetDemoData}
              title="Reset demo events if table is empty"
              className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 transition"
            >
              🔄 Reset Demo Requests
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>⏳ Pending Clearance</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {pendingRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📑 All Campus Requests</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {allEvents.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'approved'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>✓ Approved &amp; Confirmed</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'approved' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {approvedEvents.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'rejected'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>✕ Declined</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'rejected' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {rejectedEvents.length}
            </span>
          </button>
        </div>

        {/* Requests List */}
        {displayedEvents.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 space-y-2">
            <div>✨ No requests currently found in this category.</div>
            <button
              onClick={handleResetDemoData}
              className="text-rose-700 font-extrabold hover:underline"
            >
              Click here to load realistic Amrita demo requests
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedEvents.map((req) => {
              const score = req.combined_priority_score || req.priorityScore || 50
              const isHighPrio = score >= 50
              const rec = req.department_recommendation || req.departmentRecommendation
              const isApproved = req.status?.toLowerCase() === 'approved'
              const isRejected = ['rejected', 'declined'].includes(req.status?.toLowerCase())
              const clashing = getClashingRequests(req)
              const hasHigherCompetitor = clashing.some(
                (c) =>
                  ['pending', 'awaiting_director_approval', 'recommended'].includes(c.status?.toLowerCase()) &&
                  (c.combined_priority_score || c.priorityScore || 0) > score
              )

              return (
                <div
                  key={req.id}
                  className={`rounded-xl border p-4 transition text-xs space-y-3 ${
                    isApproved
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : isRejected
                      ? 'border-slate-200 bg-slate-50/60 opacity-80'
                      : hasHigherCompetitor
                      ? 'border-amber-300 bg-amber-50/40 hover:bg-white'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-rose-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-sm">{req.name || req.title}</h4>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${isHighPrio ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'}`}>
                          {isHighPrio ? '⚡ High Priority' : 'Normal Priority'}
                        </span>
                        <span className="bg-rose-100 text-rose-900 font-bold px-2 py-0.5 rounded text-[10px]">
                          Combined Score: {score}
                        </span>
                        {rec && (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">
                            ✓ Endorsed: {rec}
                          </span>
                        )}
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                          isApproved
                            ? 'bg-emerald-600 text-white'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-indigo-100 text-indigo-900'
                        }`}>
                          Status: {req.status?.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <p className="text-slate-600 text-[11px]">
                        <strong>Organizer:</strong> {req.organizer || req.requestedBy} ({req.department || 'Academic Department'}) · <strong>Venue:</strong> {req.venue_id || req.venueRoomId} · <strong>Date:</strong> {req.event_date || req.date} ({req.start_slot || req.start} – {req.end_slot || req.end}) · <strong>Expected:</strong> {req.expected_audience || req.audienceSize || 100} pax
                      </p>

                      {req.department_reviewer_name && (
                        <p className="text-[11px] text-indigo-700 font-medium">
                          <strong>Department Endorsement:</strong> {req.department_reviewer_name} — <em>&quot;{req.department_review_notes || req.departmentReviewNotes || 'Recommended for director sanction.'}&quot;</em>
                        </p>
                      )}

                      {/* Clash indicator */}
                      {clashing.length > 0 && !isApproved && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-100/70 border border-amber-200 px-2.5 py-1 rounded-lg">
                          <span>⚠️</span>
                          <span>
                            <strong>Venue Competition:</strong> Clashes with {clashing.length} other request(s) on this date ({clashing.map((c) => `${c.name || c.title} [Prio ${c.combined_priority_score || c.priorityScore}]`).join(', ')}).
                            {hasHigherCompetitor && ' Approval will require written override justification.'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 lg:pt-0 flex-wrap">
                      <button
                        onClick={() => handleOpenReview(req)}
                        className="rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-extrabold text-xs px-3 py-1.5 border border-indigo-200 transition flex items-center gap-1"
                      >
                        <span>👁️</span>
                        <span>Review Details</span>
                      </button>

                      {!isApproved && !isRejected && (
                        <>
                          <button
                            onClick={() => handleApproveClick(req)}
                            disabled={isSubmitting}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 shadow-xs transition flex items-center gap-1"
                          >
                            <span>✓</span>
                            <span>Final Approve</span>
                          </button>

                          <button
                            onClick={() => handleOpenAltVenue(req)}
                            className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-2.5 py-1.5 border border-slate-300 transition"
                          >
                            Suggest Venue
                          </button>

                          <button
                            onClick={() => handleOpenDecline(req)}
                            className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3 py-1.5 border border-rose-200 transition"
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Institution-Wide Timetable Matrix Overview */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Institution-Wide Academic &amp; Space Scheduling Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Full visibility across Computer Science, Mathematics, Electronics, Mechanical and all academic blocks.
            </p>
          </div>
          <Link to="/timetable" className="text-xs font-semibold text-brand-600 hover:underline">
            Interactive Timetable Matrix →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">Amriteshwari Auditorium</span>
            <p className="text-slate-500 text-[11px]">Capacity: 1200 · University flagship hall with centralized AV &amp; climate control.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Operational · Bookable for Director-cleared events</div>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">Seminar Complex (AB1)</span>
            <p className="text-slate-500 text-[11px]">Capacity: 150 · Tiered seminar theater with automated priority arbitration.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Operational · 3 events hosted this week</div>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">Academic Classrooms (AB1 &amp; AB2)</span>
            <p className="text-slate-500 text-[11px]">8 classrooms · Home to B.Tech CSE, Int. M.Sc Data Science &amp; Labs.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Timetables Active · Strict Isolation Matrix Enforced</div>
          </div>
        </div>
      </section>

      {/* Institutional Audit Trail */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span>📜</span>
            <h3 className="text-sm font-bold text-slate-900">Institutional Governance &amp; Override Audit Trail</h3>
          </div>
          <span className="text-[11px] text-slate-400">Latest administrative actions</span>
        </div>
        <div className="space-y-2">
          {auditLogs.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center">No recorded actions yet.</div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{log.action?.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">{log.actorRole}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{log.details}</p>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ======================= MODALS ======================= */}

      {/* 1. REVIEW DETAILS MODAL */}
      {reviewModalOpen && selectedEventForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-5 border border-rose-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Campus Director Comprehensive Review
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
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

            {/* Description */}
            {selectedEventForReview.description && (
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                <strong>Description:</strong> {selectedEventForReview.description}
              </div>
            )}

            {/* Event Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Organizer</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.organizer || selectedEventForReview.requestedBy}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.department || 'Computer Science'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Event Level</span>
                <span className="font-extrabold text-rose-800 uppercase">{selectedEventForReview.event_level || selectedEventForReview.eventLevel || 'National'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Venue Assigned</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.venue_id || selectedEventForReview.venueRoomId}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Date &amp; Time</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.event_date || selectedEventForReview.date} ({selectedEventForReview.start_slot || selectedEventForReview.start} – {selectedEventForReview.end_slot || selectedEventForReview.end})</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected Attendance</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.expected_audience || selectedEventForReview.audienceSize || 100} Delegates</span>
              </div>
            </div>

            {/* Priority Score Breakdown */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-950">Algorithmic Priority Score Breakdown:</span>
                <span className="text-base font-black text-rose-900">
                  {selectedEventForReview.combined_priority_score || selectedEventForReview.priorityScore || 50} / 100
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Evaluated via $P = 0.60 \times R + 0.40 \times E$. Factors considered: Institutional tier, external VIP delegates, lead time, and classroom capacity utilization fit.
              </p>
            </div>

            {/* Department Review Endorsement */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-1.5 text-xs">
              <span className="font-bold text-indigo-950 block">Department &amp; Deanery Endorsements:</span>
              <p className="text-indigo-900">
                <strong>Review Status:</strong> {selectedEventForReview.department_recommendation || selectedEventForReview.departmentRecommendation || 'Pending Review'}
              </p>
              {selectedEventForReview.department_reviewer_name && (
                <p className="text-indigo-800">
                  <strong>Reviewer:</strong> {selectedEventForReview.department_reviewer_name}
                </p>
              )}
              <p className="text-indigo-700 italic">
                &quot;{selectedEventForReview.department_review_notes || selectedEventForReview.departmentReviewNotes || 'Endorsed for director clearance per department academic calendar.'}&quot;
              </p>
            </div>

            {/* Clash Warning in Modal */}
            {(() => {
              const clashing = getClashingRequests(selectedEventForReview)
              if (clashing.length === 0) return null
              return (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-900 space-y-1">
                  <p className="font-bold">⚠️ Venue Contention Detected:</p>
                  <p>
                    {clashing.length} competing booking request(s) on the same date/slot:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {clashing.map((c) => (
                      <li key={c.id}>
                        <strong>{c.name || c.title}</strong> — Priority Score: {c.combined_priority_score || c.priorityScore} (Status: {c.status})
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenAltVenue(selectedEventForReview)}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-2 border border-slate-300"
                >
                  Suggest Venue
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDecline(selectedEventForReview)}
                  className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3.5 py-2 border border-rose-200"
                >
                  Decline Request
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleApproveClick(selectedEventForReview)}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 shadow-sm transition"
                >
                  ✓ Sanction &amp; Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PRIORITY OVERRIDE JUSTIFICATION MODAL */}
      {overrideModalOpen && selectedEventForApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-rose-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Priority Override Justification Required
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Sanction: {selectedEventForApproval.name || selectedEventForApproval.title}
                </h3>
              </div>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold">⚠️ Institutional Governance Rule:</p>
              <p>
                A competing request with higher algorithmic priority exists for this venue/date slot.
                As Campus Director, you have authority to approve this request, but a <strong>written justification</strong> is strictly recorded in the immutable audit log.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Official Campus Director Override Justification:
              </label>
              <textarea
                rows={3}
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                placeholder="e.g. Sanctioned per institutional directive for strategic student innovation initiative by Campus Director."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmOverrideApproval}
                className="rounded-lg bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 text-xs font-extrabold shadow-sm transition"
              >
                {isSubmitting ? 'Recording Override…' : 'Confirm & Sanction with Justification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DECLINE MODAL */}
      {declineModalOpen && selectedEventForDecline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-rose-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                  Decline Campus Event Request
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {selectedEventForDecline.name || selectedEventForDecline.title}
                </h3>
              </div>
              <button
                onClick={() => setDeclineModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Standard Reason:</label>
                <select
                  value={declineReasonType}
                  onChange={(e) => setDeclineReasonType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-rose-500 focus:outline-none"
                >
                  <option value="Schedule conflict with university priority event">Schedule conflict with university priority event</option>
                  <option value="Venue capacity unsuitable for expected audience">Venue capacity unsuitable for expected audience</option>
                  <option value="Incomplete documentation / missing external clearance">Incomplete documentation / missing external clearance</option>
                  <option value="Institutional resource freeze period">Institutional resource freeze period</option>
                  <option value="Declined per Campus Director directive">Declined per Campus Director directive</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Director Notes / Feedback for Requester:</label>
                <textarea
                  rows={3}
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                  placeholder="Optional details or alternative guidance for the organizer..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeclineModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDecline}
                className="rounded-lg bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 text-xs font-extrabold shadow-sm transition"
              >
                {isSubmitting ? 'Declining…' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ALTERNATIVE VENUE RECOMMENDATION MODAL */}
      {altVenueModalOpen && selectedEventForAlt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-rose-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                  Intelligent Venue Reallocation
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Reassign Venue for: {selectedEventForAlt.name || selectedEventForAlt.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Expected delegates: {selectedEventForAlt.expected_audience || selectedEventForAlt.audienceSize || 100} pax · Date: {selectedEventForAlt.event_date || selectedEventForAlt.date}
                </p>
              </div>
              <button
                onClick={() => setAltVenueModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs max-h-72 overflow-y-auto">
              {rooms
                .filter((r) => r.type === 'event_venue' || r.capacity >= 50)
                .map((rm) => {
                  const currentRoomId = selectedEventForAlt.venue_id || selectedEventForAlt.venueRoomId
                  const isCurrent = rm.id === currentRoomId
                  const expectedPax = selectedEventForAlt.expected_audience || selectedEventForAlt.audienceSize || 100
                  const isFitting = rm.capacity >= expectedPax

                  return (
                    <div
                      key={rm.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'border-rose-400 bg-rose-50/50'
                          : isFitting
                          ? 'border-slate-200 hover:border-indigo-400 bg-white'
                          : 'border-slate-100 bg-slate-50/50 opacity-70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">{rm.name}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.2 rounded font-semibold">
                            Cap: {rm.capacity}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-rose-200 text-rose-900 font-black px-1.5 py-0.2 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Building: {rm.building} · Floor: {rm.floor || 'G'} · {rm.notes || 'Auditorium facility'}
                        </p>
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleReassignVenue(rm.id)}
                          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 transition shrink-0"
                        >
                          Reassign Venue →
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAltVenueModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SIMULATE NEW REQUEST MODAL */}
      {simulateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-rose-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                  Simulation Testing Lab
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Inject Realistic Event Proposal
                </h3>
                <p className="text-xs text-slate-500">
                  Select a test scenario to evaluate Director approval, priority override, or review flows.
                </p>
              </div>
              <button
                onClick={() => setSimulateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  handleSimulatePreset({
                    title: 'Indo-German Sustainable Tech Expo 2026',
                    description: 'International collaborative exposition with European partner universities.',
                    venueRoomId: 'venue-auditorium',
                    requestedBy: 'Prof. Ramakrishnan (Deanery)',
                    date: '2026-10-25',
                    start: '09:00',
                    end: '17:00',
                    audienceSize: 750,
                    eventLevel: 'international',
                    academic: true,
                    externalGuests: true,
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">Indo-German Sustainable Tech Expo</span>
                  <span className="bg-rose-100 text-rose-900 font-bold px-1.5 py-0.2 rounded text-[10px]">High Priority (94)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">International · Main Auditorium · 750 pax</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSimulatePreset({
                    title: 'Student Open Source Codefest Clash',
                    description: 'Student club hackathon requesting Seminar Hall AB1.',
                    venueRoomId: 'venue-seminar-ab1',
                    requestedBy: 'Aarav Menon (Coding Club)',
                    date: '2026-10-20',
                    start: '10:00',
                    end: '16:00',
                    audienceSize: 90,
                    eventLevel: 'department',
                    academic: false,
                    externalGuests: false,
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">Student Open Source Codefest (Clash Test)</span>
                  <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded text-[10px]">Normal (44) · Tests Override!</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Seminar Hall AB1 on 2026-10-20 · Competing with EV Summit</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSimulatePreset({
                    title: 'Computational Biology National Workshop',
                    description: 'Hands-on symposium with AIIMS & IISc delegates.',
                    venueRoomId: 'venue-seminar-ab1',
                    requestedBy: 'Dr Kalaivani (Math Dept)',
                    date: '2026-10-28',
                    start: '09:00',
                    end: '15:30',
                    audienceSize: 110,
                    eventLevel: 'national',
                    academic: true,
                    externalGuests: true,
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">Computational Biology National Workshop</span>
                  <span className="bg-indigo-100 text-indigo-900 font-bold px-1.5 py-0.2 rounded text-[10px]">High Priority (82)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">National · Seminar Hall AB1 · 110 pax</p>
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
