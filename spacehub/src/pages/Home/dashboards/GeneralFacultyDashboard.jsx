import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listChangeRequests,
  listRooms,
} from '../../../lib/dataClient'

import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function GeneralFacultyDashboard({ user }) {
  const [changeRequests, setChangeRequests] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const [reqs, rms] = await Promise.all([
        listChangeRequests().catch(() => []),
        listRooms().catch(() => []),
      ])
      // Filter requests relevant to faculty's courses (e.g. Deep Learning)
      const myReqs = (reqs || []).filter(
        (r) => r.courseName?.includes('Deep Learning') || r.courseCode === '22CSC401'
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

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-blue-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>📚</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-blue-200">✕</button>
        </div>
      )}

      {/* Official Amrita College Portal Hero & Action Tiles */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'fac-alt-1',
            title: 'Teaching Notice: Slot 4 (10:45) Deep Learning in AB1 E103B is ready with audio/projector checks',
            link: '/academic-scheduling',
          },
        ]}
      />

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs">
          <span className="text-xs font-bold text-blue-800 uppercase">Teaching Slots Today</span>
          <div className="text-2xl font-black text-blue-950 mt-1">2 Periods</div>
          <p className="text-[11px] text-blue-700 mt-1">Deep Learning (AB1 E103B &amp; E104)</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Assigned Classes</span>
          <div className="text-2xl font-black text-slate-900 mt-1">2 Sections</div>
          <p className="text-[11px] text-slate-500 mt-1">Int. M.Sc VII B &amp; Section A</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Weekly Booking Cap</span>
          <div className="text-2xl font-black text-slate-900 mt-1">4.0 / 12.0 hrs</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Within department limit</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Course Reschedule Requests</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{changeRequests.length} Requests</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting advisor sign-off</p>
        </div>
      </section>

      {/* Today's Teaching Agenda */}
      <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Today's Lecture Agenda: {user?.name}
            </h2>
            <p className="text-xs text-slate-500">
              Scheduled periods, assigned classrooms, and student cohort details.
            </p>
          </div>
          <Link to="/academic-scheduling" className="text-xs font-semibold text-blue-600 hover:underline">
            View Full Matrix →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/30 p-4 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                Slot 4 (10:45 – 11:35)
              </span>
              <span className="text-slate-500 font-semibold">AB1 E103B</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Deep Learning (22CSC401)</h4>
            <p className="text-slate-600 text-[11px]">Int. M.Sc Data Science, VII B (38 Students)</p>
            <div className="pt-2 border-t border-blue-100 flex justify-between items-center text-[11px]">
              <span className="text-emerald-700 font-semibold">Projector &amp; Audio: Checked</span>
              <span className="text-blue-700 font-bold">Class Rep: Ananya Sharma</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                Slot 6 (12:25 – 13:15)
              </span>
              <span className="text-slate-500 font-semibold">AB1 E104</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Deep Learning Tutorial (22CSC401)</h4>
            <p className="text-slate-600 text-[11px]">Section A Tutorial &amp; Code Review</p>
            <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Lab Assistant: Suresh Kumar</span>
              <span className="text-slate-700 font-semibold">Walk-in Tutorial</span>
            </div>
          </div>
        </div>
      </section>

      {/* Relevant Class Rep Reschedule Requests */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h3 className="text-sm font-bold text-slate-900">
              Student Reschedule Requests for Your Courses
            </h3>
          </div>
          <span className="text-xs text-slate-400">Course: Deep Learning</span>
        </div>

        <div className="space-y-3">
          {changeRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-slate-200 p-3.5 bg-slate-50 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900">{req.courseName}</h4>
                  <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                    Status: {req.status?.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Shift: <strong className="text-red-700">{req.originalDay} {req.originalSlot}</strong> ➔ <strong className="text-emerald-700">{req.proposedDay} {req.proposedSlot}</strong> ({req.proposedRoomId})
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5 italic">"{req.reason}"</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Requester: {req.requesterName}</span>
                <span className="text-[10px] text-indigo-700 font-bold block mt-0.5">Reviewer: Dr Devika P</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
