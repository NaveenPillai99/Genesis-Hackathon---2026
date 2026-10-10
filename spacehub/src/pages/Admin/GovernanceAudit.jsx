import { useState, useEffect } from 'react'
import { listAuditLogs, getEGovernanceSpec, simulateEGovernanceSync } from '../../lib/dataClient'
import { ROLE_BADGE_COLORS, ROLE_LABELS } from '../../lib/constants'

export default function GovernanceAudit() {
  const [auditLogs, setAuditLogs] = useState([])
  const [spec, setSpec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [logs, sp] = await Promise.all([
        listAuditLogs(),
        getEGovernanceSpec(),
      ])
      setAuditLogs(logs || [])
      setSpec(sp)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSimulateSync() {
    setSyncing(true)
    try {
      const res = await simulateEGovernanceSync()
      setSyncStatus(res)
      loadData()
    } catch (e) {
      alert(e.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const filteredLogs = auditLogs.filter(
    (l) => !filterAction || l.action?.toLowerCase().includes(filterAction.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Audit Trail &amp; E-Governance Integration
        </h1>
        <p className="text-sm text-slate-500">
          Institutional security oversight, immutable action audit logs, and university ERP (AUMS / MyAmrita) integration adapter.
        </p>
      </div>

      {/* E-Governance Adapter Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏛️</span>
              <h2 className="text-lg font-bold text-slate-900">
                University E-Governance &amp; Identity Adapter
              </h2>
              <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                Mock Mode (Demonstration Ready)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Interface contract prepared for Amrita University AUMS &amp; MyAmrita Single Sign-On (SSO).
            </p>
          </div>
          <button
            onClick={handleSimulateSync}
            disabled={syncing}
            className="btn-primary !bg-indigo-600 hover:!bg-indigo-700 text-xs flex items-center gap-2 self-start sm:self-auto"
          >
            <span>🔄</span>
            <span>{syncing ? 'Synchronizing…' : 'Simulate ERP Sync'}</span>
          </button>
        </div>

        {syncStatus && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3.5 text-xs text-indigo-900 flex items-start justify-between">
            <div>
              <p className="font-bold">Sync Result: {syncStatus.status}</p>
              <p className="mt-0.5">{syncStatus.message}</p>
              <p className="text-[11px] text-indigo-600 mt-1">
                Synced {syncStatus.synced_records} synthetic records from {syncStatus.source_identity_provider || 'Mock Gateway'}.
              </p>
            </div>
            <button onClick={() => setSyncStatus(null)} className="text-indigo-400 hover:text-indigo-600 font-bold">✕</button>
          </div>
        )}

        {/* Integration Specs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Auth Protocol</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">OpenID Connect / SAML 2.0</span>
            <span className="text-slate-500 text-[11px] mt-1 block">Token &amp; UserInfo endpoints ready for production cert.</span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Role Mapping Status</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">10 Institutional Roles</span>
            <span className="text-slate-500 text-[11px] mt-1 block">AUMS Student, Faculty &amp; Staff badges mapped to RBAC.</span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Data Protection</span>
            <span className="font-bold text-emerald-700 text-sm mt-0.5 block">DPDP Act, 2023 Compliant</span>
            <span className="text-slate-500 text-[11px] mt-1 block">Zero plain-text credential leaks, masked public roll numbers.</span>
          </div>
        </div>
      </section>

      {/* Append-Only Audit Trail Table */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>🛡️</span>
            <span>Security &amp; Action Audit Trail</span>
            <span className="rounded-full bg-slate-100 text-slate-700 text-xs px-2 py-0.5 font-bold">
              {filteredLogs.length}
            </span>
          </h2>

          {/* Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Filter:</span>
            <input
              type="text"
              placeholder="Search action or entity…"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="input !py-1 !px-2.5 text-xs w-48"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const badge = ROLE_BADGE_COLORS[log.actorRole] || 'bg-slate-100 text-slate-700'
                const dateStr = log.timestamp
                  ? new Date(log.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Just now'

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono">
                      {dateStr}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {log.actorName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge}`}>
                        {ROLE_LABELS[log.actorRole] || log.actorRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {log.entityType}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {log.details || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
