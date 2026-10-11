import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listRooms,
  listEvents,
  recommendEvent,
  listTimetableSlots,
} from '../../../lib/dataClient'
import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function DeanDashboard({ user }) {
  const [rooms, setRooms] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [timetableSlots, setTimetableSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  // Recommendation modal state
  const [recModalOpen, setRecModalOpen] = useState(false)
  const [activeEvent, setActiveEvent] = useState(null)
  const [recDecision, setRecDecision] = useState('RECOMMENDED')
  const [recNotes, setRecNotes] = useState('')
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
    setTimeout(() => setFlashMsg(''), 5000)
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
        notes: recNotes.trim() || `Reviewed and ${recDecision.toLowerCase()} by Deanery of Engineering.`,
        byUserId: user?.id,
        byUserName: user?.name,
      })
      flash(`Official Dean Recommendation (${recDecision}) forwarded to the Campus Director for final sanction!`)
      setRecModalOpen(false)
      loadData()
    } catch (e) {
      alert(`Error submitting recommendation: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const pendingRequests = allEvents.filter(
    (e) => ['pending', 'under_review'].includes(e.status?.toLowerCase())
  )

  const recommendedRequests = allEvents.filter(
    (e) => ['recommended', 'awaiting_director_approval'].includes(e.status?.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-indigo-700 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🎓</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-indigo-200">✕</button>
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
          <span className="text-xs font-bold text-indigo-800 uppercase">Requests Pending Dean Review</span>
          <div className="text-2xl font-black text-indigo-950 mt-1">{pendingRequests.length} Events</div>
          <p className="text-[11px] text-indigo-700 mt-1">Awaiting School Recommendation</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Forwarded to Director</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{recommendedRequests.length} Recommended</div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
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
              Review engineering event proposals, check departmental feasibility, and submit formal recommendations to the Campus Director.
            </p>
          </div>
          <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
            ℹ️ Final approval authority: Campus Director
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            ✨ No pending department requests requiring Dean review.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition text-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">{req.name || req.title}</h4>
                      <span className="bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded text-[10px]">
                        Priority: {req.combined_priority_score || req.priorityScore || 50}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-1">
                      Organizer: {req.organizer || req.requestedBy} · Venue: {req.venue_id || req.venueRoomId} · Date: {req.event_date || req.date} ({req.start_slot || req.start} – {req.end_slot || req.end})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openRecommendModal(req, 'RECOMMENDED')}
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 py-1.5 shadow-xs transition"
                    >
                      Recommend to Director →
                    </button>
                    <button
                      onClick={() => openRecommendModal(req, 'CHANGES_REQUESTED')}
                      className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs px-3 py-1.5 border border-amber-200 transition"
                    >
                      Request Modifications
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Authorized School Scope Timetable Access */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              School of Engineering Academic Timetable Overview
            </h3>
            <p className="text-xs text-slate-500">
              Authorized access to schedules, faculty teaching slots, and departmental lab sessions.
            </p>
          </div>
          <Link to="/timetable" className="text-xs font-semibold text-brand-600 hover:underline">
            View Full Timetable Grid →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-extrabold text-slate-900 block">Computer Science (CSE)</span>
            <p className="text-slate-500 text-[11px] mt-1">B.Tech &amp; Int. M.Sc programs</p>
            <span className="text-emerald-700 font-bold text-[10px] mt-2 block">● Fully Authorized</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-extrabold text-slate-900 block">Electronics (ECE)</span>
            <p className="text-slate-500 text-[11px] mt-1">Hardware &amp; Signal Labs</p>
            <span className="text-emerald-700 font-bold text-[10px] mt-2 block">● Fully Authorized</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-extrabold text-slate-900 block">Mechanical (MECH)</span>
            <p className="text-slate-500 text-[11px] mt-1">Design &amp; Prototyping</p>
            <span className="text-emerald-700 font-bold text-[10px] mt-2 block">● Fully Authorized</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-extrabold text-slate-900 block">Mathematics (MATH)</span>
            <p className="text-slate-500 text-[11px] mt-1">Core foundational courses</p>
            <span className="text-emerald-700 font-bold text-[10px] mt-2 block">● Fully Authorized</span>
          </div>
        </div>
      </section>

      {/* Recommendation Submission Modal */}
      {recModalOpen && activeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-indigo-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                  Dean Official Recommendation
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

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Recommendation Status:
                </label>
                <select
                  value={recDecision}
                  onChange={(e) => setRecDecision(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold"
                >
                  <option value="RECOMMENDED">RECOMMENDED (Forward to Campus Director for Sanction)</option>
                  <option value="CHANGES_REQUESTED">CHANGES_REQUESTED (Return to Requester for Revisions)</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW (Requires Further Department Consultation)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Dean Review Notes &amp; Recommendation Details:
                </label>
                <textarea
                  rows={3}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  placeholder="e.g. Recommended by Deanery of Engineering. Academic schedule and student participation aligned."
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
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-extrabold shadow-sm transition"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Recommendation to Director'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
