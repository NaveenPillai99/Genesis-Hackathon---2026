import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  CAN_REQUEST_TIMETABLE_CHANGE,
  CAN_APPROVE_TIMETABLE_CHANGE,
  DAY_SLOTS,
  WEEKDAYS,
  ROLES,
} from '../../lib/constants'
import {
  listTimetableSlots,
  listChangeRequests,
  proposeChangeRequest,
  reviewChangeRequest,
  listRooms,
} from '../../lib/dataClient'

export default function AcademicScheduling() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [timetable, setTimetable] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState('Monday')

  // Propose form state
  const [formData, setFormData] = useState({
    courseCode: '22CSC401',
    courseName: 'Deep Learning',
    classSection: 'Int. M.Sc Data Science, VII B',
    originalDay: 'Friday',
    originalSlot: 'slot2',
    originalRoomId: 'room-ab1-e104',
    proposedDay: 'Thursday',
    proposedSlot: 'slot4',
    proposedRoomId: 'room-ab1-e104',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Review modal/dialog state
  const [reviewModal, setReviewModal] = useState({ isOpen: false, reqId: null, decision: '', notes: '' })

  const canRequest = CAN_REQUEST_TIMETABLE_CHANGE.has(user?.role)
  const canApprove = CAN_APPROVE_TIMETABLE_CHANGE.has(user?.role)

  async function loadData() {
    setLoading(true)
    try {
      const [reqs, tt, rms] = await Promise.all([
        listChangeRequests(),
        listTimetableSlots(),
        listRooms(),
      ])
      setRequests(reqs || [])
      setTimetable(tt || [])
      setRooms((rms || []).filter((r) => r.type === 'classroom'))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleProposeSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    // Basic client validation
    if (!formData.reason.trim()) {
      setErrorMsg('Please enter an academic or logistical reason for this reschedule proposal.')
      setSubmitting(false)
      return
    }

    // Check clash
    const clash = timetable.find(
      (s) =>
        s.day === formData.proposedDay &&
        s.slotId === formData.proposedSlot &&
        s.roomId === formData.proposedRoomId
    )
    if (clash) {
      setErrorMsg(`Collision Detected: Target room is already occupied by ${clash.courseName || clash.code} on ${formData.proposedDay} ${formData.proposedSlot}.`)
      setSubmitting(false)
      return
    }

    try {
      await proposeChangeRequest({
        ...formData,
        requesterId: user.id,
        requesterName: user.name,
      })
      setSuccessMsg('Proposal submitted successfully! Class Advisor and Course Faculty have been notified.')
      setIsModalOpen(false)
      loadData()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit proposal.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReviewSubmit() {
    if (!reviewModal.reqId || !reviewModal.decision) return
    try {
      await reviewChangeRequest(reviewModal.reqId, {
        decision: reviewModal.decision,
        reviewNotes: reviewModal.notes,
        approverName: user.name,
        approverId: user.id,
      })
      setReviewModal({ isOpen: false, reqId: null, decision: '', notes: '' })
      loadData()
    } catch (err) {
      alert(err.message || 'Review submission failed')
    }
  }

  const filteredTimetable = timetable.filter((t) => t.day === selectedDay)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Academic Scheduling &amp; Class Rescheduling
          </h1>
          <p className="text-sm text-slate-500">
            Official class prepone/postpone proposal and approval workflow for Class Reps, Faculty, and Class Advisors.
          </p>
        </div>
        {canRequest && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2 self-start shadow-sm"
          >
            <span>📝</span>
            <span>Propose Class Reschedule</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 font-bold">✕</button>
        </div>
      )}

      {/* Grid: Pending Proposals & Review Queue */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>📋</span>
            <span>Reschedule Proposals &amp; Approval Queue</span>
            <span className="rounded-full bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 font-bold">
              {requests.length}
            </span>
          </h2>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
            <span className="text-3xl block mb-2">🎉</span>
            No pending class change requests at this moment.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {requests.map((req) => {
              const isPending = req.status === 'pending'
              const statusColors = {
                pending: 'bg-amber-50 text-amber-800 border-amber-200',
                approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                rejected: 'bg-rose-50 text-rose-800 border-rose-200',
                modification_requested: 'bg-purple-50 text-purple-800 border-purple-200',
              }[req.status] || 'bg-slate-100 text-slate-700'

              return (
                <div
                  key={req.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-brand-600">{req.courseCode}</span>
                        <h3 className="font-bold text-slate-900 text-base">{req.courseName}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{req.classSection}</p>
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColors}`}>
                        {req.status?.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Original vs Proposed Schedule */}
                    <div className="my-3.5 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-400 block text-[10px] uppercase">
                          Current Schedule
                        </span>
                        <span className="font-bold text-slate-800 block mt-0.5">
                          {req.originalDay} • {req.originalSlot?.toUpperCase()}
                        </span>
                        <span className="text-slate-500 text-[11px]">{req.originalRoomId}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-brand-600 block text-[10px] uppercase">
                          Proposed Change ➜
                        </span>
                        <span className="font-bold text-brand-900 block mt-0.5">
                          {req.proposedDay} • {req.proposedSlot?.toUpperCase()}
                        </span>
                        <span className="text-brand-700 text-[11px] font-medium">{req.proposedRoomId}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-700">Reason:</span> {req.reason}
                    </div>

                    <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span>Requester: <strong className="text-slate-600">{req.requesterName}</strong></span>
                      {req.approverName && (
                        <span>Decided by: <strong className="text-slate-600">{req.approverName}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Approver Action Buttons */}
                  {isPending && canApprove && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                      <button
                        onClick={() =>
                          setReviewModal({ isOpen: true, reqId: req.id, decision: 'approved', notes: '' })
                        }
                        className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !py-1.5 !px-3 text-xs flex-1"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() =>
                          setReviewModal({ isOpen: true, reqId: req.id, decision: 'modification_requested', notes: '' })
                        }
                        className="btn-secondary !py-1.5 !px-3 text-xs"
                      >
                        Request Changes
                      </button>
                      <button
                        onClick={() =>
                          setReviewModal({ isOpen: true, reqId: req.id, decision: 'rejected', notes: '' })
                        }
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Official Timetable Grid Section */}
      <section className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>📅</span>
              <span>Official Department Timetable</span>
            </h2>
            <p className="text-xs text-slate-500">
              Live schedule reference for Int. M.Sc Data Science VII B and CSE classes.
            </p>
          </div>
          {/* Weekday Switcher Tabs */}
          <div className="flex gap-1 bg-slate-200/80 p-1 rounded-xl self-start">
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  selectedDay === day ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Timetable Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Slot / Time</th>
                <th className="px-4 py-3">Course Code</th>
                <th className="px-4 py-3">Course Name</th>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DAY_SLOTS.filter((s) => !s.nonBookable).map((slot) => {
                const match = filteredTimetable.find((t) => t.slotId === slot.id)
                return (
                  <tr key={slot.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      <span>{slot.label}</span>
                      <span className="block text-[11px] text-slate-400 font-normal">
                        {slot.start} – {slot.end}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {match ? (
                        <span className="font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 text-xs">
                          {match.code || 'RESERVED'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Available Free Slot</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {match ? match.courseName : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {match ? match.faculty || 'Assigned Faculty' : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {match ? match.roomId : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Propose Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Propose Class Reschedule</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {errorMsg && (
              <div className="my-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleProposeSubmit} className="space-y-4 pt-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Course Code</label>
                  <select
                    value={formData.courseCode}
                    onChange={(e) => {
                      const names = {
                        '22CSC401': 'Deep Learning',
                        '22CSC553': 'Cloud Computing',
                        '22CSC404': 'Data Security',
                        '22CSC343': 'Business Analytics',
                      }
                      setFormData({
                        ...formData,
                        courseCode: e.target.value,
                        courseName: names[e.target.value] || 'Course',
                      })
                    }}
                    className="input w-full"
                  >
                    <option value="22CSC401">22CSC401 — Deep Learning</option>
                    <option value="22CSC553">22CSC553 — Cloud Computing</option>
                    <option value="22CSC404">22CSC404 — Data Security</option>
                    <option value="22CSC343">22CSC343 — Business Analytics</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Class Section</label>
                  <input
                    type="text"
                    value={formData.classSection}
                    onChange={(e) => setFormData({ ...formData, classSection: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Original Schedule */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                  Current Scheduled Time
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-500 block mb-0.5">Day</label>
                    <select
                      value={formData.originalDay}
                      onChange={(e) => setFormData({ ...formData, originalDay: e.target.value })}
                      className="input w-full text-xs"
                    >
                      {WEEKDAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">Slot</label>
                    <select
                      value={formData.originalSlot}
                      onChange={(e) => setFormData({ ...formData, originalSlot: e.target.value })}
                      className="input w-full text-xs"
                    >
                      {DAY_SLOTS.filter((s) => !s.nonBookable).map((s) => (
                        <option key={s.id} value={s.id}>{s.label} ({s.start})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">Room</label>
                    <select
                      value={formData.originalRoomId}
                      onChange={(e) => setFormData({ ...formData, originalRoomId: e.target.value })}
                      className="input w-full text-xs"
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Proposed Schedule */}
              <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-200 space-y-2">
                <span className="font-bold text-brand-900 block text-[11px] uppercase tracking-wide">
                  Proposed New Schedule
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-brand-800 block mb-0.5">New Day</label>
                    <select
                      value={formData.proposedDay}
                      onChange={(e) => setFormData({ ...formData, proposedDay: e.target.value })}
                      className="input w-full text-xs"
                    >
                      {WEEKDAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-brand-800 block mb-0.5">New Slot</label>
                    <select
                      value={formData.proposedSlot}
                      onChange={(e) => setFormData({ ...formData, proposedSlot: e.target.value })}
                      className="input w-full text-xs"
                    >
                      {DAY_SLOTS.filter((s) => !s.nonBookable).map((s) => (
                        <option key={s.id} value={s.id}>{s.label} ({s.start})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-brand-800 block mb-0.5">New Room</label>
                    <select
                      value={formData.proposedRoomId}
                      onChange={(e) => setFormData({ ...formData, proposedRoomId: e.target.value })}
                      className="input w-full text-xs"
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Justification / Academic Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Rescheduling due to guest speaker availability, inter-university hackathon, or laboratory conflict."
                  className="input w-full resize-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : 'Submit Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      {reviewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base capitalize">
              Confirm Decision: {reviewModal.decision?.replace('_', ' ')}
            </h3>
            <p className="text-xs text-slate-600">
              Please enter any notes or conditions to record in the official audit trail and send to the class representative.
            </p>
            <textarea
              rows="3"
              value={reviewModal.notes}
              onChange={(e) => setReviewModal({ ...reviewModal, notes: e.target.value })}
              placeholder="e.g. Confirmed with course instructor Dr Thilaga M. Room capacity verified."
              className="input w-full text-xs resize-none"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setReviewModal({ isOpen: false, reqId: null, decision: '', notes: '' })}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                className="btn-primary text-xs"
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
