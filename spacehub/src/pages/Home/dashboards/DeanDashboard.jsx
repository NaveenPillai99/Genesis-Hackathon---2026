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

export default function DeanDashboard({ user }) {
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
        notes: recNotes.trim() || `Reviewed and ${recDecision.toLowerCase()} by Deanery of Engineering (${user?.name || 'Dean'}).`,
        byUserId: user?.id || 'user-dean-1',
        byUserName: user?.name || 'Prof. Shankar Nair (Dean)',
      })
      flash(`Official Dean Recommendation (${recDecision}) forwarded to the Campus Director for final sanction!`)
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
    if (confirm('Reset demo events to initial state?')) {
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
      flash(`Simulated request '${preset.title}' submitted for Deanery review!`)
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
        <div className="rounded-xl bg-indigo-700 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🎓</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-indigo-200 text-base font-bold">✕</button>
        </div>
      )}

      {/* Official Amrita Portal Hero */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'dean-alert-1',
            title: `Deanery Oversight: Reviewing engineering departments (CSE, ECE, MECH, MATH). Final approval authority resides with Campus Director`,
            link: '#reviews',
          },
        ]}
      />

      {/* Deanery KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-2xs">
          <span className="text-xs font-bold text-indigo-800 uppercase">Pending Dean Review</span>
          <div className="text-2xl font-black text-indigo-950 mt-1">{pendingRequests.length} Events</div>
          <p className="text-[11px] text-indigo-700 mt-1">Awaiting School Recommendation</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Forwarded to Director</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{forwardedRequests.length} Recommended</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting Campus Director Sanction</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Engineering Departments</span>
          <div className="text-2xl font-black text-slate-900 mt-1">4 Departments</div>
          <p className="text-[11px] text-slate-500 mt-1">CSE · ECE · MECH · MATH</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">School Timetable Slots</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{timetableSlots.length} Active Slots</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Academic Year 2026-27</p>
        </div>
      </section>

      {/* Department Requests Recommendation Desk */}
      <section id="reviews" className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h2 className="text-base font-bold text-slate-900">
                School Event Review &amp; Recommendation Desk
              </h2>
              <span className="bg-indigo-100 text-indigo-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Dean Scope
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review proposals across Engineering departments and submit official recommendations to the Campus Director.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSimulateModalOpen(true)}
              className="rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold text-xs px-3 py-1.5 transition flex items-center gap-1.5"
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
                ? 'bg-indigo-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Pending Dean Review</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {pendingRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('forwarded')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'forwarded'
                ? 'bg-indigo-700 text-white shadow-2xs'
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
                ? 'bg-indigo-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>All School Requests</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {allEvents.length}
            </span>
          </button>
        </div>

        {/* Requests List */}
        {displayedRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <div>✨ No requests in this view.</div>
            <button onClick={handleResetDemoData} className="text-indigo-700 font-extrabold hover:underline">
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
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition text-xs space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-sm">{req.name || req.title}</h4>
                        <span className="bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded text-[10px]">
                          Priority Score: {score}
                        </span>
                        {rec && (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">
                            ✓ Recommended: {rec}
                          </span>
                        )}
                        <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          Status: {req.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Organizer: {req.organizer || req.requestedBy} · Department: {req.department || 'CSE'} · Venue: {req.venue_id || req.venueRoomId} · Date: {req.event_date || req.date} ({req.start_slot || req.start} – {req.end_slot || req.end})
                      </p>
                      {req.department_reviewer_name && (
                        <p className="text-[11px] text-indigo-700">
                          Reviewed by: {req.department_reviewer_name} — <em>&quot;{req.department_review_notes || req.departmentReviewNotes}&quot;</em>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleOpenReview(req)}
                        className="rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs px-3 py-1.5 border border-indigo-200 transition flex items-center gap-1"
                      >
                        <span>👁️</span>
                        <span>Review Details</span>
                      </button>

                      {['pending', 'under_review'].includes(req.status?.toLowerCase()) && (
                        <>
                          <button
                            onClick={() => openRecommendModal(req, 'RECOMMENDED')}
                            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-1.5 shadow-xs transition"
                          >
                            Recommend to Director →
                          </button>
                          <button
                            onClick={() => openRecommendModal(req, 'CHANGES_REQUESTED')}
                            className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs px-3 py-1.5 border border-amber-200 transition"
                          >
                            Request Modifications
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

      {/* School Matrix Overview */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              School of Engineering Academic Facilities &amp; Departments
            </h3>
            <p className="text-xs text-slate-500">
              Department scheduling compliance under Dean of Engineering oversight.
            </p>
          </div>
          <Link to="/timetable" className="text-xs font-semibold text-brand-600 hover:underline">
            View Timetable Matrix →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">Computer Science (CSE)</span>
            <p className="text-slate-500 text-[11px]">8 undergraduate &amp; postgraduate sections active in AB1 &amp; AB2.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Full Compliance</div>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">Electronics (ECE)</span>
            <p className="text-slate-500 text-[11px]">VLSI, Embedded Systems and Signals laboratories.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Full Compliance</div>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">Mechanical Engineering</span>
            <p className="text-slate-500 text-[11px]">Robotics &amp; Advanced Manufacturing workshops.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Full Compliance</div>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
            <span className="font-extrabold text-slate-900 block mb-1">Mathematics &amp; DS</span>
            <p className="text-slate-500 text-[11px]">Int. M.Sc Data Science &amp; Computing labs.</p>
            <div className="mt-2 text-emerald-700 font-bold text-[10px]">● Full Compliance</div>
          </div>
        </div>
      </section>

      {/* ======================= MODALS ======================= */}

      {/* 1. REVIEW DETAILS MODAL */}
      {reviewModalOpen && selectedEventForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-indigo-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">
                  Deanery Proposal Review
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
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.department || 'CSE'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Venue &amp; Slot</span>
                <span className="font-extrabold text-slate-900">{selectedEventForReview.venue_id || selectedEventForReview.venueRoomId} · {selectedEventForReview.event_date || selectedEventForReview.date}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Priority Score</span>
                <span className="font-extrabold text-indigo-900">{selectedEventForReview.combined_priority_score || selectedEventForReview.priorityScore || 50} / 100</span>
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
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 shadow-xs transition"
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-indigo-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                  Official Dean Recommendation
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
              <p className="font-bold">ℹ️ Governance Notice:</p>
              <p>
                Your recommendation will be submitted to the <strong>Campus Director</strong>, who holds the exclusive final sanction authority for campus event allocations.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Deanery Recommendation:</label>
                <select
                  value={recDecision}
                  onChange={(e) => setRecDecision(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="RECOMMENDED">RECOMMENDED (Endorse for Campus Director Sanction)</option>
                  <option value="CHANGES_REQUESTED">CHANGES REQUESTED (Return to Department for Revision)</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW (Pending Academic Calendar Feasibility)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Dean Notes &amp; Feasibility Comments:</label>
                <textarea
                  rows={3}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  placeholder="e.g. Reviewed and strongly recommended for Campus Director clearance. High academic research merit."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-indigo-500 focus:outline-none"
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
                className="rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 text-xs font-extrabold shadow-sm transition"
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-indigo-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
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
                    title: 'School of Engineering Hackathon & Demo Day',
                    description: 'Cross-departmental hackathon for CSE and ECE students.',
                    venueRoomId: 'venue-seminar-ab1',
                    requestedBy: 'Prof. Shankar Nair (Dean)',
                    date: '2026-10-27',
                    start: '09:00',
                    end: '18:00',
                    audienceSize: 130,
                    eventLevel: 'regional',
                    academic: true,
                    externalGuests: false,
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">Engineering Hackathon &amp; Demo Day</span>
                  <span className="bg-indigo-100 text-indigo-900 font-bold px-1.5 py-0.2 rounded text-[10px]">Priority ~78</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Regional · Seminar Hall AB1 · 130 pax</p>
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
