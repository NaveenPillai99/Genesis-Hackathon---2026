import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listRooms,
  listEvents,
  recommendEvent,
  listTimetableSlots,
} from '../../../lib/dataClient'
import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function HODDashboard({ user }) {
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
        notes: recNotes.trim() || `Department review completed and ${recDecision.toLowerCase()} by HOD (${user?.name}).`,
        byUserId: user?.id,
        byUserName: user?.name,
      })
      flash(`HOD Recommendation (${recDecision}) forwarded to the Campus Director for final sanction!`)
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
        <div className="rounded-xl bg-blue-700 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🏢</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-blue-200">✕</button>
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
          <div className="text-2xl font-black text-emerald-600 mt-1">{recommendedRequests.length} Forwarded</div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
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
          <div className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            🏛️ Campus Director holds final approval authority
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            ✨ All department event proposals have been reviewed and forwarded.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition text-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">{req.name || req.title}</h4>
                      <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[10px]">
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
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3 py-1.5 shadow-xs transition"
                    >
                      Recommend to Director →
                    </button>
                    <button
                      onClick={() => openRecommendModal(req, 'CHANGES_REQUESTED')}
                      className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs px-3 py-1.5 border border-amber-200 transition"
                    >
                      Request Changes
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Department-Scoped Timetable & Batches Grid */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Department Academic Class Sections &amp; Faculty Timetables
            </h3>
            <p className="text-xs text-slate-500">
              Complete operational scope across all CSE batches, lab venues, and faculty teaching schedules.
            </p>
          </div>
          <Link to="/timetable" className="text-xs font-semibold text-brand-600 hover:underline">
            View Department Timetable →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-extrabold text-slate-900 block">Int. M.Sc Data Science, VII B</span>
            <p className="text-slate-500 text-[11px] mt-1">Home room: AB1-E103B · Advisor: Dr Devika</p>
            <span className="text-emerald-700 font-bold text-[10px] mt-2 block">● Department Timetable Active</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-extrabold text-slate-900 block">B.Tech CSE, VII A</span>
            <p className="text-slate-500 text-[11px] mt-1">Home room: AB1-E104 · Deep Learning &amp; Security</p>
            <span className="text-emerald-700 font-bold text-[10px] mt-2 block">● Department Timetable Active</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-extrabold text-slate-900 block">B.Tech CSE, V A &amp; V B</span>
            <p className="text-slate-500 text-[11px] mt-1">Core Data Structures, Algorithms &amp; Systems</p>
            <span className="text-emerald-700 font-bold text-[10px] mt-2 block">● Department Timetable Active</span>
          </div>
        </div>
      </section>

      {/* Recommendation Submission Modal */}
      {recModalOpen && activeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-blue-200">
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

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Department Endorsement Status:
                </label>
                <select
                  value={recDecision}
                  onChange={(e) => setRecDecision(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold"
                >
                  <option value="RECOMMENDED">RECOMMENDED (Forward to Campus Director for Sanction)</option>
                  <option value="CHANGES_REQUESTED">CHANGES_REQUESTED (Return to Requester for Modifications)</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW (Requires Internal Lab Consultation)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  HOD Review Notes:
                </label>
                <textarea
                  rows={3}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  placeholder="e.g. Strongly recommended by CSE Department Head. Venue and student schedule verified."
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
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-extrabold shadow-sm transition"
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
