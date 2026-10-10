import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { listProfiles, backendMode } from '../../lib/dataClient'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../lib/constants'
import { Spinner } from '../../components/common/Feedback'

const ROLE_ORDER = [ROLES.STUDENT, ROLES.CLASS_REP, ROLES.FACULTY, ROLES.FACILITY_INCHARGE, ROLES.ADMIN]
const ROLE_ICON = {
  [ROLES.STUDENT]: '🎓',
  [ROLES.CLASS_REP]: '🗂️',
  [ROLES.FACULTY]: '🧑‍🏫',
  [ROLES.FACILITY_INCHARGE]: '🛠️',
  [ROLES.ADMIN]: '🗝️',
}

export default function RoleSelect() {
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const { data: profiles, loading } = useLiveData(() => listProfiles(), [])
  const [role, setRole] = useState(null)

  function pick(profile) {
    loginAs(profile)
    navigate('/', { replace: true })
  }

  const candidates = (profiles ?? []).filter((p) => p.role === role)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            SH
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">Welcome to SpaceHub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Classrooms, event venues, innovation facilities and lost &amp; found — one campus booking portal.
          </p>
          {backendMode === 'mock' && (
            <p className="mx-auto mt-3 max-w-sm rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
              Running in pilot/demo mode — data is stored in this browser only. Connect Supabase (see .env.example) for a shared,
              multi-user deployment.
            </p>
          )}
        </div>

        <div className="card p-5">
          {!role ? (
            <>
              <p className="label mb-3">Who are you signing in as?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLE_ORDER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className="flex flex-col items-start gap-1 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50"
                  >
                    <span className="text-2xl">{ROLE_ICON[r]}</span>
                    <span className="text-sm font-bold text-slate-800">{ROLE_LABELS[r]}</span>
                    <span className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[r]}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setRole(null)} className="mb-3 text-xs font-semibold text-brand-600 hover:underline">
                ← Choose a different role
              </button>
              <p className="label mb-3">
                Pick a demo {ROLE_LABELS[role].toLowerCase()} account
              </p>
              {loading ? (
                <Spinner />
              ) : (
                <div className="flex flex-col gap-2">
                  {candidates.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pick(p)}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-brand-400 hover:bg-brand-50"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{p.name}</span>
                        <span className="block text-xs text-slate-500">{p.department}</span>
                      </span>
                      <span className="text-slate-300">→</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Production builds reuse the existing Amrita login instead of this screen.
        </p>
      </div>
    </div>
  )
}
