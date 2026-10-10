import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  CAN_APPROVE_EVENT,
  CAN_VIEW_AUDIT_LOGS,
  CAN_APPROVE_TIMETABLE_CHANGE,
  ROLES,
  ROLE_LABELS,
  ROLE_BADGE_COLORS,
} from '../../lib/constants'
import { listNotifications } from '../../lib/dataClient'
import NotificationDrawer from './NotificationDrawer'
import QuickRoleSwitcherModal from './QuickRoleSwitcherModal'

function navFor(role) {
  const nav = [
    { to: '/', label: 'Dashboard', icon: '🏠', end: true },
    { to: '/classrooms', label: 'Classrooms', icon: '🏫' },
    { to: '/academic-scheduling', label: 'Academic Scheduling', icon: '📅' },
    { to: '/events', label: 'Event Venues', icon: '🎤' },
    { to: '/facilities', label: 'Facilities & Labs', icon: '🧪' },
    { to: '/lost-found', label: 'Lost & Found', icon: '🔎' },
  ]
  if (CAN_APPROVE_EVENT.has(role)) {
    nav.push({ to: '/events/approvals', label: 'Venue Approvals', icon: '✅' })
  }
  if (role === ROLES.ADMIN || role === ROLES.RESOURCE_ADMIN || role === ROLES.SYS_ADMIN) {
    nav.push({ to: '/admin', label: 'Admin Dashboard', icon: '📊' })
  }
  if (CAN_VIEW_AUDIT_LOGS.has(role)) {
    nav.push({ to: '/governance', label: 'Audit & Governance', icon: '🛡️' })
  }
  nav.push({ to: '/profile', label: 'My Profile & ID', icon: '👤' })
  return nav
}

function linkClasses({ isActive }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
    isActive
      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const nav = navFor(user?.role)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    listNotifications(user.id).then((items) => {
      setUnreadCount((items || []).filter((n) => !n.isRead).length)
    }).catch(() => {})
  }, [user, isNotifOpen])

  const badgeColor = ROLE_BADGE_COLORS[user?.role] || 'bg-slate-100 text-slate-700'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 text-white font-extrabold shadow-sm text-base">
              CC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-slate-900">
                  CampusConnect
                </span>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full border border-emerald-200 hidden sm:inline-block">
                  Live Pilot
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                Resource Management &amp; Academic Scheduling
              </p>
            </div>
          </div>

          {/* Right Header: Role, Notif Bell, Switcher, Logout */}
          <div className="flex items-center gap-2.5">
            {/* Persona Indicator Link to Profile */}
            <Link
              to="/profile"
              className="hidden sm:flex flex-col items-end mr-1 group cursor-pointer"
              title="View your profile & credentials"
            >
              <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-brand-600 transition-colors">
                {user?.name}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${badgeColor}`}>
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
            </Link>

            {/* Quick Switch Persona Button */}
            <button
              onClick={() => setIsSwitcherOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
              title="Switch demo persona"
            >
              <span>🔄</span>
              <span className="hidden md:inline">Switch Role</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Notifications"
            >
              <span className="text-lg">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-xs animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Sign Out */}
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
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
                <span className="text-[11px] text-brand-600 font-semibold cursor-pointer hover:underline" onClick={() => setIsSwitcherOpen(true)}>
                  Change
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
      <QuickRoleSwitcherModal isOpen={isSwitcherOpen} onClose={() => setIsSwitcherOpen(false)} />
    </div>
  )
}
