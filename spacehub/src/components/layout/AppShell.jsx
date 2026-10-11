import { useState, useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ROLE_LABELS,
  ROLE_BADGE_COLORS,
} from '../../lib/constants'
import { listNotifications } from '../../lib/dataClient'
import NotificationDrawer from './NotificationDrawer'

export default function AppShell() {
  const { user, logout } = useAuth()
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

      {/* Main Portal Header */}
      <header
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          {/* Logo & Platform Title with Home Link */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 group hover:opacity-95 transition-opacity"
              title="Return to Portal Home"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#990033] to-[#be2e4b] text-white font-extrabold shadow-sm text-sm tracking-wider group-hover:scale-105 transition-transform">
                AVV
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-[#990033] transition-colors">
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
            </Link>

            {/* Portal Home quick link */}
            <div className="hidden md:flex items-center ml-2 pl-3 border-l border-slate-200">
              <Link
                to="/"
                className="text-xs font-bold text-slate-700 hover:text-[#990033] px-2.5 py-1 rounded-md hover:bg-rose-50 transition-colors flex items-center gap-1.5"
              >
                <span>🏠</span>
                <span>Portal Home</span>
              </Link>
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
      </header>

      {/* Main Container - Authentic Full-Width Amrita Portal Canvas */}
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 flex-1 pb-16">
        <Outlet />
      </main>

      {/* Modals & Drawers */}
      <NotificationDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  )
}
