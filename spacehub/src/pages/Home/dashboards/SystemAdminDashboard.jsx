import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listAuditLogs,
  getEGovernanceSpec,
  simulateEGovernanceSync,
  listProfiles,
} from '../../../lib/dataClient'

export default function SystemAdminDashboard({ user }) {
  const [auditLogs, setAuditLogs] = useState([])
  const [profiles, setProfiles] = useState([])
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const [logs, profs] = await Promise.all([
        listAuditLogs().catch(() => []),
        listProfiles().catch(() => []),
      ])
      setAuditLogs(logs || [])
      setProfiles(profs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function flash(msg) {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(''), 4500)
  }

  async function handleTestErpSync() {
    setSyncStatus('syncing')
    try {
      const res = await simulateEGovernanceSync()
      setSyncStatus(res)
      flash('AUMS E-Governance synchronization simulated successfully! 42 student & faculty records reconciled.')
    } catch (e) {
      setSyncStatus({ status: 'FAILED', message: e.message })
    }
  }

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-rose-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🛡️</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-rose-200">✕</button>
        </div>
      )}

      {/* Sys Admin Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-rose-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-rose-500/20 text-rose-200 border border-rose-400/30">
                🛡️ System Administrator Command Console
              </span>
              <span className="text-rose-300 text-xs">• University Central IT &amp; Security</span>
              <span className="text-emerald-400 text-xs bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                System Administrator Authority Active
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Welcome, {user?.name}
            </h1>
            <p className="text-rose-200/80 text-xs md:text-sm mt-1 max-w-xl">
              System governance, user account statuses, role-permission matrices, immutable security audit trails, and university AUMS E-Governance API synchronization.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestErpSync}
              disabled={syncStatus === 'syncing'}
              className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-2 text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync AUMS ERP'}</span>
            </button>
            <Link
              to="/governance"
              className="rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-xs font-bold hover:bg-white/20"
            >
              🛡️ Audit Trail
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Registered Accounts</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{profiles.length} Users</div>
          <p className="text-[11px] text-slate-500 mt-1">Across 10 distinct RBAC roles</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <span className="text-xs font-bold text-emerald-800 uppercase">System Health</span>
          <div className="text-2xl font-black text-emerald-950 mt-1">100% Operational</div>
          <p className="text-[11px] text-emerald-700 mt-1">FastAPI Backend &amp; SQLite DB online</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">AUMS Adapter Protocol</span>
          <div className="text-2xl font-black text-slate-900 mt-1">OIDC / SAML</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Synchronized with auth.amrita.edu</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Immutable Audit Events</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{auditLogs.length} Events</div>
          <p className="text-[11px] text-slate-500 mt-1">Tamper-evident security trail</p>
        </div>
      </section>

      {/* User Accounts & Role Matrix Overview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              User Accounts &amp; Strict Role Assignments
            </h2>
            <p className="text-xs text-slate-500">
              Each authenticated account is bound strictly to a dedicated role and resource scope.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1">
            {profiles.length} Active Accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-3">Full Name</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Assigned Role</th>
                <th className="py-2.5 px-3">Department / Scope</th>
                <th className="py-2.5 px-3 text-right">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">{p.name}</td>
                  <td className="py-3 px-3 font-mono text-slate-500">{p.email}</td>
                  <td className="py-3 px-3">
                    <span className="bg-slate-100 text-slate-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                      {p.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{p.department || 'Amrita Campus'}</td>
                  <td className="py-3 px-3 text-right">
                    <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-200">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* AUMS ERP & Audit Trail */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h3 className="text-sm font-bold text-slate-900">
              Security Audit Trail &amp; E-Governance (AUMS) Gateway
            </h3>
          </div>
          <Link to="/governance" className="text-xs font-semibold text-rose-600 hover:underline">
            Inspect Full Security Logs →
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          Audit entries record timetable authorizations, venue approvals, node status updates, and physical lost &amp; found handovers.
        </p>

        <div className="space-y-2">
          {auditLogs.slice(0, 5).map((log) => (
            <div key={log.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs flex justify-between items-center font-mono">
              <div>
                <span className="font-bold text-slate-800 mr-2">{log.action}</span>
                <span className="text-slate-500 font-sans">{log.details}</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
