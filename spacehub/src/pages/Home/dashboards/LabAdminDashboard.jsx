import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listFacilities,
  setFacilityMaintenance,
  listInductions,
  listFacilityBookings,
} from '../../../lib/dataClient'

export default function LabAdminDashboard({ user }) {
  const [facilities, setFacilities] = useState([])
  const [inductions, setInductions] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const [facs, indList, bks] = await Promise.all([
        listFacilities().catch(() => []),
        listInductions().catch(() => []),
        listFacilityBookings().catch(() => []),
      ])
      setFacilities(facs || [])
      setInductions(indList || [])
      setBookings(bks || [])
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
    setTimeout(() => setFlashMsg(''), 4000)
  }

  async function handleToggleMaintenance(facilityId, currentMaintenance) {
    try {
      await setFacilityMaintenance(facilityId, !currentMaintenance)
      flash(`Maintenance status changed to ${!currentMaintenance ? 'UNDER MAINTENANCE' : 'AVAILABLE'}!`)
      loadData()
    } catch (e) {
      alert(`Error toggling maintenance: ${e.message}`)
    }
  }

  const assistantRoster = [
    { name: 'Suresh Kumar', id: 'user-labassist-1', lab: 'Innovation & Prototyping Lab', shift: '08:30 – 16:30', status: 'On Duty' },
    { name: 'Karthik Raja', id: 'user-labassist-2', lab: 'Robotics & Embedded Systems Lab', shift: '10:00 – 18:00', status: 'On Duty' },
    { name: 'Priya Mani', id: 'user-labassist-3', lab: 'Advanced AI & Vision Computing Lab', shift: '13:00 – 21:00', status: 'Upcoming' },
  ]

  const activeCount = facilities.filter((f) => !f.underMaintenance).length
  const maintenanceCount = facilities.filter((f) => f.underMaintenance).length

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-orange-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🔬</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-orange-200">✕</button>
        </div>
      )}

      {/* Lab Admin Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-orange-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-orange-500/20 text-orange-200 border border-orange-400/30">
                🔬 Laboratory Fleet Administrator Desk
              </span>
              <span className="text-orange-300 text-xs">• Department of Computer Science &amp; Engineering</span>
              <span className="text-emerald-400 text-xs bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                Departmental Scope Active
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Welcome, {user?.name}
            </h1>
            <p className="text-orange-200/80 text-xs md:text-sm mt-1 max-w-xl">
              Oversee departmental laboratory facilities, manage lab assistant duty rosters, audit machine utilization, and configure safety eligibility rules.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/facilities"
              className="rounded-xl bg-white text-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-orange-50 shadow-sm"
            >
              📊 Facilities Registry
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Lab Stations</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{facilities.length} Stations</div>
          <p className="text-[11px] text-slate-500 mt-1">Across 3 academic blocks</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <span className="text-xs font-bold text-emerald-800 uppercase">Operational &amp; In-Service</span>
          <div className="text-2xl font-black text-emerald-950 mt-1">{activeCount} Stations</div>
          <p className="text-[11px] text-emerald-700 mt-1">Ready for student reservations</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <span className="text-xs font-bold text-amber-800 uppercase">Maintenance Required</span>
          <div className="text-2xl font-black text-amber-950 mt-1">{maintenanceCount} Machines</div>
          <p className="text-[11px] text-amber-700 mt-1">Parts ordered or servicing</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Lab Assistant Roster</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{assistantRoster.length} Active</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">All shifts covered today</p>
        </div>
      </section>

      {/* Fleet Overview & Policy Controls */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Departmental Laboratory Equipment Fleet
            </h2>
            <p className="text-xs text-slate-500">
              Configure operational states, monitor safety certifications, and track utilization.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1">
            {facilities.length} Managed Stations
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {facilities.map((fac) => (
            <div
              key={fac.id}
              className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 text-xs flex justify-between items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{fac.image || '🔬'}</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{fac.name}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">{fac.location}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      fac.underMaintenance
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {fac.underMaintenance ? 'Under Maintenance' : 'In Service & Available'}
                  </span>
                  <span className="text-slate-400 text-[10px]">Max 2h session</span>
                </div>
              </div>

              <button
                onClick={() => handleToggleMaintenance(fac.id, fac.underMaintenance)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors shadow-2xs ${
                  fac.underMaintenance
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                }`}
              >
                {fac.underMaintenance ? '✓ Clear Maintenance' : '⚠️ Mark Maintenance'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Lab Assistant Supervisory Roster */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧑‍🔧</span>
            <h3 className="text-sm font-bold text-slate-900">
              Lab Assistant Supervisory Duty Roster
            </h3>
          </div>
          <span className="text-xs text-slate-400">Spring Semester 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-3">Assistant Name</th>
                <th className="py-2.5 px-3">Assigned Laboratory Facility</th>
                <th className="py-2.5 px-3">Duty Hours</th>
                <th className="py-2.5 px-3">Duty Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assistantRoster.map((ast) => (
                <tr key={ast.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">{ast.name}</td>
                  <td className="py-3 px-3 text-slate-700">{ast.lab}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{ast.shift}</td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      {ast.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
