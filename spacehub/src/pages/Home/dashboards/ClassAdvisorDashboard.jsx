import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listChangeRequests,
  reviewChangeRequest,
  proposeChangeRequest,
  resetDemoChangeRequests,
  listRooms,
  listLostItems,
} from '../../../lib/dataClient'

import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function ClassAdvisorDashboard({ user }) {
  const [changeRequests, setChangeRequests] = useState([])
  const [rooms, setRooms] = useState([])
  const [lostItems, setLostItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'history' | 'all'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [simulateModalOpen, setSimulateModalOpen] = useState(false)

  // Scoped advisee section: Int. M.Sc Data Science, VII B
  const assignedSection = 'Int. M.Sc Data Science, VII B'
  const homeRoom = 'AB1 E103B'

  async function loadData() {
    setLoading(true)
    try {
      const [reqs, rms, lItems] = await Promise.all([
        listChangeRequests().catch(() => []),
        listRooms().catch(() => []),
        listLostItems().catch(() => []),
      ])
      // Advisor only sees change requests for their assigned class section
      const myReqs = (reqs || []).filter(
        (r) => !r.classSection || r.classSection.includes('VII B') || r.classSection === assignedSection
      )
      setChangeRequests(myReqs)
      setRooms(rms || [])

      // Classroom lost items found in AB1 E103B (auto-routed to this advisor's desk)
      const classroomItems = (lItems || []).filter(
        (i) => i.location?.includes('E103') || i.currentCustody?.includes('Advisor') || i.routingReason?.includes('Classroom')
      )
      setLostItems(classroomItems.length > 0 ? classroomItems : (lItems || []).slice(0, 2))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  function flash(msg) {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(''), 5000)
  }

  async function handleAdvisorReview(reqId, decision) {
    setIsSubmitting(true)
    try {
      await reviewChangeRequest(reqId, {
        decision,
        reviewNotes: reviewNote || (decision === 'approved' ? 'Authorized by Class Advisor Dr Devika' : 'Declined by Advisor due to scheduling constraint'),
        approverName: user?.name || 'Dr Devika',
        approverId: user?.id || 'user-classadvisor-1',
      })
      setReviewNote('')
      flash(`Timetable proposal successfully marked as ${decision.toUpperCase()}! Official timetable updated.`)
      await loadData()
    } catch (e) {
      alert(`Error reviewing request: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReopenProposal(reqId) {
    setIsSubmitting(true)
    try {
      await reviewChangeRequest(reqId, {
        decision: 'pending',
        reviewNotes: 'Re-opened by Class Advisor for schedule re-evaluation.',
        approverName: user?.name || 'Dr Devika',
        approverId: user?.id || 'user-classadvisor-1',
      })
      flash(`Proposal re-opened! You can approve or reject again.`)
      await loadData()
    } catch (e) {
      alert(`Error re-opening proposal: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetDemoProposals() {
    if (confirm('Reset demo timetable proposals so you can review them again?')) {
      setIsSubmitting(true)
      try {
        if (typeof resetDemoChangeRequests === 'function') {
          await resetDemoChangeRequests()
        }
        flash('Demo timetable proposals reset! All options are available again.')
        await loadData()
      } catch (e) {
        alert(`Error resetting demo proposals: ${e.message}`)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  async function handleSimulateProposal(preset) {
    setIsSubmitting(true)
    try {
      await proposeChangeRequest(preset)
      flash(`New proposal '${preset.courseName}' simulated from Class Rep!`)
      setSimulateModalOpen(false)
      await loadData()
    } catch (e) {
      alert(`Simulation error: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const pendingRequests = changeRequests.filter((r) => r.status?.toLowerCase() === 'pending')
  const historyRequests = changeRequests.filter((r) => r.status?.toLowerCase() !== 'pending')

  const displayedRequests =
    activeTab === 'pending'
      ? pendingRequests
      : activeTab === 'history'
      ? historyRequests
      : changeRequests

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-indigo-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-indigo-200 text-base font-bold">✕</button>
        </div>
      )}

      {/* Official Amrita College Portal Hero & Action Tiles */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'adv-alt-1',
            title: `Action Required: ${pendingRequests.length} timetable reschedule proposal(s) awaiting approval for ${assignedSection}`,
            link: '#authorizations',
          },
        ]}
      />

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase">Pending Approvals</span>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-900">Urgent</span>
          </div>
          <div className="text-2xl font-black text-amber-950 mt-1">{pendingRequests.length} Proposals</div>
          <p className="text-[11px] text-amber-800 font-medium mt-1">From Class Rep Devika Nair</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Advisee Cohort</span>
          <div className="text-2xl font-black text-slate-900 mt-1">38 Advisees</div>
          <p className="text-[11px] text-slate-500 mt-1">Home Classroom: {homeRoom}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Weekly Academic Load</span>
          <div className="text-2xl font-black text-slate-900 mt-1">24 Periods</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Zero unresolvable clashes</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Classroom Custody Items</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{lostItems.length} in Custody</div>
          <p className="text-[11px] text-indigo-600 font-semibold mt-1">Found in {homeRoom}</p>
        </div>
      </section>

      {/* Pending Reschedule Authorization Table */}
      <section id="authorizations" className="rounded-2xl border border-amber-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Timetable Reschedule Authorization Inbox
            </h2>
            <p className="text-xs text-slate-500">
              Proposals submitted by Class Reps requiring official Advisor sign-off. Decisions can be modified or re-opened anytime.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSimulateModalOpen(true)}
              className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-3 py-1.5 transition flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>+ Propose Reschedule</span>
            </button>
            <button
              onClick={handleResetDemoProposals}
              className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 transition"
            >
              🔄 Reset Proposals
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Pending Decision</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {pendingRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Reviewed History</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {historyRequests.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>All Section Proposals</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {changeRequests.length}
            </span>
          </button>
        </div>

        {displayedRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <div>✨ No proposals currently in this view.</div>
            <button onClick={handleResetDemoProposals} className="text-amber-800 font-extrabold hover:underline">
              Click here to reload demo timetable change proposals
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedRequests.map((req) => {
              const isPending = req.status?.toLowerCase() === 'pending'
              const isApproved = req.status?.toLowerCase() === 'approved'

              return (
                <div
                  key={req.id}
                  className={`rounded-xl border p-4 space-y-3 transition ${
                    isPending
                      ? 'border-amber-300 bg-amber-50/40'
                      : isApproved
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {req.courseCode || '22CSC401'}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                          isPending ? 'bg-amber-100 text-amber-900' : isApproved ? 'bg-emerald-600 text-white' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm mt-1">{req.courseName}</h3>
                      <p className="text-xs text-slate-500">
                        Proposed by <span className="font-semibold text-slate-700">{req.requesterName}</span> ({req.classSection || assignedSection})
                      </p>
                    </div>
                    <div className="text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-red-600 line-through mr-2">
                        {req.originalDay} {req.originalSlot}
                      </span>
                      <span>➔</span>
                      <span className="text-emerald-700 font-bold ml-2">
                        {req.proposedDay} {req.proposedSlot} ({req.proposedRoomId})
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 bg-white/70 p-2.5 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-800">Reason:</span> {req.reason}
                  </div>

                  {req.reviewNotes && (
                    <div className="text-[11px] text-indigo-800 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                      <strong>Advisor Notes:</strong> {req.reviewNotes}
                    </div>
                  )}

                  {/* Actions with full re-usability */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-200/60">
                    {isPending ? (
                      <>
                        <input
                          type="text"
                          placeholder="Optional advisor note or conditions..."
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAdvisorReview(req.id, 'approved')}
                            disabled={isSubmitting}
                            className="rounded-lg bg-emerald-600 text-white px-4 py-1.5 text-xs font-bold hover:bg-emerald-700 transition-colors shadow-2xs"
                          >
                            ✓ Approve Proposal
                          </button>
                          <button
                            onClick={() => handleAdvisorReview(req.id, 'rejected')}
                            disabled={isSubmitting}
                            className="rounded-lg bg-red-100 text-red-700 px-3 py-1.5 text-xs font-bold hover:bg-red-200 transition-colors"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => handleReopenProposal(req.id)}
                          disabled={isSubmitting}
                          className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 text-xs font-bold transition flex items-center gap-1"
                          title="Re-open so you can approve or reject again"
                        >
                          <span>🔄</span>
                          <span>Re-open Proposal</span>
                        </button>
                        {isApproved ? (
                          <button
                            onClick={() => handleAdvisorReview(req.id, 'rejected')}
                            disabled={isSubmitting}
                            className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 text-xs font-bold transition"
                          >
                            Revoke / Reject
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdvisorReview(req.id, 'approved')}
                            disabled={isSubmitting}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition"
                          >
                            ✓ Re-Approve
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Classroom Custody Items (Auto-Routed to Advisor) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <h2 className="text-sm font-bold text-slate-900">
              Classroom Lost &amp; Found (Auto-Routed to Your Desk)
            </h2>
          </div>
          <Link to="/lost-found" className="text-xs font-semibold text-indigo-600 hover:underline">
            Full Custody Board →
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          Items discovered in {homeRoom} during class periods. After 7 days, uncollected items auto-route to Student Welfare.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 mt-2">
          {lostItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-xs flex justify-between items-start">
              <div>
                <h4 className="font-bold text-slate-900">{item.name || item.title || 'Casio Scientific Calculator'}</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Found in {homeRoom} · Desk Row 3</p>
                <p className="text-indigo-700 text-[11px] font-semibold mt-1">📍 Custody: Office of Dr Devika (AB1 204)</p>
              </div>
              <button
                onClick={() => flash('Item marked as verified and handed over to student!')}
                className="rounded bg-indigo-600 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-indigo-700 shadow-2xs"
              >
                Hand Back
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Simulate Modal */}
      {simulateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-amber-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Simulation Lab
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Simulate Timetable Reschedule Proposal
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
                  handleSimulateProposal({
                    courseCode: '22CSC403',
                    courseName: 'Reinforcement Learning',
                    classSection: assignedSection,
                    requesterName: 'Devika Nair (Class Rep)',
                    originalDay: 'Friday',
                    originalSlot: 'slot4',
                    originalRoomId: 'room-ab1-e103b',
                    proposedDay: 'Monday',
                    proposedSlot: 'slot2',
                    proposedRoomId: 'room-ab1-e103b',
                    proposedDate: '2026-10-19',
                    reason: 'Lab evaluation clashing with Slot 4 on Friday. Moving to Monday Slot 2.',
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">22CSC403 Reinforcement Learning</span>
                  <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded text-[10px]">Move Fri Slot 4 ➔ Mon Slot 2</span>
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
