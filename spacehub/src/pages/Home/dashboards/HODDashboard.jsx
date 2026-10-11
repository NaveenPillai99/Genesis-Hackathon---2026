import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listRooms,
  listEvents,
  recommendEvent,
  createEventRequest,
  resetDemoEvents,
  listTimetableSlots,
} from '../../../lib/dataClient'
import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function HODDashboard({ user }) {
  const [rooms, setRooms] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [timetableSlots, setTimetableSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'forwarded' | 'all'

  // Recommendation modal state
  const [recModalOpen, setRecModalOpen] = useState(false)
  const [activeEvent, setActiveEvent] = useState(null)
  const [recDecision, setRecDecision] = useState('RECOMMENDED')
  const [recNotes, setRecNotes] = useState('')

  // Review Details modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedEventForReview, setSelectedEventForReview] = useState(null)

  // Simulation modal
  const [simulateModalOpen, setSimulateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const departmentName = user?.department || 'Computer Science & Engineering'

  async function loadData() {
    setLoading(true)
    try {
      const [rms, evts, slots] = await Promise.all([
        listRooms().catch(() => []),
        listEvents().catch(() => []),
        listTimetableSlots().catch(() => []),
      ])
      setRooms(rms || [])
      setAllEvents(evts || [])
      setTimetableSlots(slots || [])
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

  function handleOpenReview(evt) {
    setSelectedEventForReview(evt)
    setReviewModalOpen(true)
  }

  function openRecommendModal(evt, initialDecision = 'RECOMMENDED') {
    setActiveEvent(evt)
    setRecDecision(initialDecision)
    setRecNotes('')
    setRecModalOpen(true)
  }

  async function submitRecommendation() {
    if (!activeEvent) return
    setIsSubmitting(true)
    try {
      await recommendEvent(activeEvent.id, {
        recommendation: recDecision,
        notes: recNotes.trim() || `Department review completed and ${recDecision.toLowerCase()} by HOD (${user?.name || 'Dr Prema N'}).`,
        byUserId: user?.id || 'user-hod-1',
        byUserName: user?.name || 'Dr Prema Nedungadi (HOD CSE)',
      })
      flash(`Official HOD Recommendation (${recDecision}) forwarded to the Campus Director for final sanction!`)
      setRecModalOpen(false)
      if (reviewModalOpen) setReviewModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Error submitting recommendation: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetDemoData() {
    if (confirm('Reset demo events to initial test state?')) {
      setIsSubmitting(true)
      try {
        if (typeof resetDemoEvents === 'function') {
          await resetDemoEvents()
        }
        flash('Demo requests reset to initial test state!')
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
      flash(`Simulated proposal '${preset.title}' submitted for HOD review!`)
      setSimulateModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Simulation error: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const pendingRequests = allEvents.filter(
    (e) => ['pending', 'under_review'].includes(e.status?.toLowerCase())
  )

  const forwardedRequests = allEvents.filter(
    (e) => ['recommended', 'awaiting_director_approval'].includes(e.status?.toLowerCase())
  )

  const displayedRequests =
    activeTab === 'pending'
      ? pendingRequests
      : activeTab === 'forwarded'
      ? forwardedRequests
      : allEvents

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-blue-700 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🏢</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-blue-200 text-base font-bold">✕</button>
        </div>
      )}

      {/* Official Amrita Portal Hero */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'hod-alert-1',
            title: `Department Scope: ${departmentName}. Full authority over department timetable, batches & faculty schedules`,
            link: '#reviews',
          },
        ]}
      />

      {/* HOD KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <span className="text-xs font-bold text-blue-800 uppercase">Department Requests</span>
          <div className="text-2xl font-black text-blue-950 mt-1">{pendingRequests.length} Pending</div>
          <p className="text-[11px] text-blue-700 mt-1">Requiring HOD Endorsement</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Awaiting Director Sanction</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{forwardedRequests.length} Forwarded</div>
          <p className="text-[11px] text-slate-500 mt-1">Recommended to Director</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Department Timetable Slots</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{timetableSlots.length} Slots</div>
          <p className="text-[11px] text-slate-500 mt-1">All CSE Batches &amp; Sections</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Department Faculty</span>
          <div className="text-2xl font-black text-slate-900 mt-1">18 Faculty</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Full Timetable Access</p>
        </div>
      </section>

      {/* Department Review & Recommendation Submission Desk */}
      <section id="reviews" className="rounded-2xl border border-blue-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏢</span>
              <h2 className="text-base font-bold text-slate-900">
                Department Event Request Review Desk
              </h2>
              <span className="bg-blue-100 text-blue-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                HOD Scope
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review proposals originating from {departmentName} and submit official recommendations to the Campus Director.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSimulateModalOpen(true)}
              className="rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold text-xs px-3 py-1.5 transition flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>+ Simulate Proposal</span>
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
                ? 'bg-blue-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Pending HOD Review</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {pendingRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('forwarded')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'forwarded'
                ? 'bg-blue-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Forwarded to Director</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'forwarded' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {forwardedRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-blue-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>All Department Requests</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {allEvents.length}
            </span>
          </button>
        </div>

        {/* Requests List */}
        {displayedRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <div>✨ No requests currently pending in this view.</div>
            <button onClick={handleResetDemoData} className="text-blue-700 font-extrabold hover:underline">
              Click here to load demo proposals for review
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedRequests.map((req) => {
              const score = req.combined_priority_score || req.priorityScore || 50
              const rec = req.department_recommendation || req.departmentRecommendation

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition text-xs space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-sm">{req.name || req.title}</h4>
                        <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[10px]">
                          Priority Score: {score}
                        </span>
                        {rec && (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">
                            ✓ HOD Recommended: {rec}
                          </span>
                        )}
                        <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          Status: {req.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Organizer: {req.organizer || req.requestedBy} · Venue: {req.venue_id || req.venueRoomId} · Date: {req.event_date || req.date} ({req.start_slot || req.start} – {req.end_slot || req.end})
                      </p>
                      {req.department_reviewer_name && (
                        <p className="text-[11px] text-blue-700">
                          Reviewed by: {req.department_reviewer_name} — <em>&quot;{req.department_review_notes || req.departmentReviewNotes}&quot;</em>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleOpenReview(req)}
                        className="rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs px-3 py-1.5 border border-blue-200 transition flex items-center gap-1"
                      >
                        <span>👁️</span>
                        <span>Review Details</span>
                      </button>

                      {['pending', 'under_review'].includes(req.status?.toLowerCase()) ? (
                        <>
                          <button
                            onClick={() => openRecommendModal(req, 'RECOMMENDED')}
                            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-1.5 shadow-xs transition"
                          >
                            Recommend to Director →
                          </button>
                          <button
                            onClick={() => openRecommendModal(req, 'CHANGES_REQUESTED')}
                            className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs px-3 py-1.5 border border-amber-200 transition"
                          >
                            Request Changes
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openRecommendModal(req, rec === 'CHANGES_REQUESTED' ? 'RECOMMENDED' : 'CHANGES_REQUESTED')}
                          className="rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3 py-1.5 border border-blue-200 transition flex items-center gap-1"
                          title="Update recommendation sent to Director"
                        >
                          <span>🔄</span>
                          <span>Update Recommendation</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Department Timetable Management Overview */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Department Academic Classrooms &amp; Laboratories
            </h3>
            <p className="text-xs text-slate-500">
              Timetable schedules and space assignments managed by HOD.
            </p>
          </div>
          <Link to="/academic-scheduling" className="text-xs font-semibold text-brand-600 hover:underline">
            Manage Timetables →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">AB1-E103B (Int. M.Sc DS VII B)</span>
            <p className="text-slate-500 text-[11px]">Core lecture hall · 22 hours scheduled weekly.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Active Timetable</div>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">AB1-W102 (Open Lab-I)</span>
            <p className="text-slate-500 text-[11px]">Computing lab · Hadoop &amp; Data Science practicals.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Active Timetable</div>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">AB1-E104 (B.Tech CSE VII)</span>
            <p className="text-slate-500 text-[11px]">Elective classroom &amp; departmental workshop space.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Active Timetable</div>
          </div>
        </div>
      </section>

      {/* ======================= MODALS ======================= */}

      {/* 1. REVIEW DETAILS MODAL */}
      {reviewModalOpen && selectedEventForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-blue-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                  Department Proposal Review
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

            {selectedEventForReview.description && (
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                <strong>Description:</strong> {selectedEventForReview.description}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Organizer</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.organizer || selectedEventForReview.requestedBy}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Venue &amp; Slot</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.venue_id || selectedEventForReview.venueRoomId} · {selectedEventForReview.event_date || selectedEventForReview.date}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected Attendance</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.expected_audience || selectedEventForReview.audienceSize || 60} pax</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Priority Score</span>
                <span className="font-extrabold text-blue-900">{selectedEventForReview.combined_priority_score || selectedEventForReview.priorityScore || 50} / 100</span>
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
              {['pending', 'under_review'].includes(selectedEventForReview.status?.toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => openRecommendModal(selectedEventForReview, 'RECOMMENDED')}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2 shadow-xs transition"
                >
                  Proceed to Recommendation →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. RECOMMENDATION SUBMISSION MODAL */}
      {recModalOpen && activeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  HOD Department Recommendation
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {activeEvent.name || activeEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setRecModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold">ℹ️ Approval Chain Notice:</p>
              <p>
                Your recommendation will be forwarded to the <strong>Campus Director</strong> for final sanction.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Department Recommendation:</label>
                <select
                  value={recDecision}
                  onChange={(e) => setRecDecision(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                >
                  <option value="RECOMMENDED">RECOMMENDED (Endorse for Campus Director Sanction)</option>
                  <option value="CHANGES_REQUESTED">CHANGES REQUESTED (Return to Organizer for Revision)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">HOD Review Notes &amp; Feasibility Comments:</label>
                <textarea
                  rows={3}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  placeholder="e.g. Endorsed by Department Council. Timetable alignment verified."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRecModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitRecommendation}
                className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 text-xs font-extrabold shadow-sm transition"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Recommendation to Director →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SIMULATE MODAL */}
      {simulateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  Simulation Testing Lab
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Simulate Department Proposal
                </h3>
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
                    title: 'Department Web3 & Decentralized Systems Colloquium',
                    description: 'Department guest lecture and student project demo in AB1-E104.',
                    venueRoomId: 'room-ab1-e104',
                    requestedBy: 'Dr Prema Nedungadi (HOD CSE)',
                    date: '2026-10-26',
                    start: '14:00',
                    end: '17:00',
                    audienceSize: 55,
                    eventLevel: 'department',
                    academic: true,
                    externalGuests: false,
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">Web3 &amp; Decentralized Systems Colloquium</span>
                  <span className="bg-blue-100 text-blue-900 font-bold px-1.5 py-0.2 rounded text-[10px]">Priority ~68</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Department · AB1-E104 · 55 pax</p>
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
