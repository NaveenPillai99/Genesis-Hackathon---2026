import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { listProfiles } from '../../lib/dataClient'
import {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_BADGE_COLORS,
} from '../../lib/constants'
import { Spinner } from '../../components/common/Feedback'

const ROLE_ORDER = [
  ROLES.CAMPUS_DIRECTOR,
  ROLES.DEAN,
  ROLES.HOD,
  ROLES.CLASS_ADVISOR,
  ROLES.FACULTY,
  ROLES.CLASS_REP,
  ROLES.STUDENT,
  ROLES.HPC_FACULTY,
  ROLES.RESOURCE_ADMIN,
  ROLES.LAB_ADMIN,
  ROLES.LAB_ASSISTANT,
  ROLES.LOST_PROPERTY_HANDLER,
  ROLES.SYS_ADMIN,
]

const ROLE_ICON = {
  [ROLES.CAMPUS_DIRECTOR]: '🏛️',
  [ROLES.DEAN]: '🎓',
  [ROLES.HOD]: '🏢',
  [ROLES.STUDENT]: '🎒',
  [ROLES.CLASS_REP]: '🗂️',
  [ROLES.CLASS_ADVISOR]: '🧑‍💼',
  [ROLES.FACULTY]: '🧑‍🏫',
  [ROLES.HPC_FACULTY]: '⚡',
  [ROLES.LAB_ASSISTANT]: '🛠️',
  [ROLES.LAB_ADMIN]: '🔬',
  [ROLES.RESOURCE_ADMIN]: '🗝️',
  [ROLES.LOST_PROPERTY_HANDLER]: '📦',
  [ROLES.SYS_ADMIN]: '🛡️',
}

export default function RoleSelect() {
  const { loginAs, loginWithCredentials } = useAuth()
  const navigate = useNavigate()
  const { data: profiles, loading } = useLiveData(() => listProfiles(), [])
  const [role, setRole] = useState(null)
  const [authMode, setAuthMode] = useState('demo') // 'demo' or 'credentials'

  // Credentials form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [credError, setCredError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  async function pick(profile) {
    await loginAs(profile)
    navigate('/', { replace: true })
  }

  async function handleCredSubmit(e) {
    e.preventDefault()
    setCredError('')
    setLoggingIn(true)
    try {
      await loginWithCredentials(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setCredError(err.message || 'Login failed. Check email and password.')
    } finally {
      setLoggingIn(false)
    }
  }

  const candidates = (profiles ?? []).filter((p) => p.role === role)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 font-sans">
      <div className="w-full max-w-2xl">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-700 to-brand-500 text-xl font-extrabold text-white shadow-md">
            CC
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            CampusConnect
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Unified Campus Resource Management, Academic Scheduling, and Lost &amp; Found Platform
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
            <span>●</span> Hierarchical University Architecture (Director, Dean, HOD, Faculty, Students)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Mode Tabs */}
          <div className="flex gap-2 mb-5 border-b border-slate-100 pb-3 text-xs font-bold">
            <button
              onClick={() => { setAuthMode('demo'); setRole(null); }}
              className={`px-3 py-1.5 rounded-lg transition-colors ${authMode === 'demo'
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              🚀 Instant Persona Switcher (All Roles)
            </button>
            <button
              onClick={() => setAuthMode('credentials')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${authMode === 'credentials'
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              🔒 Email &amp; Password Login
            </button>
          </div>

          {authMode === 'credentials' ? (
            <form onSubmit={handleCredSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500">
                Log in using simulated university credentials (all demo accounts have password: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-brand-700 font-bold">demo123</code>).
              </p>

              {credError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700">
                  {credError}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Institutional Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. devika.rep@cb.students.amrita.edu"
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="demo123"
                  className="input w-full text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="btn-primary w-full py-2.5 text-xs font-bold"
              >
                {loggingIn ? 'Authenticating…' : 'Sign In with Password'}
              </button>
            </form>
          ) : !role ? (
            <>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Select Persona to Evaluate
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {ROLE_ORDER.map((r) => {
                  const badge = ROLE_BADGE_COLORS[r] || 'bg-slate-100'
                  return (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className="flex flex-col items-start gap-1 rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-brand-500 hover:bg-brand-50/40 hover:shadow-xs group"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-2xl">{ROLE_ICON[r]}</span>
                        <span className="text-slate-300 group-hover:text-brand-500 text-xs font-bold">➜</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900 mt-1">
                        {ROLE_LABELS[r]}
                      </span>
                      <span className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                        {ROLE_DESCRIPTIONS[r]}
                      </span>
                    </button>
                  )
                })}
              </div>

            </>
          ) : (
            <>
              <button
                onClick={() => setRole(null)}
                className="mb-3 text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
              >
                ← Back to all 10 roles
              </button>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Select account for: {ROLE_LABELS[role]}
              </p>
              {loading ? (
                <Spinner />
              ) : (
                <div className="grid gap-2">
                  {candidates.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pick(p)}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:border-brand-500 hover:bg-brand-50/50 transition-all"
                    >
                      <div>
                        <span className="block text-sm font-bold text-slate-900">{p.name}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{p.department}</span>
                        <span className="block text-[11px] text-slate-400 font-mono mt-0.5">{p.email}</span>
                      </div>
                      <span className="text-xs font-bold text-brand-700 bg-brand-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
                        Sign In As {p.name.split(' ')[0]} ➜
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Amrita University Pilot Platform • Designed for Integration with AUMS / MyAmrita SSO
        </p>
      </div>
    </div>
  )
}
