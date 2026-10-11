import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  ROLES,
  ROLE_LABELS,
  ROLE_BADGE_COLORS,
  ROLE_DESCRIPTIONS,
} from '../../lib/constants'
import { listProfiles, listLostItems, listChangeRequests } from '../../lib/dataClient'
import { computePersonPriority } from '../../lib/priorityScore'

export default function UserProfile() {
  const { user, loginAs } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [lostItems, setLostItems] = useState([])
  const [changeRequests, setChangeRequests] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    department: user?.department || '',
    classSection: user?.class_section || '',
  })
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    listProfiles().then((p) => setProfiles(p || []))
    listLostItems().then((items) => setLostItems(items || []))
    listChangeRequests().then((reqs) => setChangeRequests(reqs || []))
  }, [])

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        department: user.department || '',
        classSection: user.class_section || '',
      })
    }
  }, [user])

  if (!user) return null

  const role = user.role || ROLES.STUDENT
  const badgeColor = ROLE_BADGE_COLORS[role] || 'bg-slate-100 text-slate-700'

  // Role permissions catalog
  const rolePermissions = {
    [ROLES.STUDENT]: [
      'View Real-Time Classroom Availability & Free Slots',
      'Browse Campus Public Events Feed',
      'Book Eligible Innovation Facilities (after Safety Induction)',
      'Submit Lost and Found Item Reports',
      'Submit and Track Ownership Claims with Custodians',
    ],
    [ROLES.CLASS_REP]: [
      'Instant Classroom Reservations for Academic Revision (up to 6 hrs/week)',
      'Submit Class Prepone/Postpone Reschedule Proposals with Clash Detection',
      'Request Additional Departmental Academic Sessions',
      'Communicate with Assigned Class Advisor & Course Faculty',
    ],
    [ROLES.CLASS_ADVISOR]: [
      'Review & Authorize Class Prepone/Postpone Timetable Proposals',
      'Receive Auto-Routed Lost Items Found in Section Classrooms',
      'Verify Ownership & Coordinate Custody Handover for Classroom Items',
      'Audit Department Scheduling Conflicts & Timetable Integrity',
    ],
    [ROLES.FACULTY]: [
      'Manage Teaching Schedule & Student Appointment Windows',
      'Submit Event Venue Requests for Academic Symposiums',
      'Review Class Reschedule Proposals for Taught Courses',
      'Authorize Student HPC Compute Allocations (>20 node-hours)',
    ],
    [ROLES.LAB_ASSISTANT]: [
      'Toggle Facility Maintenance Downtime & Diagnostic Reasons',
      'Publish Equipment Booking Slots (3D Printers, VR Kits, Electronics)',
      'Update Equipment Custody and Storage Locations',
      'Conduct Hands-On Safety Orientation Sessions',
    ],
    [ROLES.LAB_ADMIN]: [
      'Configure Innovation Facility Eligibility & Quota Policies',
      'Grant Official Student Safety Inductions',
      'Oversee Assigned Lab Assistants and Technical Staff',
      'Review Equipment Utilization Analytics and Safety Audits',
    ],
    [ROLES.RESOURCE_ADMIN]: [
      'Manage Campus Resource Catalogue (Auditoriums, Seminar Halls, Classrooms)',
      'Evaluate Competing Event Venue Requests with Priority Scoring',
      'Override / Resolve Cross-Departmental Booking Collisions',
      'Inspect Institution-Wide Space Utilization Reports',
    ],
    [ROLES.LOST_PROPERTY_HANDLER]: [
      'Receive Campus Lost Property Routed from Outdoor / Common Areas',
      'Maintain Central Custody Locker Inventory',
      'Review Student Claims & Inspect Proof of Ownership',
      'Record Official Handover Receipts and Update Custody History',
    ],
    [ROLES.SYS_ADMIN]: [
      'System-Wide Technical Configuration & Health Monitoring',
      'Inspect Append-Only Security & Action Audit Trail',
      'Manage University E-Governance (AUMS) Sync Gateway Adapter',
      'Govern User Roles and Role-Based Access Controls (RBAC)',
    ],
  }[role] || ['Standard Platform Access']

  // My items
  const myItems = lostItems.filter((i) => i.finderId === user.id)
  const myClaims = lostItems
    .flatMap((i) => (i.claims || []).map((c) => ({ ...c, itemTitle: i.title })))
    .filter((c) => c.claimantId === user.id)
  const custodyItems = lostItems.filter(
    (i) => i.assignedHandlerId === user.id || i.currentCustody === role
  )
  const myChangeRequests = changeRequests.filter((r) => r.requesterId === user.id)

  function handleSaveProfile(e) {
    e.preventDefault()
    user.name = editForm.name
    user.department = editForm.department
    if (editForm.classSection) user.class_section = editForm.classSection
    setIsEditing(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Header with Switcher Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Account Profile &amp; Role Identity
          </h1>
          <p className="text-sm text-slate-500">
            Role-based campus credentials, authorized privileges, and university directory records.
          </p>
        </div>

        {/* Quick Switch to Inspect another role's profile */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-600 pl-2">Switch Profile:</span>
          <select
            value={user.id}
            onChange={(e) => {
              const target = profiles.find((p) => p.id === e.target.value)
              if (target) loginAs(target)
            }}
            className="input !py-1 !px-2.5 text-xs font-semibold text-slate-800 bg-slate-50 border-slate-200"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {ROLE_LABELS[p.role]} — {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {saveSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 font-semibold flex items-center justify-between">
          <span>✓ Profile information successfully updated and synced.</span>
          <button onClick={() => setSaveSuccess(false)}>✕</button>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-700 to-brand-500 text-2xl font-black text-white shadow-md">
              {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>

            <div>
              {(() => {
                const personPrio = computePersonPriority(role)
                const isStaff = ['resource_admin', 'sys_admin', 'faculty', 'lab_admin'].includes(role)
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                      {ROLE_LABELS[role]}
                    </span>
                    {personPrio.priority === 1 ? (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                        ⚡ High Priority (1)
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        Normal Priority (0)
                      </span>
                    )}
                    {isStaff && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        (Weight: {personPrio.rawScore} · Sigmoid: {personPrio.sigmoidConfidence})
                      </span>
                    )}
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span>●</span> AUMS Verified
                    </span>
                  </div>
                )
              })()}


              <p className="text-xs text-slate-500 font-mono mt-1">{user.email}</p>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                {user.department || 'Amrita Vishwa Vidyapeetham'}
                {user.class_section && ` • Section: ${user.class_section}`}
              </p>

              <p className="text-[11px] text-slate-400 mt-2 max-w-xl leading-relaxed">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn-secondary text-xs self-start"
          >
            {isEditing ? 'Cancel Edit' : 'Edit Profile Info'}
          </button>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Display Name</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Department / Cabin</label>
              <input
                type="text"
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Class Section</label>
              <input
                type="text"
                value={editForm.classSection}
                onChange={(e) => setEditForm({ ...editForm, classSection: e.target.value })}
                className="input w-full"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Profile
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Grid: Permissions Matrix & Role-Specific Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Authorized Permissions Matrix */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span>🛡️</span>
            <span>Role Permissions Matrix</span>
          </h3>
          <p className="text-xs text-slate-500">
            Server-enforced access rights for role <strong>{ROLE_LABELS[role]}</strong>:
          </p>
          <ul className="space-y-2 pt-1 text-xs">
            {rolePermissions.map((perm, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{perm}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Columns (Span 2): Role-Specific Operational Records */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1. STUDENT VIEW */}
          {role === ROLES.STUDENT && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h3 className="font-bold text-slate-900 text-sm mb-3">🎓 Student Academic Credentials</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Registered Section</span>
                    <strong className="text-slate-800 block mt-0.5">{user.department || 'CSE, V A'}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Class Advisor</span>
                    <strong className="text-slate-800 block mt-0.5">Dr Devika (Mathematics)</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h3 className="font-bold text-slate-900 text-sm mb-3">🧪 Innovation Lab Safety Inductions</h3>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">3D Rapid Prototyping Lab</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">Induction Verified by Mr Suresh Kumar</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                      Inducted
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between opacity-75">
                    <div>
                      <span className="font-bold text-slate-700">VR / AR Immersive Lab</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Orientation session pending</p>
                    </div>
                    <span className="bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded text-[10px]">
                      Not Inducted
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CLASS REPRESENTATIVE VIEW */}
          {role === ROLES.CLASS_REP && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/30 p-5 shadow-2xs">
                <h3 className="font-bold text-cyan-950 text-sm mb-3">🗂️ Class Representative Authority</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-cyan-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Represented Section</span>
                    <strong className="text-slate-800 block mt-0.5">{user.department || 'Int. M.Sc Data Science, VII B'}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-cyan-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Weekly Classroom Quota</span>
                    <strong className="text-slate-800 block mt-0.5">2.0 / 6.0 Hours Used</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h3 className="font-bold text-slate-900 text-sm mb-3">📋 Timetable Reschedule Proposals Submitted</h3>
                {myChangeRequests.length === 0 ? (
                  <p className="text-xs text-slate-400">No reschedule proposals filed by this representative account.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {myChangeRequests.map((r) => (
                      <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <strong className="text-slate-900">{r.courseName} ({r.courseCode})</strong>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            {r.originalDay} {r.originalSlot} ➜ {r.proposedDay} {r.proposedSlot}
                          </p>
                        </div>
                        <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. CLASS ADVISOR VIEW */}
          {role === ROLES.CLASS_ADVISOR && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-2xs">
                <h3 className="font-bold text-indigo-950 text-sm mb-3">🧑‍💼 Class Advisor Assignment</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-indigo-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Class Section</span>
                    <strong className="text-slate-800 block mt-0.5">Int. M.Sc Data Science, VII B</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-indigo-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Advisor Cabin Office</span>
                    <strong className="text-slate-800 block mt-0.5">Mathematics Dept, AB1 Room 214</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h3 className="font-bold text-slate-900 text-sm mb-2">📦 Auto-Routed Classroom Lost Property</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Items found during your section's class slots are automatically routed to your advisor custody.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                  <div>
                    <strong className="text-slate-900">Casio Scientific Calculator FX-991CW</strong>
                    <p className="text-slate-500 text-[11px] mt-0.5">Found in AB1 E-104 during Deep Learning lecture.</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">
                    In Advisor Custody
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. FACULTY VIEW */}
          {role === ROLES.FACULTY && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-2xs">
                <h3 className="font-bold text-blue-950 text-sm mb-3">🧑‍🏫 Teaching Load &amp; Courses</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-blue-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Courses</span>
                    <strong className="text-slate-800 block mt-0.5">Deep Learning (22CSC401)</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-blue-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Lecture Schedule</span>
                    <strong className="text-slate-800 block mt-0.5">Mon, Wed, Fri (Slot 2) • AB1 E-104</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. LAB ASSISTANT & LAB ADMIN VIEW */}
          {(role === ROLES.LAB_ASSISTANT || role === ROLES.LAB_ADMIN) && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 shadow-2xs">
                <h3 className="font-bold text-amber-950 text-sm mb-3">🔬 Laboratory In-Charge Responsibility</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Facilities Under Supervision</span>
                    <strong className="text-slate-800 block mt-0.5">3D Rapid Prototyping, VR/AR, Electronics</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Lab Physical Base</span>
                    <strong className="text-slate-800 block mt-0.5">Innovation Lab, AB1 Ground Floor</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. CENTRAL RESOURCE ADMIN VIEW */}
          {(role === ROLES.RESOURCE_ADMIN || role === ROLES.ADMIN) && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-5 shadow-2xs">
                <h3 className="font-bold text-purple-950 text-sm mb-3">🗝️ Campus Resource Administration</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-purple-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Administrative Jurisdiction</span>
                    <strong className="text-slate-800 block mt-0.5">Main Auditorium, Seminar Halls &amp; All Rooms</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-purple-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Office Base</span>
                    <strong className="text-slate-800 block mt-0.5">Event &amp; Space Office, Admin Block</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. STUDENT WELFARE / LOST PROPERTY HANDLER VIEW */}
          {role === ROLES.LOST_PROPERTY_HANDLER && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-teal-200 bg-teal-50/30 p-5 shadow-2xs">
                <h3 className="font-bold text-teal-950 text-sm mb-3">🎒 Student Welfare Custodian Office</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-teal-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Central Storage Desk</span>
                    <strong className="text-slate-800 block mt-0.5">Office of Student Welfare, Locker #4</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-teal-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Items Currently In Custody</span>
                    <strong className="text-slate-800 block mt-0.5">{custodyItems.length} Recorded Items</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 8. SYSTEM ADMINISTRATOR VIEW */}
          {role === ROLES.SYS_ADMIN && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-5 shadow-2xs">
                <h3 className="font-bold text-rose-950 text-sm mb-3">🛡️ System Administration &amp; ICT Systems</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-rose-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Security Clearance</span>
                    <strong className="text-slate-800 block mt-0.5">Level 5 Super Administrator</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-rose-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">E-Governance Gateway</span>
                    <strong className="text-emerald-700 block mt-0.5">● AUMS Gateway Synchronized</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Simulated University RFID Smart Card */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-brand-400 block">
                AMRITA VISHWA VIDYAPEETHAM
              </span>
              <h4 className="text-base font-extrabold text-white mt-0.5">
                Digital Campus ID Card
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                Name: <span className="font-bold text-white">{user.name}</span> • Role: <span className="font-bold text-brand-300">{ROLE_LABELS[role]}</span>
              </p>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                ID: AM-{user.id?.slice(0, 8).toUpperCase()} • NFC Ready
              </p>
            </div>
            <div className="bg-white p-2 rounded-xl text-slate-900 text-center font-mono text-[10px] tracking-widest font-bold shrink-0 self-start sm:self-auto">
              ||| | |||| | |||
              <div className="text-[9px] text-slate-500 mt-0.5 font-sans">RFID BARCODE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
