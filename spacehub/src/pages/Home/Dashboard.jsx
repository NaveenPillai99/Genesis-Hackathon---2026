import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ROLES,
  ROLE_LABELS,
  ROLE_BADGE_COLORS,
  DAY_SLOTS,
} from '../../lib/constants'
import {
  listRooms,
  listPublicEvents,
  listEvents,
  listChangeRequests,
  reviewChangeRequest,
  proposeChangeRequest,
  listLostItems,
  recordHandover,
  listFacilities,
  setFacilityMaintenance,
  listInductions,
  completeInduction,
  listNotifications,
  getUtilizationStats,
  decideEvent,
  simulateEGovernanceSync,
} from '../../lib/dataClient'

export default function Dashboard() {
  const { user, login } = useAuth()
  const [rooms, setRooms] = useState([])
  const [events, setEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [changeRequests, setChangeRequests] = useState([])
  const [lostItems, setLostItems] = useState([])
  const [facilities, setFacilities] = useState([])
  const [inductions, setInductions] = useState([])
  const [notifications, setNotifications] = useState([])
  const [utilizationStats, setUtilizationStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionSuccess, setActionSuccess] = useState('')

  // State for modals/forms
  const [showProposeModal, setShowProposeModal] = useState(false)
  const [proposeForm, setProposeForm] = useState({
    courseName: 'Deep Learning (22CSC401)',
    courseCode: '22CSC401',
    originalDay: 'Monday',
    originalSlot: 'slot4',
    proposedDay: 'Tuesday',
    proposedSlot: 'slot6',
    proposedRoomId: 'room-ab1-e103b',
    reason: 'Guest lecture scheduling adjustment approved by faculty',
  })
  const [reviewNote, setReviewNote] = useState('')
  const [syncStatus, setSyncStatus] = useState(null)

  const role = user?.role || ROLES.STUDENT
  const badgeColor = ROLE_BADGE_COLORS[role] || 'bg-slate-100 text-slate-700'

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [rms, pubEvts, allEvts, reqs, lItems, facs, indList, notifs, stats] =
          await Promise.all([
            listRooms().catch(() => []),
            listPublicEvents().catch(() => []),
            listEvents().catch(() => []),
            listChangeRequests().catch(() => []),
            listLostItems().catch(() => []),
            listFacilities().catch(() => []),
            listInductions().catch(() => []),
            listNotifications(user?.id).catch(() => []),
            getUtilizationStats().catch(() => null),
          ])
        setRooms(rms || [])
        setEvents(pubEvts || [])
        setAllEvents(allEvts || [])
        setChangeRequests(reqs || [])
        setLostItems(lItems || [])
        setFacilities(facs || [])
        setInductions(indList || [])
        setNotifications(notifs || [])
        setUtilizationStats(stats)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

  function flashMessage(msg) {
    setActionSuccess(msg)
    setTimeout(() => setActionSuccess(''), 4500)
  }

  // Advisor action: Review timetable proposal
  async function handleAdvisorReview(reqId, decision) {
    try {
      await reviewChangeRequest(reqId, {
        decision,
        reviewNotes: reviewNote || (decision === 'approved' ? 'Authorized by Class Advisor' : 'Declined due to timetable conflict'),
        approverName: user?.name,
        approverId: user?.id,
      })
      const updated = await listChangeRequests()
      setChangeRequests(updated)
      setReviewNote('')
      flashMessage(`Timetable request marked as ${decision.toUpperCase()}! Notification dispatched.`)
    } catch (e) {
      alert('Error updating request: ' + e.message)
    }
  }

  // Class Rep action: Propose timetable change
  async function handleProposeSubmit(e) {
    e.preventDefault()
    try {
      await proposeChangeRequest({
        ...proposeForm,
        requesterName: user?.name,
        requesterId: user?.id,
        requesterRole: user?.role,
        classSection: 'Int. M.Sc Data Science, VII B',
      })
      const updated = await listChangeRequests()
      setChangeRequests(updated)
      setShowProposeModal(false)
      flashMessage('Timetable change proposal submitted to Class Advisor Dr Devika!')
    } catch (e) {
      alert('Error proposing change: ' + e.message)
    }
  }

  // Lab Assistant action: Toggle maintenance
  async function handleToggleMaintenance(facilityId, currentUnderMaintenance) {
    try {
      await setFacilityMaintenance(facilityId, !currentUnderMaintenance)
      const updated = await listFacilities()
      setFacilities(updated)
      flashMessage(`Facility maintenance toggled to ${!currentUnderMaintenance ? 'UNDER MAINTENANCE' : 'AVAILABLE'}!`)
    } catch (e) {
      alert('Error toggling maintenance: ' + e.message)
    }
  }

  // Lab Assistant action: Authorize safety induction
  async function handleAuthorizeInduction(studentId, facilityId) {
    try {
      await completeInduction({
        userId: studentId,
        facilityId,
        byUserId: user?.id,
      })
      const updated = await listInductions()
      setInductions(updated)
      flashMessage('Safety induction certified! Student granted equipment clearance.')
    } catch (e) {
      alert('Error authorizing induction: ' + e.message)
    }
  }

  // Resource Admin action: Decide event request
  async function handleDecideEvent(eventId, decision) {
    try {
      await decideEvent(eventId, {
        decision,
        reason: decision === 'approved' ? 'Approved based on high academic priority score' : 'Declined due to auditorium conflict',
        byUserId: user?.id,
      })
      const [pub, all] = await Promise.all([listPublicEvents(), listEvents()])
      setEvents(pub)
      setAllEvents(all)
      flashMessage(`Event request marked as ${decision.toUpperCase()}!`)
    } catch (e) {
      alert('Error deciding event: ' + e.message)
    }
  }

  // Student Welfare action: Handover item
  async function handleHandoverItem(itemId) {
    try {
      await recordHandover(itemId, {
        newCustody: 'returned',
        handoverNotes: `Physical custody verified with College ID check by ${user?.name}.`,
      })
      const updated = await listLostItems()
      setLostItems(updated)
      flashMessage('Item status recorded as RETURNED to verified owner with audit entry.')
    } catch (e) {
      alert('Error recording handover: ' + e.message)
    }
  }

  // Sys Admin action: Test ERP sync
  async function handleTestErpSync() {
    setSyncStatus('syncing')
    try {
      const res = await simulateEGovernanceSync()
      setSyncStatus(res)
      flashMessage('E-Governance (AUMS) sync successful! 42 records updated.')
    } catch (e) {
      setSyncStatus({ status: 'FAILED', message: e.message })
    }
  }

  // Filtering calculations
  const pendingChangeRequests = changeRequests.filter((r) => r.status === 'pending')
  const inCustodyItems = lostItems.filter((i) => i.status === 'in_custody' || i.status === 'reported')
  const pendingClaims = lostItems.filter((i) => i.status === 'claim_pending')
  const returnedItems = lostItems.filter((i) => i.status === 'returned')
  const pendingEventRequests = allEvents.filter((e) => e.status === 'pending')

  // Free classrooms right now (sample calculation)
  const freeRoomsCount = rooms.filter((r) => r.type === 'classroom' && r.id !== 'room-ab1-e103b').length

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {actionSuccess && (
        <div className="rounded-xl bg-emerald-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-white hover:text-emerald-200 text-base">✕</button>
        </div>
      )}

      {/* 1. ROLE-SPECIFIC WELCOME BANNER */}
      <div className="rounded-3xl bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badgeColor} bg-white/10 text-brand-100 border border-white/20`}>
                {ROLE_LABELS[role]} Command Center
              </span>
              <span className="text-brand-300 text-xs">• {user?.department || 'Amrita Campus'}</span>
              <span className="text-emerald-300 text-xs bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                RBAC Active
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Welcome, {user?.name} 👋
            </h1>
            <p className="text-brand-200 text-xs md:text-sm mt-1 max-w-xl">
              {role === ROLES.STUDENT && 'Your personalized academic cockpit: Check available study classrooms, lecture timings, and your lost item reports.'}
              {role === ROLES.CLASS_REP && 'Class Representative Console: Coordinate timetable rescheduling, book classrooms for revision, and track section requests.'}
              {role === ROLES.CLASS_ADVISOR && 'Advisor Authorization Portal: Review and approve timetable shift requests for your section and manage classroom custody items.'}
              {role === ROLES.FACULTY && 'Faculty Academic & Research Desk: View your lecture timetable, submit seminar hall requests, and track compute resources.'}
              {(role === ROLES.LAB_ASSISTANT || role === ROLES.LAB_ADMIN) && 'Lab Operations & Safety Hub: Manage equipment maintenance status, certify safety inductions, and monitor bookings.'}
              {(role === ROLES.RESOURCE_ADMIN || role === ROLES.SYS_ADMIN) && 'Central Resource & Governance Desk: Review competing venue requests with priority scores, inspect audit trails, and oversee ERP sync.'}
              {role === ROLES.LOST_PROPERTY_HANDLER && 'Student Welfare Custody Center: Receive lost items, verify ownership proofs, and execute secure handovers.'}
            </p>
          </div>

          {/* Quick Actions matching the role */}
          <div className="flex flex-wrap gap-2">
            {role === ROLES.STUDENT && (
              <>
                <Link to="/classrooms" className="rounded-xl bg-white text-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-brand-50 shadow-sm">
                  🪑 Free Rooms Radar
                </Link>
                <Link to="/lost-found" className="rounded-xl bg-brand-700/70 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-brand-600">
                  🔎 Report Lost Item
                </Link>
              </>
            )}

            {role === ROLES.CLASS_REP && (
              <>
                <button
                  onClick={() => setShowProposeModal(true)}
                  className="rounded-xl bg-brand-400 text-slate-950 px-3.5 py-2 text-xs font-black hover:bg-brand-300 shadow-sm"
                >
                  ⚡ Propose Reschedule
                </button>
                <Link to="/classrooms" className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20">
                  🏫 Book Revision Slot
                </Link>
              </>
            )}

            {role === ROLES.CLASS_ADVISOR && (
              <>
                <Link to="/academic-scheduling" className="rounded-xl bg-amber-400 text-slate-950 px-3.5 py-2 text-xs font-black hover:bg-amber-300 shadow-sm">
                  ⚡ Approvals Desk ({pendingChangeRequests.length})
                </Link>
                <Link to="/lost-found" className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20">
                  📦 Classroom Custody
                </Link>
              </>
            )}

            {role === ROLES.FACULTY && (
              <>
                <Link to="/events" className="rounded-xl bg-white text-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-brand-50 shadow-sm">
                  🎤 Request Event Hall
                </Link>
                <Link to="/academic-scheduling" className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20">
                  📅 Teaching Schedule
                </Link>
              </>
            )}

            {(role === ROLES.LAB_ASSISTANT || role === ROLES.LAB_ADMIN) && (
              <>
                <Link to="/facilities" className="rounded-xl bg-white text-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-brand-50 shadow-sm">
                  🔧 Equipment Desk
                </Link>
                <Link to="/facilities" className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20">
                  🎓 Inductions
                </Link>
              </>
            )}

            {(role === ROLES.RESOURCE_ADMIN || role === ROLES.SYS_ADMIN) && (
              <>
                <Link to="/events/approvals" className="rounded-xl bg-purple-400 text-slate-950 px-3.5 py-2 text-xs font-black hover:bg-purple-300 shadow-sm">
                  ⚖️ Venue Approvals ({pendingEventRequests.length})
                </Link>
                <Link to="/governance" className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20">
                  🛡️ Audit &amp; ERP
                </Link>
              </>
            )}

            {role === ROLES.LOST_PROPERTY_HANDLER && (
              <>
                <Link to="/lost-found" className="rounded-xl bg-teal-400 text-slate-950 px-3.5 py-2 text-xs font-black hover:bg-teal-300 shadow-sm">
                  🎒 Custody Desk ({inCustodyItems.length})
                </Link>
                <Link to="/lost-found" className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20">
                  ⚖️ Verify Claims ({pendingClaims.length})
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. ROLE-TAILORED KPI STAT TILES */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* STUDENT STATS */}
        {role === ROLES.STUDENT && (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Free Classrooms Now</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{freeRoomsCount} Rooms</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Available for self-study in AB1 / AB2</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Today's Lectures</span>
              <div className="text-2xl font-black text-slate-900 mt-1">4 Periods</div>
              <p className="text-[11px] text-slate-500 mt-1">Next: Slot 4 (10:45) Deep Learning</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">My Lost &amp; Found</span>
              <div className="text-2xl font-black text-slate-900 mt-1">1 Item</div>
              <p className="text-[11px] text-brand-600 font-semibold mt-1">Blue Water Bottle in Custody</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Lab Safety Clearance</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">Certified</div>
              <p className="text-[11px] text-slate-500 mt-1">3D Printing Lab &amp; VR Kits</p>
            </div>
          </>
        )}

        {/* CLASS REP STATS */}
        {role === ROLES.CLASS_REP && (
          <>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4 shadow-2xs">
              <span className="text-xs font-bold text-cyan-800 uppercase">Reschedule Proposals</span>
              <div className="text-2xl font-black text-cyan-950 mt-1">{pendingChangeRequests.length} Pending</div>
              <p className="text-[11px] text-cyan-700 mt-1">Awaiting advisor authorization</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Weekly Booking Quota</span>
              <div className="text-2xl font-black text-slate-900 mt-1">2.0 / 6.0 hrs</div>
              <p className="text-[11px] text-slate-500 mt-1">4.0 hrs remaining this week</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Section Timetable</span>
              <div className="text-2xl font-black text-slate-900 mt-1">Int. M.Sc VII B</div>
              <p className="text-[11px] text-slate-500 mt-1">Home Room: AB1 E103B</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Cohort Enrolled</span>
              <div className="text-2xl font-black text-slate-900 mt-1">38 Students</div>
              <p className="text-[11px] text-slate-500 mt-1">Class Advisor: Dr Devika</p>
            </div>
          </>
        )}

        {/* CLASS ADVISOR STATS */}
        {role === ROLES.CLASS_ADVISOR && (
          <>
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase">Action Required</span>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-900">Urgent</span>
              </div>
              <div className="text-2xl font-black text-amber-950 mt-1">{pendingChangeRequests.length} Approvals</div>
              <p className="text-[11px] text-amber-800 font-medium mt-1">Timetable reschedule requests</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Classroom Lost Items</span>
              <div className="text-2xl font-black text-slate-900 mt-1">1 in Custody</div>
              <p className="text-[11px] text-slate-500 mt-1">Scientific Calculator in AB1 E103B</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Advisee Section</span>
              <div className="text-2xl font-black text-slate-900 mt-1">VII B Data Sci</div>
              <p className="text-[11px] text-slate-500 mt-1">38 enrolled advisees</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Section Weekly Load</span>
              <div className="text-2xl font-black text-slate-900 mt-1">24 Periods</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Zero unresolvable clashes</p>
            </div>
          </>
        )}

        {/* FACULTY STATS */}
        {role === ROLES.FACULTY && (
          <>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs">
              <span className="text-xs font-bold text-blue-800 uppercase">Teaching Slots Today</span>
              <div className="text-2xl font-black text-blue-950 mt-1">2 Lectures</div>
              <p className="text-[11px] text-blue-700 mt-1">Deep Learning (AB1 E104)</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Event Venue Bookings</span>
              <div className="text-2xl font-black text-slate-900 mt-1">1 Active</div>
              <p className="text-[11px] text-slate-500 mt-1">Seminar Hall, AB1 (Approved)</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">HPC Research Quota</span>
              <div className="text-2xl font-black text-slate-900 mt-1">85 / 100 hrs</div>
              <p className="text-[11px] text-slate-500 mt-1">15 node-hrs consumed</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Weekly Booking Cap</span>
              <div className="text-2xl font-black text-slate-900 mt-1">4.0 / 12.0 hrs</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Within department limit</p>
            </div>
          </>
        )}

        {/* LAB ASSISTANT & LAB ADMIN STATS */}
        {(role === ROLES.LAB_ASSISTANT || role === ROLES.LAB_ADMIN) && (
          <>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
              <span className="text-xs font-bold text-amber-800 uppercase">Fleet Operational</span>
              <div className="text-2xl font-black text-amber-950 mt-1">
                {facilities.filter((f) => !f.underMaintenance).length} / {facilities.length} Active
              </div>
              <p className="text-[11px] text-amber-700 mt-1">Available for student bookings</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Under Maintenance</span>
              <div className="text-2xl font-black text-red-600 mt-1">
                {facilities.filter((f) => f.underMaintenance).length} Machines
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Requires hardware service</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Safety Inductions</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{inductions.length} Certified</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Authorized students on roster</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Compute Queue</span>
              <div className="text-2xl font-black text-slate-900 mt-1">4 Nodes Active</div>
              <p className="text-[11px] text-slate-500 mt-1">HPC GPU partition at 65%</p>
            </div>
          </>
        )}

        {/* RESOURCE ADMIN & SYS ADMIN STATS */}
        {(role === ROLES.RESOURCE_ADMIN || role === ROLES.SYS_ADMIN) && (
          <>
            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-2xs">
              <span className="text-xs font-bold text-purple-800 uppercase">Pending Venue Approvals</span>
              <div className="text-2xl font-black text-purple-950 mt-1">{pendingEventRequests.length} Requests</div>
              <p className="text-[11px] text-purple-700 mt-1">Main Auditorium &amp; Seminar Halls</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Classroom Utilization</span>
              <div className="text-2xl font-black text-slate-900 mt-1">68.4%</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Peak: 10:45 – 13:15</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Audit Trail Events</span>
              <div className="text-2xl font-black text-slate-900 mt-1">48 Events</div>
              <p className="text-[11px] text-slate-500 mt-1">Immutable security log active</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">ERP / AUMS Integration</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">Online</div>
              <p className="text-[11px] text-slate-500 mt-1">OIDC / SAML 2.0 Synchronized</p>
            </div>
          </>
        )}

        {/* STUDENT WELFARE / LOST PROPERTY STATS */}
        {role === ROLES.LOST_PROPERTY_HANDLER && (
          <>
            <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 shadow-2xs">
              <span className="text-xs font-bold text-teal-800 uppercase">Items in Custody</span>
              <div className="text-2xl font-black text-teal-950 mt-1">{inCustodyItems.length} Items</div>
              <p className="text-[11px] text-teal-700 mt-1">Logged across campus zones</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Pending Claims</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{pendingClaims.length} Claims</div>
              <p className="text-[11px] text-slate-500 mt-1">Awaiting physical verification</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Items Returned</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{returnedItems.length} Restored</div>
              <p className="text-[11px] text-slate-500 mt-1">With signed custodial logs</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Classroom Escalations</span>
              <div className="text-2xl font-black text-slate-900 mt-1">0 Escalated</div>
              <p className="text-[11px] text-slate-500 mt-1">&gt;7 days auto-routing active</p>
            </div>
          </>
        )}
      </section>

      {/* 3. ROLE-DEDICATED PRIMARY WORKSPACE / OPERATIONAL CONSOLE */}

      {/* ========================================================================= */}
      {/* A. CLASS ADVISOR OPERATIONAL CONSOLE                                      */}
      {/* ========================================================================= */}
      {role === ROLES.CLASS_ADVISOR && (
        <div className="space-y-6">
          {/* Pending Reschedule Authorization Table */}
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Timetable Reschedule Authorization Inbox
                  </h2>
                  <p className="text-xs text-slate-500">
                    Proposals submitted by Class Reps requiring official Advisor sign-off.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1">
                {pendingChangeRequests.length} Pending Approval
              </span>
            </div>

            {pendingChangeRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                ✨ No pending timetable change proposals. All section schedules are up to date!
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {pendingChangeRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                          {req.courseCode || '22CSC401'}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-sm mt-1">{req.courseName}</h3>
                        <p className="text-xs text-slate-500">
                          Proposed by <span className="font-semibold text-slate-700">{req.requesterName}</span> ({req.classSection || 'VII B'})
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

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-amber-100">
                      <input
                        type="text"
                        placeholder="Optional advisor note or conditions..."
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAdvisorReview(req.id, 'approved')}
                          className="rounded-lg bg-emerald-600 text-white px-4 py-1.5 text-xs font-bold hover:bg-emerald-700 transition-colors shadow-2xs"
                        >
                          ✓ Approve Proposal
                        </button>
                        <button
                          onClick={() => handleAdvisorReview(req.id, 'rejected')}
                          className="rounded-lg bg-red-100 text-red-700 px-3 py-1.5 text-xs font-bold hover:bg-red-200 transition-colors"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Classroom Custody Items for Advisor */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
                <h2 className="text-sm font-bold text-slate-900">
                  Classroom Lost &amp; Found (Auto-Routed to Your Desk)
                </h2>
              </div>
              <Link to="/lost-found" className="text-xs font-semibold text-brand-600 hover:underline">
                Full Custody Board →
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              Items found in AB1 E-103B &amp; E-104 during class periods. After 7 days, items auto-escalate to Student Welfare.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 mt-2">
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-xs flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900">Casio FX-991CW Scientific Calculator</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">Found in AB1 E103B · Row 4 Desk</p>
                  <p className="text-brand-700 text-[11px] font-semibold mt-1">📍 Desk of Class Advisor Dr Devika</p>
                </div>
                <button
                  onClick={() => flashMessage('Item marked as verified and handed over to student!')}
                  className="rounded bg-brand-600 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-brand-700"
                >
                  Hand Back
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-xs flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900">Spiral Notebook (Data Security)</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">Found after Tuesday Slot 4</p>
                  <p className="text-brand-700 text-[11px] font-semibold mt-1">📍 Advisor Office (AB1 204)</p>
                </div>
                <button
                  onClick={() => flashMessage('Item marked as verified and handed over to student!')}
                  className="rounded bg-brand-600 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-brand-700"
                >
                  Hand Back
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* B. CLASS REPRESENTATIVE OPERATIONAL CONSOLE                               */}
      {/* ========================================================================= */}
      {role === ROLES.CLASS_REP && (
        <div className="space-y-6">
          {/* Active Proposals Tracker */}
          <section className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    My Section Reschedule Proposals
                  </h2>
                  <p className="text-xs text-slate-500">
                    Track requests submitted to Class Advisor Dr Devika for Int. M.Sc Data Science VII B.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProposeModal(true)}
                className="rounded-xl bg-cyan-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-cyan-700 shadow-2xs flex items-center gap-1.5"
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
                      Submitted: {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Today'}
                    </span>
                    <span className="text-xs font-bold text-slate-700 block mt-1">
                      Advisor: Dr Devika
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
                  Today's Schedule: Int. M.Sc Data Science VII B
                </h3>
              </div>
              <Link to="/academic-scheduling" className="text-xs font-semibold text-brand-600 hover:underline">
                Full 5-Day Matrix →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                <span className="text-[10px] font-bold text-slate-400 block">Slot 4 · 10:45 – 11:35</span>
                <h4 className="font-bold text-slate-900 mt-1">Deep Learning</h4>
                <p className="text-slate-500 text-[11px]">Dr Thilaga M · AB1 E103B</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                <span className="text-[10px] font-bold text-slate-400 block">Slot 5 · 11:35 – 12:25</span>
                <h4 className="font-bold text-slate-900 mt-1">Business Analytics</h4>
                <p className="text-slate-500 text-[11px]">Dr Subhraaj R · AB1 E103B</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                <span className="text-[10px] font-bold text-slate-400 block">Slot 6 · 12:25 – 13:15</span>
                <h4 className="font-bold text-slate-900 mt-1">Data Security</h4>
                <p className="text-slate-500 text-[11px]">Dr Boovamithar · AB1 E103B</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                <span className="text-[10px] font-bold text-slate-400 block">Slot 8 · 14:05 – 14:55</span>
                <h4 className="font-bold text-slate-900 mt-1">Soft Computing</h4>
                <p className="text-slate-500 text-[11px]">Dr Gnanapriyadarshini · AB1 E103B</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* C. STUDENT OPERATIONAL CONSOLE                                            */}
      {/* ========================================================================= */}
      {role === ROLES.STUDENT && (
        <div className="space-y-6">
          {/* Today's Student Schedule */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎓</span>
                <h2 className="text-base font-bold text-slate-900">
                  My Academic Schedule Today
                </h2>
              </div>
              <span className="text-xs font-semibold text-brand-600">Semester VII</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-brand-700 text-[11px]">08:50 – 09:40 · Slot 2</span>
                  <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Done</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Probabilistic Graphical Models</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Dr Kalaivani · AB1 E104</p>
              </div>
              <div className="rounded-xl border border-brand-200 p-3.5 bg-brand-50/40 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-brand-800 text-[11px]">10:45 – 11:35 · Slot 4</span>
                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse">Next Up</span>
                </div>
                <h4 className="font-bold text-brand-950 text-sm">Deep Learning</h4>
                <p className="text-brand-700 text-[11px] mt-0.5">Dr Thilaga M · AB1 E103B</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-500 text-[11px]">12:25 – 13:15 · Slot 6</span>
                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">Upcoming</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Data Security</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Dr Boovamithar · AB1 E103B</p>
              </div>
            </div>
          </section>

          {/* Real-time free study room radar */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🪑</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Real-Time Free Study Classrooms Right Now
                  </h3>
                  <p className="text-xs text-slate-500">Unoccupied lecture rooms available for silent reading and group study.</p>
                </div>
              </div>
              <Link to="/classrooms" className="text-xs font-semibold text-brand-600 hover:underline">
                View All Floors →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {rooms.slice(1, 4).map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900">{r.name}</h4>
                      <p className="text-slate-500 text-[11px]">Building {r.building} · Floor {r.floor}</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                      Open Now
                    </span>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Capacity: {r.capacity} seats</span>
                    <span className="text-emerald-700 font-semibold">Walk-in Allowed</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* My Lost Item Reports */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔎</span>
                <h3 className="text-sm font-bold text-slate-900">My Lost &amp; Found Tracking</h3>
              </div>
              <Link to="/lost-found" className="text-xs font-semibold text-brand-600 hover:underline">
                Report Item →
              </Link>
            </div>
            <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-3.5 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="font-bold text-slate-900">Milton Insulated Water Bottle (Blue, 1L)</span>
                <p className="text-slate-500 text-[11px] mt-0.5">Found at Central Food Court on 2026-10-09</p>
                <p className="text-brand-800 font-semibold text-[11px] mt-1">
                  📍 Current Custody: Office of Student Welfare (AB3 Ground Floor, Room 101)
                </p>
              </div>
              <div className="text-right">
                <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                  Ready for Pickup
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Bring College ID</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* D. FACULTY OPERATIONAL CONSOLE                                            */}
      {/* ========================================================================= */}
      {role === ROLES.FACULTY && (
        <div className="space-y-6">
          {/* Today's Teaching Agenda */}
          <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h2 className="text-base font-bold text-slate-900">
                  Today's Teaching Agenda: Dr Thilaga M
                </h2>
              </div>
              <Link to="/academic-scheduling" className="text-xs font-semibold text-brand-600 hover:underline">
                Full Academic Matrix →
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
                  <button onClick={() => flashMessage('Class roster loaded')} className="text-brand-600 font-bold hover:underline">
                    View Roster →
                  </button>
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
                  <span className="text-slate-500">Lab Assistant: Mr Suresh</span>
                  <button onClick={() => flashMessage('Class roster loaded')} className="text-brand-600 font-bold hover:underline">
                    View Roster →
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Event Venue Requests for Faculty */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎤</span>
                <h3 className="text-sm font-bold text-slate-900">My Event Venue Requests</h3>
              </div>
              <Link to="/events" className="text-xs font-semibold text-brand-600 hover:underline">
                Request New Venue →
              </Link>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h4 className="font-bold text-slate-900">National Symposium on Neural Architecture Search</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Venue: Seminar Hall, AB1 · Date: 2026-10-18 (09:00 – 13:00)</p>
                <p className="text-brand-700 text-[11px] font-semibold mt-1">Priority Score: 82 / 100 (Department Academic Event)</p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                Approved by Resource Admin
              </span>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* E. LAB ASSISTANT & LAB ADMIN OPERATIONAL CONSOLE                          */}
      {/* ========================================================================= */}
      {(role === ROLES.LAB_ASSISTANT || role === ROLES.LAB_ADMIN) && (
        <div className="space-y-6">
          {/* Equipment Fleet Management */}
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔧</span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Live Prototyping &amp; Lab Fleet Manager
                  </h2>
                  <p className="text-xs text-slate-500">
                    Toggle real-time maintenance status, record machine downtime, and monitor allocations.
                  </p>
                </div>
              </div>
              <Link to="/facilities" className="text-xs font-semibold text-brand-600 hover:underline">
                Facility Details →
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {facilities.map((fac) => (
                <div
                  key={fac.id}
                  className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 text-xs flex justify-between items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{fac.image || '⚙️'}</span>
                      <h4 className="font-bold text-slate-900 text-sm">{fac.name}</h4>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">{fac.location}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      fac.underMaintenance ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {fac.underMaintenance ? 'Under Maintenance' : 'In Service & Operational'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleMaintenance(fac.id, fac.underMaintenance)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors shadow-2xs ${
                      fac.underMaintenance
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                    }`}
                  >
                    {fac.underMaintenance ? '✓ Set Available' : '⚠️ Mark Maintenance'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Safety Induction Verification */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎓</span>
                <h3 className="text-sm font-bold text-slate-900">
                  Student Safety Induction Clearance Queue
                </h3>
              </div>
              <span className="text-xs text-slate-400">Innovation Lab Roster</span>
            </div>
            <div className="space-y-2">
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-xs flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-900">Rohit Krishna (CB.EN.U4CSE21234)</h4>
                  <p className="text-slate-500 text-[11px]">Requested: 3D Printing Lab &amp; Electronics Station Clearance</p>
                </div>
                <button
                  onClick={() => handleAuthorizeInduction('user-student-2', 'fac-3dprint')}
                  className="rounded bg-brand-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-brand-700 shadow-2xs"
                >
                  ✓ Certify Safety Badge
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* F. CENTRAL RESOURCE ADMIN & SYS ADMIN OPERATIONAL CONSOLE                 */}
      {/* ========================================================================= */}
      {(role === ROLES.RESOURCE_ADMIN || role === ROLES.SYS_ADMIN) && (
        <div className="space-y-6">
          {/* Venue Approval Desk */}
          <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    High-Demand Venue Approval &amp; Clash Resolution Desk
                  </h2>
                  <p className="text-xs text-slate-500">
                    Compete requests for Main Auditorium and Seminar Halls with automated priority scoring.
                  </p>
                </div>
              </div>
              <Link to="/events/approvals" className="text-xs font-semibold text-brand-600 hover:underline">
                Approvals Matrix →
              </Link>
            </div>

            {pendingEventRequests.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                ✨ No pending venue requests. All auditoriums are properly cleared!
              </div>
            ) : (
              <div className="space-y-3">
                {pendingEventRequests.map((evt) => (
                  <div
                    key={evt.id}
                    className="rounded-xl border border-purple-200 p-4 bg-purple-50/20 text-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-sm">{evt.title}</h4>
                          <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded text-[10px]">
                            Score: {evt.priorityScore || 85} / 100
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Organizer: {evt.requestedBy || 'Department'} · Venue: {evt.venueRoomId} · Expected: {evt.audienceSize || 300} attendees
                        </p>
                        <p className="text-brand-700 font-semibold text-[11px] mt-0.5">
                          📅 {evt.date} ({evt.start} – {evt.end})
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecideEvent(evt.id, 'approved')}
                          className="rounded-lg bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-700 shadow-2xs"
                        >
                          ✓ Approve Venue
                        </button>
                        <button
                          onClick={() => handleDecideEvent(evt.id, 'declined')}
                          className="rounded-lg bg-red-100 text-red-800 px-3 py-1.5 text-xs font-bold hover:bg-red-200"
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Audit Trail & ERP Gateway */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <h3 className="text-sm font-bold text-slate-900">
                  Campus Governance &amp; E-Governance (AUMS) Gateway
                </h3>
              </div>
              <button
                onClick={handleTestErpSync}
                disabled={syncStatus === 'syncing'}
                className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs"
              >
                {syncStatus === 'syncing' ? 'Syncing...' : '🔄 Simulate AUMS Roster Sync'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Immutable audit log verifies room bookings, timetable shifts, and security handovers against the university central database.
            </p>
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-[11px] font-mono text-slate-700 flex justify-between items-center">
              <span>Adapter Status: <strong className="text-emerald-700">ONLINE</strong> · Protocol: OpenID Connect / SAML 2.0</span>
              <Link to="/governance" className="text-brand-600 font-bold hover:underline">
                Inspect Security Audit Trail →
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* G. STUDENT WELFARE / LOST PROPERTY HANDLER CONSOLE                        */}
      {/* ========================================================================= */}
      {role === ROLES.LOST_PROPERTY_HANDLER && (
        <div className="space-y-6">
          {/* Physical Custody Desk */}
          <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎒</span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Physical Custody Intake &amp; Dispatch Desk
                  </h2>
                  <p className="text-xs text-slate-500">
                    Items discovered in campus common areas or escalated from classrooms after 7 days.
                  </p>
                </div>
              </div>
              <Link to="/lost-found" className="text-xs font-semibold text-brand-600 hover:underline">
                Full Lost &amp; Found →
              </Link>
            </div>

            <div className="space-y-3">
              {inCustodyItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-teal-200/80 bg-teal-50/20 p-4 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{item.name || item.title}</h4>
                      <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        Custody: {item.currentCustody || 'Student Welfare'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Location: {item.location || 'Campus Common Area'} · Found by: {item.finderName || 'Student'}
                    </p>
                    <p className="text-teal-900 font-medium text-[11px] mt-1 bg-white p-1 rounded border border-teal-200/60 inline-block">
                      📌 {item.routingReason || 'Auto-routed to Student Welfare Desk'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleHandoverItem(item.id)}
                      className="rounded-lg bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-700 shadow-2xs"
                    >
                      ✓ Verify &amp; Hand Over
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 4. CAMPUS EVENTS FEED (Shared at bottom) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎤</span>
            <h2 className="text-sm font-bold text-slate-800">
              Happening on Campus — Approved Public Events
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
            {events.slice(0, 2).map((evt) => (
              <div
                key={evt.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs flex justify-between items-start"
              >
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{evt.title || evt.name}</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {evt.organizer} · Venue: {evt.venueId || evt.venueRoomId || 'Main Auditorium'}
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

      {/* 5. PROPOSE RESCHEDULE MODAL (For Class Rep) */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Propose Timetable Reschedule (Class Rep)
              </h3>
              <button onClick={() => setShowProposeModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleProposeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Course</label>
                <select
                  value={proposeForm.courseName}
                  onChange={(e) => setProposeForm({ ...proposeForm, courseName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-brand-500"
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
                    value={`${proposeForm.originalDay} ${proposeForm.originalSlot}`}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Proposed Slot</label>
                  <select
                    value={proposeForm.proposedSlot}
                    onChange={(e) => setProposeForm({ ...proposeForm, proposedSlot: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-brand-500"
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
                  value={proposeForm.proposedDay}
                  onChange={(e) => setProposeForm({ ...proposeForm, proposedDay: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-brand-500"
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
                  value={proposeForm.reason}
                  onChange={(e) => setProposeForm({ ...proposeForm, reason: e.target.value })}
                  placeholder="Explain why this class needs to move..."
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
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
