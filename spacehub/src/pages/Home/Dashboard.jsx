import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ROLES,
  ROLE_LABELS,
  ROLE_BADGE_COLORS,
} from '../../lib/constants'
import {
  listRooms,
  listPublicEvents,
  listChangeRequests,
  listLostItems,
  listFacilities,
  listNotifications,
  getAvailability,
} from '../../lib/dataClient'

export default function Dashboard() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState([])
  const [events, setEvents] = useState([])
  const [changeRequests, setChangeRequests] = useState([])
  const [lostItems, setLostItems] = useState([])
  const [facilities, setFacilities] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [rms, evts, reqs, lItems, facs, notifs] = await Promise.all([
          listRooms(),
          listPublicEvents(),
          listChangeRequests(),
          listLostItems(),
          listFacilities(),
          listNotifications(user?.id),
        ])
        setRooms(rms || [])
        setEvents(evts || [])
        setChangeRequests(reqs || [])
        setLostItems(lItems || [])
        setFacilities(facs || [])
        setNotifications(notifs || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const role = user?.role || ROLES.STUDENT
  const badgeColor = ROLE_BADGE_COLORS[role] || 'bg-slate-100 text-slate-700'
  const pendingRequests = changeRequests.filter((r) => r.status === 'pending')
  const inCustodyItems = lostItems.filter((i) => i.status === 'in_custody' || i.status === 'claim_pending')
  const unreadNotifs = notifications.filter((n) => !n.isRead)

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badgeColor} bg-white/10 text-brand-100 border border-white/20`}>
                {ROLE_LABELS[role]} Portal
              </span>
              <span className="text-brand-300 text-xs">• {user?.department || 'Amrita Campus'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Welcome, {user?.name} 👋
            </h1>
            <p className="text-brand-200 text-xs md:text-sm mt-1 max-w-xl">
              CampusConnect Unified Command Center: Manage physical allocations, academic schedule requests, and student asset tracking.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              to="/classrooms"
              className="rounded-xl bg-white text-slate-900 px-4 py-2.5 text-xs font-bold hover:bg-brand-50 transition-colors shadow-sm text-center"
            >
              Classroom Board →
            </Link>
            <Link
              to="/lost-found"
              className="rounded-xl bg-brand-700/60 border border-white/20 text-white px-4 py-2.5 text-xs font-bold hover:bg-brand-700 transition-colors text-center"
            >
              Lost &amp; Found →
            </Link>
          </div>
        </div>
      </div>

      {/* Role-Specific Priority Action Row */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <span>⚡</span>
          <span>Role Action Summary: {ROLE_LABELS[role]}</span>
        </h2>

        {/* 1. STUDENT VIEW */}
        {role === ROLES.STUDENT && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🪑</span>
              <h3 className="font-bold text-slate-900 text-sm">Open Study Classrooms</h3>
              <p className="text-xs text-slate-500 mt-1">
                Browse real-time free lecture rooms for group study between timetable periods.
              </p>
              <Link to="/classrooms" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                View Availability →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🔎</span>
              <h3 className="font-bold text-slate-900 text-sm">Lost &amp; Found Custody</h3>
              <p className="text-xs text-slate-500 mt-1">
                {inCustodyItems.length} items logged in custody across campus blocks.
              </p>
              <Link to="/lost-found" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Browse Items or File Claim →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🧪</span>
              <h3 className="font-bold text-slate-900 text-sm">Prototyping Labs</h3>
              <p className="text-xs text-slate-500 mt-1">
                Reserve 3D printers, VR headsets, and electronics stations with safety induction.
              </p>
              <Link to="/facilities" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Explore Facilities →
              </Link>
            </div>
          </div>
        )}

        {/* 2. CLASS REPRESENTATIVE VIEW */}
        {role === ROLES.CLASS_REP && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 shadow-2xs">
              <span className="text-2xl block mb-2">📝</span>
              <h3 className="font-bold text-brand-900 text-sm">Propose Timetable Reschedule</h3>
              <p className="text-xs text-brand-700 mt-1">
                Move academic lectures with automatic conflict prevention and advisor routing.
              </p>
              <Link to="/academic-scheduling" className="text-xs font-bold text-brand-700 mt-3 inline-block hover:underline">
                Propose Reschedule →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🏫</span>
              <h3 className="font-bold text-slate-900 text-sm">Book Free Classrooms</h3>
              <p className="text-xs text-slate-500 mt-1">
                Class Reps have instant booking rights for academic revision and project meetings.
              </p>
              <Link to="/classrooms" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Book Room Slot →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">📋</span>
              <h3 className="font-bold text-slate-900 text-sm">Pending Class Requests</h3>
              <p className="text-xs text-slate-500 mt-1">
                {pendingRequests.length} proposal(s) currently awaiting faculty/advisor review.
              </p>
              <Link to="/academic-scheduling" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Track Proposals →
              </Link>
            </div>
          </div>
        )}

        {/* 3. CLASS ADVISOR VIEW */}
        {role === ROLES.CLASS_ADVISOR && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">⚡</span>
                <span className="rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5">
                  Action Required
                </span>
              </div>
              <h3 className="font-bold text-amber-950 text-sm">Pending Timetable Approvals</h3>
              <p className="text-xs text-amber-800 mt-1">
                {pendingRequests.length} reschedule proposal(s) pending your official advisor authorization.
              </p>
              <Link to="/academic-scheduling" className="text-xs font-bold text-amber-900 mt-3 inline-block hover:underline">
                Review &amp; Approve →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">📦</span>
              <h3 className="font-bold text-slate-900 text-sm">Auto-Routed Classroom Items</h3>
              <p className="text-xs text-slate-500 mt-1">
                Items found in your classroom during timetable slots are assigned directly to your desk.
              </p>
              <Link to="/lost-found" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Check Custody Queue →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">📅</span>
              <h3 className="font-bold text-slate-900 text-sm">Section Timetable</h3>
              <p className="text-xs text-slate-500 mt-1">
                Overview of weekly schedule for Int. M.Sc Data Science, VII B.
              </p>
              <Link to="/academic-scheduling" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Open Full Grid →
              </Link>
            </div>
          </div>
        )}

        {/* 4. FACULTY VIEW */}
        {role === ROLES.FACULTY && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">📚</span>
              <h3 className="font-bold text-slate-900 text-sm">Teaching Schedule</h3>
              <p className="text-xs text-slate-500 mt-1">
                Course: Deep Learning (22CSC401) in AB1 E-104 on Monday, Wednesday, Friday.
              </p>
              <Link to="/academic-scheduling" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                View Timetable →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🎤</span>
              <h3 className="font-bold text-slate-900 text-sm">Event Venue Requests</h3>
              <p className="text-xs text-slate-500 mt-1">
                Request Main Auditorium or Seminar Halls with automated priority scoring.
              </p>
              <Link to="/events" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Request Venue →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🖥️</span>
              <h3 className="font-bold text-slate-900 text-sm">Student HPC Jobs</h3>
              <p className="text-xs text-slate-500 mt-1">
                Review large compute requests (&gt;20 node-hours) submitted by research scholars.
              </p>
              <Link to="/facilities/hpc" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                HPC Allocations →
              </Link>
            </div>
          </div>
        )}

        {/* 5. LAB ASSISTANT & LAB ADMIN VIEW */}
        {(role === ROLES.LAB_ASSISTANT || role === ROLES.LAB_ADMIN) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🔧</span>
              <h3 className="font-bold text-slate-900 text-sm">Equipment Maintenance</h3>
              <p className="text-xs text-slate-500 mt-1">
                Toggle maintenance status and record downtime on 3D printers, VR kits, and Electronics.
              </p>
              <Link to="/facilities" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Manage Equipment →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🎓</span>
              <h3 className="font-bold text-slate-900 text-sm">Safety Inductions</h3>
              <p className="text-xs text-slate-500 mt-1">
                Grant equipment clearance to students completing safety orientations.
              </p>
              <Link to="/facilities" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Induction Roster →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">📊</span>
              <h3 className="font-bold text-slate-900 text-sm">Lab Usage &amp; Jobs</h3>
              <p className="text-xs text-slate-500 mt-1">
                Monitor machine utilization and HPC node-hour quota consumption.
              </p>
              <Link to="/admin" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Utilization Stats →
              </Link>
            </div>
          </div>
        )}

        {/* 6. CENTRAL RESOURCE ADMIN & SYS ADMIN VIEW */}
        {(role === ROLES.RESOURCE_ADMIN || role === ROLES.SYS_ADMIN || role === ROLES.ADMIN) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🎤</span>
              <h3 className="font-bold text-purple-900 text-sm">Event Venue Approvals</h3>
              <p className="text-xs text-purple-700 mt-1">
                Group competing requests by venue &amp; date, evaluate priority scores, and resolve clashes.
              </p>
              <Link to="/events/approvals" className="text-xs font-bold text-purple-800 mt-3 inline-block hover:underline">
                Approval Queue →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">📈</span>
              <h3 className="font-bold text-slate-900 text-sm">Campus Utilization Stats</h3>
              <p className="text-xs text-slate-500 mt-1">
                Calculated classroom allocation percentages, peak slots, and facility usage distributions.
              </p>
              <Link to="/admin" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Admin Dashboard →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🛡️</span>
              <h3 className="font-bold text-slate-900 text-sm">Audit Trail &amp; ERP Sync</h3>
              <p className="text-xs text-slate-500 mt-1">
                Immutable security logs and University E-Governance (AUMS) integration adapter.
              </p>
              <Link to="/governance" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Audit &amp; Governance →
              </Link>
            </div>
          </div>
        )}

        {/* 7. STUDENT WELFARE / LOST-PROPERTY HANDLER VIEW */}
        {role === ROLES.LOST_PROPERTY_HANDLER && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🎒</span>
              <h3 className="font-bold text-teal-950 text-sm">Incoming Campus Reports</h3>
              <p className="text-xs text-teal-800 mt-1">
                Outdoor campus items automatically routed to Student Welfare custody.
              </p>
              <Link to="/lost-found" className="text-xs font-bold text-teal-900 mt-3 inline-block hover:underline">
                Review Incoming Items →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">⚖️</span>
              <h3 className="font-bold text-slate-900 text-sm">Pending Ownership Claims</h3>
              <p className="text-xs text-slate-500 mt-1">
                Verify student proofs, request serial numbers, and approve valid claims.
              </p>
              <Link to="/lost-found" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Verify Claims →
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xl block mb-2">🤝</span>
              <h3 className="font-bold text-slate-900 text-sm">Record Handover &amp; Return</h3>
              <p className="text-xs text-slate-500 mt-1">
                Maintain audit history of returns with student ID checks and timestamped logs.
              </p>
              <Link to="/lost-found" className="text-xs font-bold text-brand-600 mt-3 inline-block hover:underline">
                Handover Desk →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Campus Public Event Feed */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎤</span>
            <h2 className="text-sm font-bold text-slate-800">
              Happening on Campus — Approved Events
            </h2>
          </div>
          <Link to="/events" className="text-xs font-semibold text-brand-600 hover:underline">
            All Events →
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No approved events scheduled right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs flex justify-between items-start"
              >
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{evt.title || evt.name}</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {evt.organizer} · Venue: {evt.venueId || 'Main Auditorium'}
                  </p>
                  <p className="text-brand-700 font-semibold text-[11px] mt-1">
                    📅 {evt.date || evt.eventDate} ({evt.start || evt.startSlot} – {evt.end || evt.endSlot})
                  </p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Approved
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
