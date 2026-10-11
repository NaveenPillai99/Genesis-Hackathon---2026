import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import {
  decideHpcAllocation,
  listHpcAllocations,
  listProfiles,
  requestHpcAllocation,
  HPC_THRESHOLD,
} from '../../lib/dataClient'
import { CAN_APPROVE_HPC, ROLES } from '../../lib/constants'
import Badge from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import { ErrorNote } from '../../components/common/Feedback'

const STATUS_TONE = { pending: 'amber', approved: 'green', declined: 'red' }

export default function HPCAllocation() {
  const { user } = useAuth()
  const { data: profiles } = useLiveData(() => listProfiles(), [])
  const { data: myRequests } = useLiveData(() => listHpcAllocations({ studentId: user.id }), [user.id])
  const { data: toApprove } = useLiveData(
    () => (CAN_APPROVE_HPC.has(user.role) ? listHpcAllocations({ status: 'pending' }) : Promise.resolve([])),
    [user.role]
  )

  const faculty = (profiles ?? []).filter((p) => p.role === ROLES.FACULTY)
  const nameOf = (id) => profiles?.find((p) => p.id === id)?.name ?? id

  const relevantToApprove = (toApprove ?? []).filter((a) => user.role === ROLES.ADMIN || a.facultyApproverId === user.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">HPC Cluster — compute time</h1>
        <p className="text-sm text-slate-500">
          Allocated as node-hours, not physical slots. Requests up to {HPC_THRESHOLD} node-hours are approved instantly; larger jobs
          need your faculty supervisor's sign-off.
        </p>
      </div>

      <RequestForm facultyOptions={faculty} />

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-800">Your requests</h2>
        {!myRequests || myRequests.length === 0 ? (
          <EmptyState icon="🖥️" title="No requests yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {myRequests.map((r) => (
              <div key={r.id} className="card flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">{r.nodeHoursRequested ?? r.node_hours_requested} node-hours</p>
                  <p className="text-xs text-slate-500">{r.purpose}</p>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}{r.autoApproved && ' · auto'}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {CAN_APPROVE_HPC.has(user.role) && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-800">Pending approvals from your students</h2>
          {relevantToApprove.length === 0 ? (
            <EmptyState icon="✅" title="Nothing waiting on you" />
          ) : (
            <div className="flex flex-col gap-2">
              {relevantToApprove.map((r) => (
                <ApprovalRow key={r.id} request={r} studentName={nameOf(r.studentId)} byUserId={user.id} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function RequestForm({ facultyOptions }) {
  const { user } = useAuth()
  const [nodeHours, setNodeHours] = useState(5)
  const [purpose, setPurpose] = useState('')
  const [approver, setApprover] = useState(facultyOptions[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const isLarge = Number(nodeHours) > HPC_THRESHOLD

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const result = await requestHpcAllocation({
        studentId: user.id,
        facultyApproverId: isLarge ? approver : null,
        nodeHoursRequested: Number(nodeHours),
        purpose,
      })
      setDone(result)
      setPurpose('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-5">
      <p className="label">Request an allocation</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Node-hours</label>
          <input required type="number" min={1} className="input" value={nodeHours} onChange={(e) => setNodeHours(e.target.value)} />
        </div>
        <div>
          <label className="label">Purpose</label>
          <input required className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Thesis model training" />
        </div>
      </div>
      {isLarge && (
        <div>
          <label className="label">Faculty supervisor (required over {HPC_THRESHOLD} node-hours)</label>
          <select required className="input" value={approver} onChange={(e) => setApprover(e.target.value)}>
            <option value="">Choose…</option>
            {facultyOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <ErrorNote error={error} />
      {done && (
        <p className="text-xs font-semibold text-emerald-700">
          {done.autoApproved ? '✓ Approved instantly.' : '✓ Sent to your supervisor for approval.'}
        </p>
      )}
      <button className="btn-primary" disabled={busy} type="submit">
        {busy ? 'Submitting…' : 'Request allocation'}
      </button>
    </form>
  )
}

function ApprovalRow({ request, studentName, byUserId }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function decide(decision) {
    setBusy(true)
    setError(null)
    try {
      await decideHpcAllocation(request.id, { decision, byUserId })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {studentName} · {request.nodeHoursRequested ?? request.node_hours_requested} node-hours
          </p>
          <p className="text-xs text-slate-500">{request.purpose}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => decide('approved')}>
            Approve
          </button>
          <button className="btn-danger !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => decide('declined')}>
            Decline
          </button>
        </div>
      </div>
      <ErrorNote error={error} />
    </div>
  )
}
