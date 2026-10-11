import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listProfiles } from '../../lib/dataClient'
import { ROLE_LABELS, ROLE_BADGE_COLORS, ROLE_DESCRIPTIONS } from '../../lib/constants'

export default function QuickRoleSwitcherModal({ isOpen, onClose }) {
  const { user, loginAs } = useAuth()
  const [profiles, setProfiles] = useState([])

  useEffect(() => {
    listProfiles().then((p) => setProfiles(p || []))
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Switch Demonstration Role</h3>
            <p className="text-xs text-slate-500">
              Instantly evaluate CampusConnect from the perspective of any authorized campus persona.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg p-1">
            ✕
          </button>
        </div>

        <div className="grid gap-2.5 py-4 max-h-[60vh] overflow-y-auto">
          {profiles.map((p) => {
            const isCurrent = user?.id === p.id
            const colorClass = ROLE_BADGE_COLORS[p.role] || 'bg-slate-100 text-slate-700'
            return (
              <button
                key={p.id}
                onClick={() => {
                  loginAs(p)
                  onClose()
                }}
                className={`flex items-start justify-between rounded-xl border p-3.5 text-left transition-all ${
                  isCurrent
                    ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-400/30'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{p.name}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                      {ROLE_LABELS[p.role] || p.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{p.department || p.email}</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {ROLE_DESCRIPTIONS[p.role]}
                  </p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 text-brand-600 font-bold text-xs bg-brand-100 px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
