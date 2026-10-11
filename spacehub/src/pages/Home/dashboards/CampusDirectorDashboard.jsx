import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listRooms,
  listEvents,
  decideEvent,
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

  // Override Justification Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [selectedEventForApproval, setSelectedEventForApproval] = useState(null)
  const [overrideJustification, setOverrideJustification] = useState('')
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

  async function handleApproveClick(event) {
    // Check if competing request exists with higher priority
    const competing = allEvents.filter(
      (e) =>
        e.id !== event.id &&
        (e.venue_id === event.venue_id || e.venueRoomId === event.venueRoomId) &&
        (e.event_date === event.event_date || e.date === event.date) &&
        ['pending', 'awaiting_director_approval', 'recommended'].includes(e.status?.toLowerCase())
    )

    const higherPriorityCompetitors = competing.filter(
      (c) => (c.combined_priority_score || c.priorityScore || 0) > (event.combined_priority_score || event.priorityScore || 0)
    )

    if (higherPriorityCompetitors.length > 0) {
      // Must provide written justification
      setSelectedEventForApproval(event)
      setOverrideJustification('')
      setOverrideModalOpen(true)
    } else {
      // Direct approval
      try {
        await decideEvent(event.id, {
          decision: 'approved',
          reason: 'Officially sanctioned and approved by Campus Director.',
          byUserId: user?.id,
        })
        flash(`Event '${event.name || event.title}' officially APPROVED by Campus Director. Booking confirmed!`)
        loadData()
      } catch (e) {
        alert(`Error approving request: ${e.message}`)
      }
    }
  }

  async function handleConfirmOverrideApproval() {
    if (!overrideJustification.trim() || overrideJustification.trim().length < 5) {
      alert('A written justification of at least 5 characters is strictly required to override priority.')
      return
    }

    setIsSubmitting(true)
    try {
      await decideEvent(selectedEventForApproval.id, {
        decision: 'approved',
        reason: overrideJustification.trim(),
        override_justification: overrideJustification.trim(),
        overridden: true,
        byUserId: user?.id,
      })
      flash(`Priority override recorded! Event '${selectedEventForApproval.name || selectedEventForApproval.title}' APPROVED with audited justification.`)
      setOverrideModalOpen(false)
      loadData()
    } catch (e) {
      alert(`Approval error: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReject(event) {
    const reason = prompt('Please enter reason for declining this request:')
    if (reason === null) return

    try {
      await decideEvent(event.id, {
        decision: 'rejected',
        reason: reason.trim() || 'Declined by Campus Director directive.',
        byUserId: user?.id,
      })
      flash(`Event request marked as REJECTED. Requester notified.`)
      loadData()
    } catch (e) {
      alert(`Error rejecting request: ${e.message}`)
    }
  }

  const pendingRequests = allEvents
    .filter((e) => ['pending', 'awaiting_director_approval', 'recommended'].includes(e.status?.toLowerCase()))
    .sort((a, b) => {
      const scoreA = a.combined_priority_score || a.priorityScore || 0
      const scoreB = b.combined_priority_score || b.priorityScore || 0
      return scoreB - scoreA
    })

  const approvedEvents = allEvents.filter((e) => e.status?.toLowerCase() === 'approved')
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
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-rose-200">✕</button>
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
            title: `Institution Governance Rule: Campus Director holds final approval authority for all campus resource allocations`,
            link: '#governance',
          },
        ]}
      />

      {/* Institutional KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-2xs">
          <span className="text-xs font-bold text-rose-800 uppercase">Awaiting Director Approval</span>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
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
              Exclusive final sanction for campus event requests and resource bookings with automated priority scoring and override auditing.
            </p>
          </div>
          <div className="text-xs font-bold text-slate-500">
            {pendingRequests.length} pending review
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            ✨ All event requests and resource bookings have been evaluated and resolved!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => {
              const score = req.combined_priority_score || req.priorityScore || 50
              const isHighPrio = score >= 50
              const rec = req.department_recommendation || req.departmentRecommendation

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-white hover:border-rose-300 transition text-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
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
                            ✓ Department: {rec}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-[11px] mt-1">
                        Organizer: {req.organizer || req.requestedBy} · Venue: {req.venue_id || req.venueRoomId} · Date: {req.event_date || req.date} ({req.start_slot || req.start} – {req.end_slot || req.end}) · Expected Audience: {req.expected_audience || req.audienceSize || 100}
                      </p>
                      {req.department_reviewer_name && (
                        <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
                          Reviewed by: {req.department_reviewer_name} · Notes: {req.department_review_notes || 'Recommended for sanction.'}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0">
                      <button
                        onClick={() => handleApproveClick(req)}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-1.5 shadow-xs transition flex items-center gap-1"
                      >
                        <span>✓</span>
                        <span>Final Approve</span>
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3 py-1.5 border border-rose-200 transition"
                      >
                        Decline
                      </button>
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
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Timetables Active · Strict Student Isolation Matrix Enforced</div>
          </div>
        </div>
      </section>

      {/* Priority Override Modal */}
      {overrideModalOpen && selectedEventForApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-rose-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Priority Override Justification Required
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Approve: {selectedEventForApproval.name || selectedEventForApproval.title}
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
              <p className="font-bold">⚠️ Institutional Priority Rule:</p>
              <p>
                A competing request with higher algorithmic priority exists for this venue/date slot.
                As Campus Director, you may sanction this request, but a <strong>written justification</strong> is strictly required for the audit trail.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Official Director Override Justification:
              </label>
              <textarea
                rows={3}
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                placeholder="e.g. Approved per institutional priority directive for strategic student initiative by Campus Director."
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
    </div>
  )
}
