import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ROLES,
  ROLE_LABELS,
  ROLE_BADGE_COLORS,
} from '../../lib/constants'
import { listNotifications } from '../../lib/dataClient'
import NotificationDrawer from './NotificationDrawer'

function navFor(role) {
  if (role === ROLES.HPC_FACULTY) {
    return [
      { to: '/', label: 'HPC Cluster Overview', icon: '⚡', end: true },
      { to: '/facilities/hpc', label: 'Nodes & Allocations', icon: '🖥️' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  if (role === ROLES.LAB_ASSISTANT) {
    return [
      { to: '/', label: 'Lab Assistant Desk', icon: '🏠', end: true },
      { to: '/facilities', label: 'Assigned Equipment', icon: '🔧' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  if (role === ROLES.LAB_ADMIN) {
    return [
      { to: '/', label: 'Lab Admin Fleet', icon: '🏠', end: true },
      { to: '/facilities', label: 'Equipment & Roster', icon: '🧪' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  if (role === ROLES.CLASS_ADVISOR) {
    return [
      { to: '/', label: 'Advisor Portal', icon: '🏠', end: true },
      { to: '/academic-scheduling', label: 'Timetable Approvals', icon: '✅' },
      { to: '/lost-found', label: 'Classroom Custody', icon: '📦' },
      { to: '/classrooms', label: 'Classrooms Radar', icon: '🏫' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  if (role === ROLES.CLASS_REP) {
    return [
      { to: '/', label: 'Class Rep Console', icon: '🏠', end: true },
      { to: '/academic-scheduling', label: 'My Class Timetable', icon: '📅' },
      { to: '/classrooms', label: 'Book Class Slot', icon: '🏫' },
      { to: '/events', label: 'Campus Events', icon: '🎤' },
      { to: '/lost-found', label: 'Lost & Found', icon: '🔎' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  if (role === ROLES.FACULTY) {
    return [
      { to: '/', label: 'Faculty Desk', icon: '🏠', end: true },
      { to: '/academic-scheduling', label: 'Teaching Schedule', icon: '📚' },
      { to: '/classrooms', label: 'Classrooms Radar', icon: '🏫' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  if (role === ROLES.RESOURCE_ADMIN || role === ROLES.ADMIN) {
    return [
      { to: '/', label: 'Resource Admin Desk', icon: '🏠', end: true },
      { to: '/events/approvals', label: 'Venue Approvals', icon: '⚖️' },
      { to: '/events', label: 'Event Venues', icon: '🎤' },
      { to: '/classrooms', label: 'Campus Classrooms', icon: '🏫' },
      { to: '/admin', label: 'Campus Analytics', icon: '📊' },
      { to: '/governance', label: 'Audit & Governance', icon: '🛡️' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  if (role === ROLES.LOST_PROPERTY_HANDLER) {
    return [
      { to: '/', label: 'Custody Center', icon: '🏠', end: true },
      { to: '/lost-found', label: 'Custody & Handover', icon: '🎒' },
      { to: '/classrooms', label: 'Campus Blocks', icon: '🏫' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  if (role === ROLES.SYS_ADMIN) {
    return [
      { to: '/', label: 'System Admin Console', icon: '🏠', end: true },
      { to: '/governance', label: 'Security & AUMS ERP', icon: '🛡️' },
      { to: '/admin', label: 'System Health & Metrics', icon: '📊' },
      { to: '/profile', label: 'My Profile & ID', icon: '👤' },
    ]
  }

  // Default: Student
  return [
    { to: '/', label: 'Student Cockpit', icon: '🏠', end: true },
    { to: '/classrooms', label: 'Study Classrooms', icon: '🪑' },
    { to: '/academic-scheduling', label: 'My Timetable', icon: '📅' },
    { to: '/facilities', label: 'Innovation Labs & 3D', icon: '🧪' },
    { to: '/events', label: 'Campus Events', icon: '🎤' },
    { to: '/lost-found', label: 'Lost & Found', icon: '🔎' },
    { to: '/profile', label: 'My Profile & ID', icon: '👤' },
  ]
}

function linkClasses({ isActive }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
    isActive
      ? 'bg-[#990033]/10 text-[#990033] font-bold border-l-4 border-[#990033] shadow-2xs'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const nav = navFor(user?.role)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    listNotifications(user.id).then((items) => {
      setUnreadCount((items || []).filter((n) => !n.isRead).length)
    }).catch(() => {})
  }, [user, isNotifOpen])

  const badgeColor = ROLE_BADGE_COLORS[user?.role] || 'bg-slate-100 text-slate-700'

  return (
    <div className="min-h-screen bg-[#f0f4fa] flex flex-col font-sans">
      {/* Top Amrita Maroon Utility Strip */}
      <div className="bg-[#990033] text-white px-4 py-1 text-[11px] font-medium hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wide">AMRITA VISHWA VIDYAPEETHAM</span>
          <span>•</span>
          <span className="text-white/80">AUMS Integrated Campus Portal</span>
        </div>
        <div className="flex items-center gap-3 text-white/80 text-[10px]">
          <span>Odd Semester 2026-27</span>
          <span>•</span>
          <span className="bg-white/20 px-1.5 py-0.2 rounded font-mono text-white">Live System</span>
        </div>
      </div>

      <header
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#990033] to-[#be2e4b] text-white font-extrabold shadow-sm text-sm tracking-wider">
              AVV
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-slate-900">
                  CampusConnect
                </span>
                <span className="text-[10px] font-semibold bg-[#990033]/10 text-[#990033] px-1.5 py-0.5 rounded-full border border-[#990033]/20 hidden sm:inline-block">
                  AUMS Portal
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                Resource Management &amp; Academic Scheduling
              </p>
            </div>
          </div>

          {/* Right Header: Role, Notif Bell, Logout */}
          <div className="flex items-center gap-2.5">
            {/* Persona Indicator Link to Profile */}
            <Link
              to="/profile"
              className="hidden sm:flex flex-col items-end mr-1 group cursor-pointer"
              title="View your profile & credentials"
            >
              <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-[#990033] transition-colors">
                {user?.name}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${badgeColor}`}>
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
            </Link>

            {/* Notification Bell */}
            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Notifications"
            >
              <span className="text-lg">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#990033] px-1 text-[10px] font-black text-white shadow-xs animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Sign Out */}
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-slate-400 hover:text-[#990033] hover:bg-rose-50 text-xs font-semibold transition-colors"
              title="Sign Out"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Navigation */}
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 md:hidden scrollbar-none">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main Container with Sidebar */}
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 flex-1">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-20 flex flex-col gap-4">
            <nav className="flex flex-col gap-1 rounded-2xl bg-white p-2 border border-slate-200/80 shadow-2xs">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Navigation
              </div>
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Active User Card in Sidebar */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Signed-in Account
              </div>
              <div className="font-bold text-slate-900">{user?.name}</div>
              <div className="text-slate-500 text-[11px] mt-0.5 truncate">{user?.email}</div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                  {ROLE_LABELS[user?.role]}
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                  Active Session
                </span>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-12">
          <Outlet />
        </main>
      </div>

      {/* Modals & Drawers */}
      <NotificationDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  )
}
