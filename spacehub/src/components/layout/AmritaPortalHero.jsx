import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROLES } from '../../lib/constants'

export default function AmritaPortalHero({ user, onActionClick, customAlerts = [] }) {
  const navigate = useNavigate()
  const [scrollIdx, setScrollIdx] = useState(0)
  const [activeTile, setActiveTile] = useState('DOWNLOADS')
  const [animatingTile, setAnimatingTile] = useState(null)

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
    if (role === ROLES.HPC_FACULTY) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'HPC OVERVIEW', icon: '⚡', path: '/' },
        { label: 'NODE FLEET', icon: '🖥️', path: '/facilities/hpc' },
        { label: 'SLURM JOBS', icon: '🏃', path: '/facilities/hpc' },
        { label: 'INCIDENTS', icon: '⚠️', path: '/' },
        { label: 'MAINTENANCE', icon: '🛠️', path: '/' },
        { label: 'DOCUMENTS', icon: '📄', path: '#' },
        { label: 'SERVICES', icon: '📝', path: '#' },
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
        { label: 'ATTENDANCE', icon: '🎓', path: '#' },
        { label: 'DOCUMENTS', icon: '📄', path: '#' },
        { label: 'SERVICES', icon: '📝', path: '#' },
        { label: 'COMPLAINTS', icon: '💬', path: '#' },
        { label: 'GATE PASS', icon: '🏛️', path: '#' },
        { label: 'DOWNLOADS', icon: '📥', path: '#' },
      ]
    }

    if (role === ROLES.CLASS_ADVISOR) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'APPROVALS', icon: '⚡', path: '/academic-scheduling' },
        { label: 'TIMETABLE', icon: '📅', path: '/academic-scheduling' },
        { label: 'CUSTODY DESK', icon: '📦', path: '/lost-found' },
        { label: 'CLASSROOM RADAR', icon: '🏫', path: '/classrooms' },
        { label: 'ADVISEE LIST', icon: '👤', path: '#' },
        { label: 'DOCUMENTS', icon: '📄', path: '#' },
        { label: 'SERVICES', icon: '📝', path: '#' },
      ]
    }

    if (role === ROLES.FACULTY) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'TIMETABLE', icon: '📚', path: '/academic-scheduling' },
        { label: 'CLASSROOMS', icon: '🏫', path: '/classrooms' },
        { label: 'REQUEST VENUE', icon: '🎤', path: '/events/new' },
        { label: 'ATTENDANCE', icon: '🎓', path: '#' },
        { label: 'RESEARCH HPC', icon: '🖥️', path: '/facilities/hpc' },
        { label: 'DOCUMENTS', icon: '📄', path: '#' },
        { label: 'SERVICES', icon: '📝', path: '#' },
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
        { label: 'DOCUMENTS', icon: '📄', path: '#' },
        { label: 'SERVICES', icon: '📝', path: '#' },
      ]
    }

    if (role === ROLES.RESOURCE_ADMIN || role === 'admin') {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'VENUE APPROVALS', icon: '⚖️', path: '/events/approvals' },
        { label: 'CAMPUS VENUES', icon: '🎤', path: '/events' },
        { label: 'CLASSROOMS', icon: '🏫', path: '/classrooms' },
        { label: 'ANALYTICS', icon: '📊', path: '/admin' },
        { label: 'AUDIT TRAIL', icon: '🛡️', path: '/governance' },
        { label: 'DOCUMENTS', icon: '📄', path: '#' },
        { label: 'SERVICES', icon: '📝', path: '#' },
      ]
    }

    if (role === ROLES.LOST_PROPERTY_HANDLER) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'CUSTODY DESK', icon: '🎒', path: '/lost-found' },
        { label: 'VERIFY CLAIMS', icon: '⚖️', path: '/lost-found' },
        { label: 'HANDOVER LOGS', icon: '📋', path: '/lost-found' },
        { label: 'CAMPUS BLOCKS', icon: '🏫', path: '/classrooms' },
        { label: 'ESCALATIONS', icon: '⚠️', path: '/lost-found' },
        { label: 'DOCUMENTS', icon: '📄', path: '#' },
        { label: 'SERVICES', icon: '📝', path: '#' },
      ]
    }

    if (role === ROLES.SYS_ADMIN) {
      return [
        { label: 'PROFILE', icon: '🎓', path: '/profile' },
        { label: 'GOVERNANCE & ERP', icon: '🛡️', path: '/governance' },
        { label: 'SYSTEM HEALTH', icon: '📊', path: '/admin' },
        { label: 'AUDIT LOGS', icon: '📋', path: '/governance' },
        { label: 'AUMS SYNC', icon: '🔄', path: '/governance' },
        { label: 'SECURITY', icon: '🔒', path: '/governance' },
        { label: 'DOCUMENTS', icon: '📄', path: '#' },
        { label: 'SERVICES', icon: '📝', path: '#' },
      ]
    }

    // Default: Student action grid (Exact matches from the Amrita college portal screenshot)
    return [
      { label: 'PROFILE', icon: '🎓', path: '/profile' },
      { label: 'PAYMENTS', icon: '₹', path: '#' },
      { label: 'GATE PASS', icon: '🏛️', path: '#' },
      { label: 'SERVICES', icon: '📝', path: '/facilities' },
      { label: 'COMPLAINTS', icon: '💬', path: '#' },
      { label: 'DOWNLOADS', icon: '📥', path: '#' },
      { label: 'DOCUMENTS', icon: '📄', path: '#' },
      { label: 'INCIDENTS', icon: '💬', path: '#' },
      { label: 'CLASS ATTENDANCE', icon: '🎓', path: '#' },
      { label: 'LEAVE LIST', icon: '🏛️', path: '#' },
      { label: 'AWARDS', icon: '🎓', path: '#' },
      { label: 'TIMETABLE', icon: '👤', path: '/academic-scheduling' },
      { label: 'SUPPLEMENTARY', icon: '₹', path: '#' },
      { label: 'MARKS', icon: '👤', path: '#' },
      { label: 'REFUND', icon: '🎓', path: '#' },
      { label: 'COURSE-FEEDBACK', icon: '🎓', path: '#' },
    ]
  }

  const actionTiles = getActionTiles(user?.role)

  function handleTileClick(tile) {
    setActiveTile(tile.label)
    setAnimatingTile(tile.label)

    if (tile.path && tile.path !== '#') {
      setTimeout(() => {
        navigate(tile.path)
      }, 350)
    } else if (onActionClick) {
      onActionClick(tile.label)
    }
  }

  return (
    <div className="space-y-4 mb-6">
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
                <div key={item.id} className="flex items-start gap-2 text-xs text-blue-700 hover:text-blue-900 group cursor-pointer">
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
    </div>
  )
}
