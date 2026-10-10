import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listChangeRequests,
  proposeChangeRequest,
  listRooms,
} from '../../../lib/dataClient'

export default function ClassRepDashboard({ user }) {
  const [changeRequests, setChangeRequests] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  // Propose modal state
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    courseName: 'Deep Learning (22CSC401)',
    courseCode: '22CSC401',
    originalDay: 'Monday',
    originalSlot: 'slot4',
    proposedDay: 'Tuesday',
    proposedSlot: 'slot6',
    proposedRoomId: 'room-ab1-e103b',
    reason: 'Guest lecture scheduling adjustment approved by faculty',
  })

  const assignedSection = 'Int. M.Sc Data Science, VII B'
  const homeRoom = 'AB1 E103B'
  const advisorName = 'Dr Devika P'

  async function loadData() {
    setLoading(true)
    try {
      const [reqs, rms] = await Promise.all([
        listChangeRequests().catch(() => []),
        listRooms().catch(() => []),
      ])
      const myReqs = (reqs || []).filter(
        (r) => !r.classSection || r.classSection.includes('VII B') || r.classSection === assignedSection
      )
      setChangeRequests(myReqs)
      setRooms(rms || [])
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
    setTimeout(() => setFlashMsg(''), 4500)
  }

  async function handleProposeSubmit(e) {
    e.preventDefault()
    try {
      await proposeChangeRequest({
        ...form,
        requesterName: user?.name,
        requesterId: user?.id,
        requesterRole: user?.role,
        classSection: assignedSection,
      })
      setShowModal(false)
      flash(`Timetable change proposal submitted to Class Advisor ${advisorName}!`)
      loadData()
    } catch (e) {
      alert(`Error proposing change: ${e.message}`)
    }
  }

  const freeClassrooms = rooms.filter((r) => r.type === 'classroom' && r.id !== 'room-ab1-e103b')

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-cyan-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>📝</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-cyan-200">✕</button>
        </div>
      )}

      {/* Class Rep Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-cyan-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                🗂️ Class Representative Console
              </span>
              <span className="text-cyan-300 text-xs">• Assigned Cohort: {assignedSection}</span>
              <span className="text-emerald-400 text-xs bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                Student Rep Scope Active
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Welcome, {user?.name}
            </h1>
            <p className="text-cyan-200/80 text-xs md:text-sm mt-1 max-w-xl">
              Coordinate your section's academic schedule, book unoccupied rooms for revision sessions, submit reschedule proposals to Class Advisor {advisorName}, and organize class events.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="rounded-xl bg-cyan-400 text-slate-950 px-3.5 py-2 text-xs font-black hover:bg-cyan-300 shadow-sm"
            >
              ⚡ Propose Reschedule
            </button>
            <Link
              to="/classrooms"
              className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20"
            >
              🏫 Book Revision Slot
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4 shadow-2xs">
          <span className="text-xs font-bold text-cyan-800 uppercase">Reschedule Proposals</span>
          <div className="text-2xl font-black text-cyan-950 mt-1">{changeRequests.length} Submitted</div>
          <p className="text-[11px] text-cyan-700 mt-1">Review by {advisorName}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Weekly Booking Cap</span>
          <div className="text-2xl font-black text-slate-900 mt-1">2.0 / 6.0 hrs</div>
          <p className="text-[11px] text-slate-500 mt-1">4.0 hrs remaining this week</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Home Classroom</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{homeRoom}</div>
          <p className="text-[11px] text-slate-500 mt-1">Academic Block 1 · Floor 1</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Class Advisor</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{advisorName}</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Direct approval channel</p>
        </div>
      </section>

      {/* Active Proposals Tracker */}
      <section className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              My Section Reschedule Proposals
            </h2>
            <p className="text-xs text-slate-500">
              Track requests submitted to Class Advisor {advisorName} for {assignedSection}.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-cyan-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-cyan-700 shadow-2xs flex items-center gap-1.5"
          >
            <span>➕</span>
            <span>New Reschedule</span>
          </button>
        </div>

        <div className="space-y-3">
          {changeRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{req.courseName}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    req.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : req.status === 'rejected'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}>
                    {req.status?.toUpperCase()}
                  </span>
                </div>
                <div className="text-slate-500 mt-1 flex items-center gap-2">
                  <span>Shift: <strong className="text-slate-700">{req.originalDay} {req.originalSlot}</strong> ➔ <strong className="text-brand-700">{req.proposedDay} {req.proposedSlot}</strong></span>
                  <span>• Room: {req.proposedRoomId}</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-1 bg-white p-1.5 rounded border border-slate-200/60 inline-block">
                  💬 "{req.reason}"
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-slate-400 text-[11px] block">
                  Status: {req.status === 'pending' ? 'Awaiting Advisor Review' : req.status}
                </span>
                <span className="text-xs font-bold text-slate-700 block mt-1">
                  Advisor: {advisorName}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Today's Section Timetable */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <h3 className="text-sm font-bold text-slate-900">
              Today's Schedule: {assignedSection}
            </h3>
          </div>
          <Link to="/academic-scheduling" className="text-xs font-semibold text-cyan-600 hover:underline">
            Full 5-Day Matrix →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <span className="text-[10px] font-bold text-slate-400 block">Slot 4 · 10:45 – 11:35</span>
            <h4 className="font-bold text-slate-900 mt-1">Deep Learning</h4>
            <p className="text-slate-500 text-[11px]">Dr Thilaga M · {homeRoom}</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <span className="text-[10px] font-bold text-slate-400 block">Slot 5 · 11:35 – 12:25</span>
            <h4 className="font-bold text-slate-900 mt-1">Business Analytics</h4>
            <p className="text-slate-500 text-[11px]">Dr Subhraaj R · {homeRoom}</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <span className="text-[10px] font-bold text-slate-400 block">Slot 6 · 12:25 – 13:15</span>
            <h4 className="font-bold text-slate-900 mt-1">Data Security</h4>
            <p className="text-slate-500 text-[11px]">Dr Boovamithar · {homeRoom}</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <span className="text-[10px] font-bold text-slate-400 block">Slot 8 · 14:05 – 14:55</span>
            <h4 className="font-bold text-slate-900 mt-1">Soft Computing</h4>
            <p className="text-slate-500 text-[11px]">Dr Gnanapriyadarshini · {homeRoom}</p>
          </div>
        </div>
      </section>

      {/* Propose Reschedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Propose Timetable Reschedule (Class Rep)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleProposeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Course</label>
                <select
                  value={form.courseName}
                  onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="Deep Learning (22CSC401)">Deep Learning (22CSC401) · Dr Thilaga M</option>
                  <option value="Data Security (22CSC404)">Data Security (22CSC404) · Dr Boovamithar</option>
                  <option value="Probabilistic Models (22MAT401)">Probabilistic Models (22MAT401) · Dr Kalaivani</option>
                  <option value="Reinforcement Learning (22CSC403)">Reinforcement Learning (22CSC403) · Dr Jeyaramakrishnan</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Original Day &amp; Slot</label>
                  <input
                    type="text"
                    value={`${form.originalDay} ${form.originalSlot}`}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Proposed Slot</label>
                  <select
                    value={form.proposedSlot}
                    onChange={(e) => setForm({ ...form, proposedSlot: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="slot6">Slot 6 (12:25 – 13:15)</option>
                    <option value="slot8">Slot 8 (14:05 – 14:55)</option>
                    <option value="slot9">Slot 9 (14:55 – 15:45)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Proposed Day</label>
                <select
                  value={form.proposedDay}
                  onChange={(e) => setForm({ ...form, proposedDay: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Reschedule</label>
                <textarea
                  rows={2}
                  required
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Explain reason for shift..."
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-bold hover:bg-cyan-700 shadow-2xs"
                >
                  Submit Proposal to Advisor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
