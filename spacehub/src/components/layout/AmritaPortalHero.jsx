import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROLES } from '../../lib/constants'

export default function AmritaPortalHero({ user, onActionClick, customAlerts = [] }) {
  const navigate = useNavigate()
  const [scrollIdx, setScrollIdx] = useState(0)
  const [activeTile, setActiveTile] = useState(null)
  const [animatingTile, setAnimatingTile] = useState(null)
  const [activeModal, setActiveModal] = useState(null)
  const [toastMsg, setToastMsg] = useState('')

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  // Format identity matching: Welcome! JITHU S( CB.PS.I5DAS23157 )
  const rollOrCode =
    user?.rollNumber ||
    (user?.role === ROLES.CLASS_REP ? 'CB.PS.I5DAS23157' : user?.id?.toUpperCase() || 'CB.EN.U4CSE21234')

  const displayName = (user?.name || 'STUDENT').toUpperCase()

  // Standard university alerts plus live contextual alerts
  const defaultAlerts = [
    { id: 'alt-1', title: 'Payment Help Document', link: '#' },
    { id: 'alt-2', title: 'Propelld loan process flow', link: '#' },
    { id: 'alt-3', title: 'Odd Semester 2026-27 Academic Calendar & Fee Schedule', link: '#' },
    { id: 'alt-4', title: 'Campus Wi-Fi (Amrita-Secure) Digital Certificate Renewal', link: '#' },
  ]
  const alerts = [...customAlerts, ...defaultAlerts]

  const visibleAlerts = alerts.slice(scrollIdx, scrollIdx + 2)

  // Role-specific action tiles tailored to the authentic 4-column Amrita portal layout
  function getActionTiles(role) {
    if (role === ROLES.CAMPUS_DIRECTOR) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'DIRECTOR APPROVALS', icon: '🏛️', targetId: 'approvals' },
        { label: 'TIMETABLE MATRIX', icon: '📅', path: '/academic-scheduling' },
        { label: 'CAMPUS VENUES', icon: '🎤', path: '/events' },
        { label: 'ANALYTICS', icon: '📊', modalType: 'analytics' },
        { label: 'AUDIT TRAIL', icon: '🛡️', path: '/governance' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
      ]
    }

    if (role === ROLES.DEAN) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'DEAN DESK', icon: '📋', targetId: 'reviews' },
        { label: 'SCHOOL TIMETABLE', icon: '📅', path: '/academic-scheduling' },
        { label: 'FACULTY SCHEDULES', icon: '🧑‍🏫', modalType: 'dept_faculty' },
        { label: 'CLASSROOMS', icon: '🏫', path: '/classrooms' },
        { label: 'EVENT PROPOSALS', icon: '🎤', targetId: 'reviews' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
      ]
    }

    if (role === ROLES.HOD) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'HOD DESK', icon: '🏢', targetId: 'reviews' },
        { label: 'DEPT TIMETABLE', icon: '📅', path: '/academic-scheduling' },
        { label: 'DEPT FACULTY', icon: '🧑‍🏫', modalType: 'dept_faculty' },
        { label: 'DEPT LABS', icon: '🔬', modalType: 'dept_labs' },
        { label: 'REQUESTS', icon: '📝', targetId: 'reviews' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
      ]
    }

    if (role === ROLES.HPC_FACULTY) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'HPC OVERVIEW', icon: '⚡', path: '/facilities/hpc' },
        { label: 'NODE FLEET', icon: '🖥️', path: '/facilities/hpc' },
        { label: 'SLURM JOBS', icon: '🏃', path: '/facilities/hpc' },
        { label: 'INCIDENTS', icon: '⚠️', modalType: 'services' },
        { label: 'MAINTENANCE', icon: '🛠️', modalType: 'services' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
      ]
    }

    if (role === ROLES.CLASS_REP) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'TIMETABLE', icon: '📅', path: '/academic-scheduling' },
        { label: 'RESCHEDULE', icon: '⚡', path: '/academic-scheduling' },
        { label: 'BOOK ROOM', icon: '🏫', path: '/classrooms' },
        { label: 'CAMPUS EVENTS', icon: '🎤', path: '/events' },
        { label: 'LOST & FOUND', icon: '🎒', path: '/lost-found' },
        { label: 'ATTENDANCE', icon: '🎓', modalType: 'attendance' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
        { label: 'COMPLAINTS', icon: '💬', modalType: 'complaints' },
        { label: 'GATE PASS', icon: '🏛️', modalType: 'gate_pass' },
        { label: 'DOWNLOADS', icon: '📥', modalType: 'downloads' },
      ]
    }

    if (role === ROLES.CLASS_ADVISOR) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'APPROVALS', icon: '⚡', targetId: 'authorizations' },
        { label: 'TIMETABLE', icon: '📅', path: '/academic-scheduling' },
        { label: 'CUSTODY DESK', icon: '📦', path: '/lost-found' },
        { label: 'CLASSROOM RADAR', icon: '🏫', path: '/classrooms' },
        { label: 'ADVISEE LIST', icon: '👤', modalType: 'advisee_list' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
      ]
    }

    if (role === ROLES.FACULTY) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'TIMETABLE', icon: '📚', path: '/academic-scheduling' },
        { label: 'CLASSROOMS', icon: '🏫', path: '/classrooms' },
        { label: 'REQUEST VENUE', icon: '🎤', path: '/events/new' },
        { label: 'ATTENDANCE', icon: '🎓', modalType: 'attendance' },
        { label: 'RESEARCH HPC', icon: '🖥️', path: '/facilities/hpc' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
      ]
    }

    if (role === ROLES.LAB_ASSISTANT || role === ROLES.LAB_ADMIN) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'LAB FLEET', icon: '🔧', path: '/facilities' },
        { label: 'INDUCTIONS', icon: '🎓', path: '/facilities' },
        { label: 'MAINTENANCE', icon: '🛠️', path: '/facilities' },
        { label: 'INCIDENTS', icon: '⚠️', path: '/facilities' },
        { label: 'EQUIPMENT LOG', icon: '⚙️', path: '/facilities' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
      ]
    }

    if (role === ROLES.RESOURCE_ADMIN || role === 'admin') {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'VENUE APPROVALS', icon: '⚖️', targetId: 'approvals' },
        { label: 'CAMPUS VENUES', icon: '🎤', path: '/events' },
        { label: 'CLASSROOMS', icon: '🏫', path: '/classrooms' },
        { label: 'ANALYTICS', icon: '📊', modalType: 'analytics' },
        { label: 'AUDIT TRAIL', icon: '🛡️', path: '/governance' },
        { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
        { label: 'SERVICES', icon: '📝', modalType: 'services' },
      ]
    }

    // Default: Student action grid
    return [
      { label: 'PROFILE', icon: '🎓', path: '/profile' },
      { label: 'PAYMENTS', icon: '₹', modalType: 'payments' },
      { label: 'GATE PASS', icon: '🏛️', modalType: 'gate_pass' },
      { label: 'SERVICES', icon: '📝', modalType: 'services' },
      { label: 'COMPLAINTS', icon: '💬', modalType: 'complaints' },
      { label: 'DOWNLOADS', icon: '📥', modalType: 'downloads' },
      { label: 'DOCUMENTS', icon: '📄', modalType: 'documents' },
      { label: 'CLASS ATTENDANCE', icon: '🎓', modalType: 'attendance' },
      { label: 'TIMETABLE', icon: '👤', path: '/academic-scheduling' },
      { label: 'CAMPUS VENUES', icon: '🎤', path: '/events' },
      { label: 'CLASSROOMS', icon: '🏫', path: '/classrooms' },
      { label: 'LOST & FOUND', icon: '🎒', path: '/lost-found' },
    ]
  }

  const actionTiles = getActionTiles(user?.role)

  function handleTileClick(tile) {
    setActiveTile(tile.label)
    setAnimatingTile(tile.label)

    // Case 1: Scroll to an on-page section
    if (tile.targetId) {
      setTimeout(() => {
        const elem = document.getElementById(tile.targetId)
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'start' })
          elem.classList.add('ring-4', 'ring-[#990033]/30', 'transition-all')
          setTimeout(() => {
            elem.classList.remove('ring-4', 'ring-[#990033]/30')
          }, 2000)
        } else {
          showToast(`Opened ${tile.label}`)
        }
      }, 350)
      return
    }

    // Case 2: Open an interactive modal
    if (tile.modalType) {
      setTimeout(() => {
        setActiveModal(tile.modalType)
      }, 350)
      return
    }

    // Case 3: Navigate to router path
    if (tile.path && tile.path !== '#') {
      setTimeout(() => {
        navigate(tile.path)
      }, 350)
      return
    }

    // Fallback: Custom action callback or toast
    if (onActionClick) {
      onActionClick(tile.label)
    } else {
      showToast(`${tile.label} action triggered`)
    }
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 rounded-xl bg-[#990033] text-white px-4 py-2.5 text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in">
          <span>🔔</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Breadcrumb: Home */}
      <div className="flex items-center gap-1.5 text-xs text-blue-700">
        <Link to="/" className="hover:underline">Home</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-600 font-semibold">{user?.department || 'Amrita Vishwa Vidyapeetham'}</span>
      </div>

      {/* 2. Welcome Title in Maroon */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-bold text-[#990033] tracking-tight">
          Welcome! {displayName}( {rollOrCode} )
        </h1>
      </div>

      {/* 3. Top Two Cards: Inspirational Quote Banner (Left) + Alerts Widget (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Card: Amma Quote with Portrait */}
        <div className="lg:col-span-8 rounded-xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5">
            <div className="flex-1 pr-0 sm:pr-4">
              {/* Golden Quotation Mark */}
              <span className="text-4xl sm:text-5xl font-serif text-[#F59E0B] leading-none block select-none">
                “
              </span>
              <p className="text-xs sm:text-[13px] text-[#990033] leading-relaxed font-normal mt-1 text-justify">
                Youngsters need to understand the real purpose of life. They need courage and wisdom to face the challenges of life. Only with that understanding they can become the light of the world. If we care for them responsibly and mold their whole character with love, then the future of the world will be safe
              </p>
              <div className="text-xs font-bold text-[#990033] mt-3 tracking-wide">
                — Amma
              </div>
            </div>

            {/* Circular Portrait of Amma with Cyan Border Ring */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-0.5 border-2 border-cyan-400 bg-white shadow-xs overflow-hidden flex items-center justify-center">
                <img
                  src="/amma.png"
                  alt="Chancellor Mata Amritanandamayi"
                  className="w-full h-full object-cover object-top rounded-full"
                />
              </div>
              <span className="absolute bottom-1 right-2 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-xs"></span>
            </div>
          </div>
        </div>

        {/* Right Card: Alerts Desk */}
        <div className="lg:col-span-4 rounded-xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2">
              <h2 className="text-base font-bold text-[#990033]">Alerts</h2>
              <div className="flex gap-1 text-[11px] text-slate-400">
                <button
                  onClick={() => setScrollIdx((i) => Math.max(0, i - 1))}
                  disabled={scrollIdx === 0}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                  title="Scroll alerts up"
                >
                  ▲
                </button>
                <button
                  onClick={() => setScrollIdx((i) => Math.min(alerts.length - 2, i + 1))}
                  disabled={scrollIdx >= alerts.length - 2}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                  title="Scroll alerts down"
                >
                  ▼
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {visibleAlerts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.link?.startsWith('#')) {
                      const target = document.getElementById(item.link.slice(1))
                      if (target) target.scrollIntoView({ behavior: 'smooth' })
                    } else if (item.link && item.link !== '#') {
                      navigate(item.link)
                    } else {
                      setActiveModal('documents')
                    }
                  }}
                  className="flex items-start gap-2 text-xs text-blue-700 hover:text-blue-900 group cursor-pointer"
                >
                  <span className="text-slate-400 text-[10px] mt-0.5">❯</span>
                  <span className="text-slate-400 text-xs">❔</span>
                  <span className="hover:underline leading-snug line-clamp-2">
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between items-center">
            <span>AUMS Portal Sync: <strong className="text-emerald-700">Live</strong></span>
            <span className="text-[10px]">Showing {scrollIdx + 1}–{Math.min(scrollIdx + 2, alerts.length)} of {alerts.length}</span>
          </div>
        </div>
      </div>

      {/* 4. Action Pills Grid (Authentic Amrita College Portal 4-column layout) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        {actionTiles.map((tile, idx) => {
          const isFilled = activeTile === tile.label || animatingTile === tile.label

          return (
            <button
              key={idx}
              type="button"
              onMouseDown={() => setAnimatingTile(tile.label)}
              onClick={() => handleTileClick(tile)}
              className={`relative flex items-center justify-between rounded-lg shadow-xs hover:shadow-md border overflow-hidden group h-12 text-left cursor-pointer transition-all duration-200 select-none ${
                isFilled
                  ? 'border-[#990033] shadow-md ring-1 ring-[#990033]/40'
                  : 'bg-white border-slate-200/90 hover:border-[#990033]/60'
              }`}
            >
              {/* Right-to-Left Red Fill Animation Layer */}
              <span
                className={`absolute inset-0 bg-[#990033] pointer-events-none z-0 ${
                  isFilled ? 'scale-x-100' : 'scale-x-0'
                }`}
                style={{
                  transformOrigin: 'right center',
                  transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />

              {/* Action Title Label */}
              <span
                className={`flex-1 text-center font-bold text-[11px] sm:text-xs tracking-wide uppercase px-2 truncate relative z-10 transition-colors duration-250 ${
                  isFilled ? 'text-white' : 'text-[#990033] group-hover:text-[#7d0029]'
                }`}
              >
                {tile.label}
              </span>

              {/* Right-side Angled Badge with Icon */}
              <div
                className={`w-11 sm:w-12 h-full text-white flex items-center justify-center text-xs sm:text-sm [clip-path:polygon(32%_0%,100%_0%,100%_100%,0%_100%)] pl-2 shrink-0 relative z-10 transition-colors duration-200 ${
                  isFilled ? 'bg-[#990033]' : 'bg-[#990033] group-hover:bg-[#80002b]'
                }`}
              >
                <span className="font-bold drop-shadow-xs">{tile.icon}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* ========================================================= */}
      {/* INTERACTIVE MODALS FOR QUICK ACTION TILES                 */}
      {/* ========================================================= */}

      {/* 1. DOCUMENTS & CIRCULARS MODAL */}
      {activeModal === 'documents' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#990033] bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Official Institutional Documents
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Amrita University Directives, Policy Documents &amp; Circulars
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {[
                {
                  title: 'Campus Resource Allocation & Central Booking Policy 2026-27',
                  code: 'AMRITA/DIR/POL/2026-08',
                  category: 'Campus Administration',
                  date: 'Aug 2026',
                  desc: 'Defines final approval authority of the Campus Director and hierarchical role prioritization matrix (0.60 * R + 0.40 * E).',
                },
                {
                  title: 'Odd Semester 2026-27 Academic Calendar & Mid-Term Exam Schedules',
                  code: 'AMRITA/DEAN/ACAD/2026-14',
                  category: 'Deanery of Engineering',
                  date: 'Sep 2026',
                  desc: 'Official semester dates, holiday schedule, Continuous Internal Assessment (CIA) slots, and department timetable lock dates.',
                },
                {
                  title: 'Department Computer Laboratory Safety & Student Custody Protocol',
                  code: 'AMRITA/CSE/LAB/2026-03',
                  category: 'Computer Science & Engineering',
                  date: 'Oct 2026',
                  desc: 'Guidelines for AB1 & AB2 student computing access, HPC cluster job submissions, and lost equipment custody routing.',
                },
                {
                  title: 'University Event Priority & Multi-Departmental Clash Arbitration Guidelines',
                  code: 'AMRITA/REG/CIR/2026-22',
                  category: 'University Registrar',
                  date: 'Oct 2026',
                  desc: 'Priority weighting standards for International, National, and Departmental symposia competing for flagship auditoriums.',
                },
              ].map((doc, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-200 hover:border-[#990033]/50 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{doc.title}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-semibold">{doc.code}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{doc.desc}</p>
                    <span className="text-[10px] text-indigo-700 font-semibold">{doc.category} · Issued: {doc.date}</span>
                  </div>
                  <button
                    onClick={() => showToast(`Document "${doc.title}" downloaded successfully!`)}
                    className="shrink-0 rounded-lg bg-[#990033] hover:bg-[#80002b] text-white text-[11px] font-bold px-3 py-1.5 shadow-2xs transition"
                  >
                    📥 Download PDF
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SERVICES DESK MODAL */}
      {activeModal === 'services' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#990033] bg-rose-100 px-2.5 py-0.5 rounded-full">
                  University Campus Services
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Administrative Services &amp; Digital Requisition Desk
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div
                onClick={() => { setActiveModal(null); navigate('/classrooms') }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-[#990033] bg-slate-50/50 hover:bg-white cursor-pointer transition space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏫</span>
                  <span className="font-extrabold text-slate-900">Classroom Booking</span>
                </div>
                <p className="text-[11px] text-slate-500">Reserve academic lecture spaces in AB1 &amp; AB2.</p>
              </div>

              <div
                onClick={() => { setActiveModal(null); navigate('/events/new') }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-[#990033] bg-slate-50/50 hover:bg-white cursor-pointer transition space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎤</span>
                  <span className="font-extrabold text-slate-900">Auditorium Requisition</span>
                </div>
                <p className="text-[11px] text-slate-500">Apply for Main Auditorium &amp; Seminar Halls.</p>
              </div>

              <div
                onClick={() => { setActiveModal(null); navigate('/facilities') }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-[#990033] bg-slate-50/50 hover:bg-white cursor-pointer transition space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔧</span>
                  <span className="font-extrabold text-slate-900">Lab Induction &amp; Fleet</span>
                </div>
                <p className="text-[11px] text-slate-500">Station inductions &amp; hardware access passes.</p>
              </div>

              <div
                onClick={() => { setActiveModal(null); navigate('/facilities/hpc') }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-[#990033] bg-slate-50/50 hover:bg-white cursor-pointer transition space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="font-extrabold text-slate-900">HPC Compute Partition</span>
                </div>
                <p className="text-[11px] text-slate-500">Request A100 GPU node-hours for research jobs.</p>
              </div>

              <div
                onClick={() => showToast('Digital Amrita Wi-Fi Certificate renewed for next 180 days!')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50/50 hover:bg-white cursor-pointer transition space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📶</span>
                  <span className="font-extrabold text-slate-900">Campus Wi-Fi Renewal</span>
                </div>
                <p className="text-[11px] text-slate-500">Amrita-Secure 802.1X enterprise profile.</p>
              </div>

              <div
                onClick={() => { setActiveModal(null); navigate('/lost-found') }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-white cursor-pointer transition space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎒</span>
                  <span className="font-extrabold text-slate-900">Lost &amp; Found Desk</span>
                </div>
                <p className="text-[11px] text-slate-500">Smart routing to Class Advisor / Welfare.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DEPARTMENT FACULTY ROSTER MODAL */}
      {activeModal === 'dept_faculty' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#990033] bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Department Faculty &amp; Academic Workload
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Computer Science &amp; Engineering Faculty Roster
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { name: 'Dr Prema Nedungadi', role: 'Professor & Head of Department', courses: 'Director CREATE · PhD Research', cabin: 'AB1-214', status: 'Available' },
                { name: 'Dr Thilaga M', role: 'Associate Professor', courses: '22CSC401 Deep Learning (VII B)', cabin: 'AB1-308', status: 'In Class (Slot 4)' },
                { name: 'Dr Kalaivani', role: 'Associate Professor', courses: '22MAT401 Probabilistic Graphical Models', cabin: 'AB1-205', status: 'Available' },
                { name: 'Dr Jeyaramakrishnan', role: 'Assistant Professor', courses: '22CSC403 Reinforcement Learning (VII B)', cabin: 'AB1-112', status: 'Lab AB1-W102' },
                { name: 'Dr Boovamithar Rakshit', role: 'Assistant Professor', courses: '22CSC404 Data Security (VII B)', cabin: 'AB1-118', status: 'Available' },
                { name: 'Ms Kavipriya', role: 'Assistant Professor', courses: '22CSC401L Open Lab-I (Hadoop/RapidMiner)', cabin: 'AB1-W102', status: 'Lab Session' },
                { name: 'Dr Subhraaj R', role: 'Assistant Professor', courses: '22CSC343 Business Analytics', cabin: 'AB2-104', status: 'Available' },
              ].map((fac, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900">{fac.name}</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-900 px-2 py-0.2 rounded font-semibold">{fac.role}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">Assigned Courses: {fac.courses} · Cabin: {fac.cabin}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${fac.status.includes('Available') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    ● {fac.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DEPARTMENT LABS MODAL */}
      {activeModal === 'dept_labs' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#990033] bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Department Computing Infrastructure
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  CSE Department Laboratories &amp; Research Facilities
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {[
                { name: 'AB1-W102: Data Science & Analytics Lab (Open Lab-I)', capacity: '40 Workstations', tools: 'Hadoop, Spark, RapidMiner, Python 3.12, RStudio', status: 'Operational' },
                { name: 'AB1-E104: Artificial Intelligence & Vision Research Lab', capacity: '35 Workstations', tools: 'NVIDIA RTX 4090 GPUs, PyTorch 2.4, ROS2 Humble', status: 'Active (Session in progress)' },
                { name: 'AB2-201: Networks & Distributed Systems Lab', capacity: '50 Workstations', tools: 'Cisco Packet Tracer, Wireshark, GNS3, Linux Ubuntu 24.04', status: 'Operational' },
                { name: 'Central CCE HPC Partition (DGX-A100)', capacity: '4x NVIDIA A100 80GB', tools: 'CUDA 12.2, SLURM 23.11, MPI, Singularity Containers', status: 'Cluster Online (92% Load)' },
              ].map((lab, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">{lab.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Capacity: {lab.capacity} · Software Stack: {lab.tools}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0 self-start sm:self-auto">
                    ● {lab.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. EXECUTIVE ANALYTICS MODAL */}
      {activeModal === 'analytics' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#990033] bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Directorate Institutional Analytics
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Campus Space &amp; Timetable Utilization Metrics
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">Classroom Utilization</span>
                <span className="text-xl font-black text-rose-950 mt-1 block">78.4%</span>
                <span className="text-[10px] text-rose-700">Odd Semester Average</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Peak Slot</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">Slot 4 &amp; 5</span>
                <span className="text-[10px] text-slate-500">10:45 – 12:25</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Clashes Prevented</span>
                <span className="text-xl font-black text-emerald-950 mt-1 block">100%</span>
                <span className="text-[10px] text-emerald-700">Strict Slot Isolation</span>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                <span className="text-[10px] uppercase font-bold text-indigo-800 block">Avg Clearance Time</span>
                <span className="text-xl font-black text-indigo-950 mt-1 block">4.2 hrs</span>
                <span className="text-[10px] text-indigo-700">Director Sanctions</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <span className="font-extrabold text-slate-900 block">Space Utilization by Department:</span>
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                    <span>Computer Science &amp; Engineering</span>
                    <span>42%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-[#990033] h-2 rounded-full" style={{ width: '42%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                    <span>Electronics &amp; Communication</span>
                    <span>28%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '28%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                    <span>Mechanical Engineering</span>
                    <span>18%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '18%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                    <span>Sciences &amp; Mathematics</span>
                    <span>12%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '12%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ATTENDANCE & ACADEMIC PROGRESS MODAL */}
      {activeModal === 'attendance' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Academic Progress Record
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Official Course Attendance (Odd Sem 2026-27)
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { code: '22CSC401', name: 'Deep Learning', held: 36, attended: 33, pct: 91.7 },
                { code: '22MAT401', name: 'Probabilistic Graphical Models', held: 34, attended: 30, pct: 88.2 },
                { code: '22CSC403', name: 'Reinforcement Learning', held: 32, attended: 29, pct: 90.6 },
                { code: '22CSC404', name: 'Data Security', held: 30, attended: 26, pct: 86.7 },
                { code: '22CSC401L', name: 'Open Lab-I (Practical)', held: 28, attended: 27, pct: 96.4 },
              ].map((c, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{c.code} {c.name}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{c.attended} / {c.held} periods attended</p>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded ${c.pct >= 85 ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                    {c.pct}%
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. DIGITAL GATE PASS MODAL */}
      {activeModal === 'gate_pass' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30 text-center">
            <span className="text-[10px] font-black uppercase text-[#990033] bg-rose-100 px-3 py-0.5 rounded-full">
              Amrita Smart Campus Security
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-1">
              Digital Day Gate Pass
            </h3>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="w-32 h-32 mx-auto bg-white rounded-xl border-2 border-slate-900 flex items-center justify-center font-mono font-bold text-2xl shadow-xs">
                [ QR PASS ]
              </div>
              <p className="font-extrabold text-slate-900">{displayName}</p>
              <p className="text-slate-500 font-mono text-[11px]">Pass ID: GP-2026-OCT-11-8429</p>
              <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                Valid for Exit &amp; Re-entry: 16:30 – 21:00
              </span>
            </div>

            <button
              onClick={() => showToast('Gate Pass downloaded to your device!')}
              className="w-full rounded-xl bg-[#990033] hover:bg-[#80002b] text-white py-2 text-xs font-bold transition shadow-xs"
            >
              📥 Save to Phone Wallet
            </button>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="text-xs text-slate-500 hover:underline block mx-auto"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 8. COMPLAINTS & GRIEVANCE MODAL */}
      {activeModal === 'complaints' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-extrabold text-slate-900">
                Campus Grievance &amp; Maintenance Ticket
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                showToast('Maintenance ticket #TKT-8291 logged with Central Facilities!')
                setActiveModal(null)
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Issue Category:</label>
                <select className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-none focus:border-[#990033]">
                  <option>Classroom Projector / AV Malfunction</option>
                  <option>Wi-Fi Access Point Latency</option>
                  <option>Air Conditioning / Climate Control</option>
                  <option>Laboratory Power Socket / Equipment</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Location / Classroom:</label>
                <input
                  type="text"
                  defaultValue="AB1 E103B"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-none focus:border-[#990033]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description:</label>
                <textarea
                  rows={2}
                  placeholder="Describe the issue..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-none focus:border-[#990033]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-slate-600 font-bold">Cancel</button>
                <button type="submit" className="rounded-xl bg-[#990033] hover:bg-[#80002b] text-white px-4 py-2 font-bold shadow-xs">
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. DOWNLOADS MODAL */}
      {activeModal === 'downloads' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-extrabold text-slate-900">Academic Downloads &amp; Forms</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                'B.Tech / Int. M.Sc Curriculum Structure 2026',
                'Official Bonafide Certificate Generator',
                'Fee Receipt — Odd Semester 2026-27',
                'Hostel Clearance & Mess Requisition Form',
              ].map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-[11px]">{item}</span>
                  <button
                    onClick={() => showToast(`Downloaded: ${item}`)}
                    className="text-xs text-[#990033] font-black hover:underline"
                  >
                    Download →
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-bold text-slate-600">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* 10. PAYMENTS MODAL */}
      {activeModal === 'payments' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-extrabold text-slate-900">AUMS Fee Payment Status</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="font-bold text-emerald-950">Odd Semester Tuition Fee 2026-27</span>
                  <p className="text-[10px] text-emerald-700">Receipt: REC-AMR-2026-9482</p>
                </div>
                <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                  PAID ✓
                </span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="font-bold text-emerald-950">Hostel &amp; Dining Hall Charges</span>
                  <p className="text-[10px] text-emerald-700">Receipt: REC-HST-2026-3190</p>
                </div>
                <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                  PAID ✓
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-bold text-slate-600">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* 11. ADVISEE LIST MODAL */}
      {activeModal === 'advisee_list' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[#990033]/30">
            <div className="flex items-start justify-between border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                  Class Advisor Roster
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Advisee Students: Int. M.Sc Data Science (VII B)
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { name: 'Devika Nair', roll: 'CB.PS.I5DAS23157', role: 'Class Representative', gpa: '9.42' },
                { name: 'Aarav Menon', roll: 'CB.PS.I5DAS23101', role: 'Student', gpa: '8.85' },
                { name: 'Aditya Krishnan', roll: 'CB.PS.I5DAS23104', role: 'Student', gpa: '9.12' },
                { name: 'Meera S', roll: 'CB.PS.I5DAS23122', role: 'Student', gpa: '8.94' },
                { name: 'Rohan Verma', roll: 'CB.PS.I5DAS23135', role: 'Student', gpa: '8.65' },
              ].map((s, i) => (
                <div key={i} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900">{s.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono ml-2">({s.roll})</span>
                    <span className="text-[10px] text-indigo-700 ml-2 font-semibold">{s.role}</span>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">CGPA: {s.gpa}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-bold text-slate-600">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
