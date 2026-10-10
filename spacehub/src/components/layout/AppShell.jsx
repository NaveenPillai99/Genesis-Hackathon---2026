import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { CAN_APPROVE_EVENT, ROLES, ROLE_LABELS } from '../../lib/constants'

const BASE_NAV = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/classrooms', label: 'Classrooms', icon: '🏫' },
  { to: '/events', label: 'Event Venues', icon: '🎤' },
  { to: '/facilities', label: 'Facilities', icon: '🧪' },
  { to: '/lost-found', label: 'Lost & Found', icon: '🔎' },
]

function navFor(role) {
  const nav = [...BASE_NAV]
  if (CAN_APPROVE_EVENT.has(role)) nav.push({ to: '/events/approvals', label: 'Venue Approvals', icon: '✅' })
  if (role === ROLES.ADMIN) nav.push({ to: '/admin', label: 'Admin Dashboard', icon: '📊' })
  return nav
}

function linkClasses({ isActive }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const nav = navFor(user?.role)

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">SH</span>
            <div>
              <p className="text-sm font-bold leading-none text-slate-900">SpaceHub</p>
              <p className="text-[11px] leading-none text-slate-400">Campus space &amp; facility booking</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-none text-slate-800">{user?.name}</p>
              <p className="text-[11px] leading-none text-slate-400">{ROLE_LABELS[user?.role]}</p>
            </div>
            <button onClick={logout} className="btn-secondary !px-3 !py-1.5 text-xs">
              Switch user
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 md:hidden">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 flex flex-col gap-1">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
