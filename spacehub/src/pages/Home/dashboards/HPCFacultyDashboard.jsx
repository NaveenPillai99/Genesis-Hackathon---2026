import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  getHpcOverview,
  listHpcNodes,
  updateHpcNodeStatus,
  listHpcJobs,
  listHpcIncidents,
  createHpcIncident,
} from '../../../lib/dataClient'
import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function HPCFacultyDashboard({ user }) {
  const [overview, setOverview] = useState(null)
  const [nodes, setNodes] = useState([])
  const [jobs, setJobs] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  // Node status modal
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodeStatusForm, setNodeStatusForm] = useState({ status: 'idle', notes: '' })

  // New Incident modal
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    nodeId: 'node-gpu-01',
    incidentType: 'operational_fault',
    severity: 'warning',
    description: '',
  })

  // Synthetic utilization historical data (labeled clearly)
  const telemetryHistory = [
    { time: '00:00', cpu: 42, gpu: 35, memory: 48 },
    { time: '04:00', cpu: 38, gpu: 28, memory: 46 },
    { time: '08:00', cpu: 65, gpu: 58, memory: 54 },
    { time: '11:00', cpu: 82, gpu: 76, memory: 68 },
    { time: '14:00', cpu: 78, gpu: 84, memory: 65 },
    { time: '17:00', cpu: 72, gpu: 69, memory: 62 },
    { time: '20:00', cpu: 55, gpu: 48, memory: 55 },
    { time: 'Now', cpu: 60, gpu: 49, memory: 53 },
  ]

  async function loadData() {
    setLoading(true)
    try {
      const [ov, nds, jbs, incs] = await Promise.all([
        getHpcOverview().catch(() => null),
        listHpcNodes().catch(() => []),
        listHpcJobs().catch(() => []),
        listHpcIncidents().catch(() => []),
      ])
      setOverview(ov)
      setNodes(nds || [])
      setJobs(jbs || [])
      setIncidents(incs || [])
    } catch (err) {
      console.error('Failed to load HPC cluster telemetry', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function flash(msg) {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(''), 4000)
  }

  async function handleStatusUpdate(e) {
    e.preventDefault()
    if (!selectedNode) return
    try {
      await updateHpcNodeStatus(selectedNode.id, nodeStatusForm)
      flash(`Node ${selectedNode.name} status updated to ${nodeStatusForm.status.toUpperCase()}!`)
      setSelectedNode(null)
      loadData()
    } catch (err) {
      alert(`Error updating node status: ${err.message}`)
    }
  }

  async function handleIncidentSubmit(e) {
    e.preventDefault()
    try {
      await createHpcIncident({
        ...incidentForm,
        reportedBy: user?.name || 'Dr Radhika N',
      })
      flash(`Operational incident logged successfully with ticket ID!`)
      setShowIncidentModal(false)
      setIncidentForm({
        nodeId: 'node-gpu-01',
        incidentType: 'operational_fault',
        severity: 'warning',
        description: '',
      })
      loadData()
    } catch (err) {
      alert(`Error logging incident: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Flash message */}
      {flashMsg && (
        <div className="rounded-xl bg-violet-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⚡</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-violet-200">✕</button>
        </div>
      )}

      {/* Official Amrita College Portal Hero & Action Tiles */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'hpc-alt-1',
            title: 'Cluster Status: 3 nodes online, node-cpu-02 in maintenance for ECC RAM burn-in',
            link: '#',
          },
        ]}
      />

        {/* Notice of Synthetic Telemetry */}
        <div className="mt-4 pt-3 border-t border-violet-800/30 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
          <span>ℹ️</span>
          <span className="font-semibold uppercase tracking-wider">Demonstration Data Notice:</span>
          <span className="text-amber-800">
            Cluster metrics, node states, and utilization are synthetic telemetry for demonstration and hackathon evaluation. Real Prometheus/SLURM collectors integrate seamlessly via REST API.
          </span>
        </div>

      {/* KPI Overview Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Nodes</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{overview?.total_nodes || nodes.length} Nodes</div>
          <span className="text-[11px] text-violet-700 font-semibold mt-0.5 block">cce-hpc-cluster</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Working / Online</span>
          <div className="text-2xl font-black text-emerald-950 mt-1">{overview?.working_nodes || 3} Nodes</div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-0.5 block">Healthy hardware</span>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Busy (Executing)</span>
          <div className="text-2xl font-black text-blue-950 mt-1">{overview?.busy_nodes || 2} Nodes</div>
          <span className="text-[11px] text-blue-700 font-semibold mt-0.5 block">Deep learning jobs</span>
        </div>

        <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">Idle / Available</span>
          <div className="text-2xl font-black text-teal-950 mt-1">{overview?.idle_nodes || 1} Nodes</div>
          <span className="text-[11px] text-teal-700 font-semibold mt-0.5 block">Ready for scheduler</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Maintenance</span>
          <div className="text-2xl font-black text-amber-950 mt-1">{overview?.maintenance_nodes || 1} Nodes</div>
          <span className="text-[11px] text-amber-700 font-semibold mt-0.5 block">ECC RAM replace</span>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider block">Available Capacity</span>
          <div className="text-2xl font-black text-violet-950 mt-1">25.0%</div>
          <span className="text-[11px] text-violet-700 font-semibold mt-0.5 block">1 node available</span>
        </div>
      </section>

      {/* Utilization & Synthetic Telemetry Graphs */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-sm">Cluster Utilization Telemetry (24-Hour Trend)</h3>
                <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5">Synthetic</span>
              </div>
              <p className="text-xs text-slate-500">Live CPU, GPU &amp; Memory consumption across active partitions.</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-violet-600">● GPU ({overview?.gpu_utilization_pct || 48.7}%)</span>
              <span className="flex items-center gap-1 text-blue-600">● CPU ({overview?.cpu_utilization_pct || 60.3}%)</span>
              <span className="flex items-center gap-1 text-emerald-600">● Memory ({overview?.memory_utilization_pct || 52.6}%)</span>
            </div>
          </div>

          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryHistory}>
                <defs>
                  <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="gpu" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#gpuGrad)" name="GPU Load %" />
                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#cpuGrad)" name="CPU Load %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Node-Hour Usage & Quota Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">Compute Allocation Quotas</h3>
              <span className="text-xs font-mono font-bold text-violet-700">FY 2026</span>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Cumulative Node-Hours Served</span>
                  <span className="font-mono text-slate-900">{overview?.node_hours_consumed || 14040.0} hrs</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className="bg-violet-600 h-2.5 rounded-full" style={{ width: '70%' }}></div>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Cap: 20,000 node-hours for Spring 2026 semester</span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Student B.Tech / M.Sc Thesis Pool</span>
                  <span className="font-mono text-slate-900">450 / 1000 hrs</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Self-service cap: 24 GPU hrs per student project</span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Faculty Sponsored Projects</span>
                  <span className="font-mono text-slate-900">1,820 / 3,000 hrs</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '60%' }}></div>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Priority partition with preemption protection</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Scheduler: <strong>SLURM 23.02</strong></span>
            <span className="text-emerald-700 font-bold">Fairshare: Active</span>
          </div>
        </div>
      </section>

      {/* Compute Node Inventory & Health Controls */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">HPC Node Fleet &amp; Hardware Health</h3>
            <p className="text-xs text-slate-500">Live compute nodes, core allocations, GPU accelerators, and status control.</p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
            {nodes.length} Nodes Registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-3">Node Identifier</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Specs (CPU / RAM / GPU)</th>
                <th className="py-2.5 px-3">Live Utilization</th>
                <th className="py-2.5 px-3">Active Jobs</th>
                <th className="py-2.5 px-3">Notes &amp; Diagnostic</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nodes.map((node) => {
                const statusColor =
                  node.status === 'busy'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : node.status === 'idle'
                    ? 'bg-teal-100 text-teal-800 border-teal-200'
                    : node.status === 'maintenance'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-red-100 text-red-800 border-red-200'

                return (
                  <tr key={node.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      <div>{node.name}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{node.id}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${statusColor}`}>
                        {node.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">
                        {node.cpuCores} Cores · {node.memoryGb} GB RAM
                      </div>
                      <div className="text-[11px] text-violet-700 font-semibold">
                        {node.gpuCount > 0 ? `${node.gpuCount}x ${node.gpuModel}` : 'CPU Compute Only'}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div>CPU: <strong className="text-slate-800">{node.cpuUtilizationPct || 0}%</strong></div>
                      <div>RAM: <strong className="text-slate-800">{node.memoryUtilizationPct || 0}%</strong></div>
                      {node.gpuCount > 0 && (
                        <div>GPU: <strong className="text-violet-700">{node.gpuUtilizationPct || 0}%</strong></div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900">{node.activeJobs || 0} active</span>
                      {node.queuedJobs > 0 && (
                        <span className="text-[10px] text-slate-400 block">({node.queuedJobs} queued)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-500 max-w-xs truncate" title={node.notes}>
                      {node.notes || 'Normal operation'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedNode(node)
                          setNodeStatusForm({ status: node.status, notes: node.notes || '' })
                        }}
                        className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 text-[11px] font-bold shadow-2xs"
                      >
                        Set State
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active Jobs & Operational Incident Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs / Queue */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏃</span>
              <h3 className="font-extrabold text-slate-900 text-sm">Active Supercomputing Workloads</h3>
            </div>
            <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200">
              {jobs.length} Active Jobs
            </span>
          </div>

          <div className="space-y-3">
            {jobs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No jobs currently executing.</div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/70 text-xs space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900">{job.jobName}</h4>
                      <p className="text-[11px] text-slate-500">
                        Submitter: <strong className="text-slate-700">{job.userName}</strong> · Node: {job.nodeId}
                      </p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 uppercase">
                      {job.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                    <span>Allocated: {job.gpuRequested} GPUs, {job.requestedNodes} Node</span>
                    <span>Used: {job.cpuHoursUsed} hrs</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Operational Fault & Incident Records */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛠️</span>
              <h3 className="font-extrabold text-slate-900 text-sm">Fault &amp; Incident Records</h3>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              {incidents.length} Records
            </span>
          </div>

          <div className="space-y-3">
            {incidents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No active incidents or faults logged.</div>
            ) : (
              incidents.map((inc) => (
                <div key={inc.id} className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-amber-900 uppercase bg-amber-200/60 px-1.5 py-0.5 rounded mr-1.5">
                        {inc.incidentType}
                      </span>
                      <strong className="text-slate-900">Target Node: {inc.nodeId}</strong>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      By {inc.reportedBy}
                    </span>
                  </div>
                  <p className="text-slate-700 text-[11px]">{inc.description}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Modal: Change Node State */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Update Compute Node State</h3>
                <p className="text-xs text-slate-500">Node: {selectedNode.name} ({selectedNode.id})</p>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleStatusUpdate} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Operational State</label>
                <select
                  value={nodeStatusForm.status}
                  onChange={(e) => setNodeStatusForm({ ...nodeStatusForm, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-violet-500"
                >
                  <option value="idle">IDLE — Available for batch allocations</option>
                  <option value="busy">BUSY — Actively executing jobs</option>
                  <option value="maintenance">MAINTENANCE — Drained for servicing / diagnostics</option>
                  <option value="offline">OFFLINE — Powered down or hardware fault</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Operational Notes &amp; Diagnostics</label>
                <textarea
                  rows={3}
                  value={nodeStatusForm.notes}
                  onChange={(e) => setNodeStatusForm({ ...nodeStatusForm, notes: e.target.value })}
                  placeholder="e.g., Routine reboot post NVIDIA driver update..."
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-2xs"
                >
                  Confirm State Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Incident */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Record Operational Incident</h3>
                <p className="text-xs text-slate-500">Log hardware faults, ECC failures, or cooling alerts.</p>
              </div>
              <button onClick={() => setShowIncidentModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleIncidentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Impacted Node</label>
                <select
                  value={incidentForm.nodeId}
                  onChange={(e) => setIncidentForm({ ...incidentForm, nodeId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-violet-500"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name} ({n.id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Incident Type</label>
                  <select
                    value={incidentForm.incidentType}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incidentType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="operational_fault">Hardware Fault</option>
                    <option value="scheduled_maintenance">Maintenance Window</option>
                    <option value="thermal_alert">Thermal / Fan Alert</option>
                    <option value="network_infiniband">InfiniBand Disconnect</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Severity</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description &amp; Action Taken</label>
                <textarea
                  rows={3}
                  required
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  placeholder="Detail symptoms, affected partitions, or technician dispatch..."
                  className="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-2xs"
                >
                  Submit Incident Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
