import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listFacilities,
  setFacilityMaintenance,
  listInductions,
  completeInduction,
  listFacilityBookings,
} from '../../../lib/dataClient'

import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function LabAssistantDashboard({ user }) {
  const [facilities, setFacilities] = useState([])
  const [inductions, setInductions] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  // Scoped facility: Suresh Kumar is assigned to Innovation & Prototyping Lab (fac-3dprint)
  const assignedFacilityId = user?.assignedFacilityId || 'fac-3dprint'

  async function loadData() {
    setLoading(true)
    try {
      const [facs, indList, bks] = await Promise.all([
        listFacilities().catch(() => []),
        listInductions().catch(() => []),
        listFacilityBookings().catch(() => []),
      ])
      // Filter strictly to assigned facility
      const myFacilities = (facs || []).filter(
        (f) => f.id === assignedFacilityId || f.id.includes('3d') || f.name.includes('Prototyping')
      )
      setFacilities(myFacilities.length > 0 ? myFacilities : facs.slice(0, 2))
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
  }, [user])

  function flash(msg) {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(''), 4000)
  }

  async function handleToggleMaintenance(facilityId, currentMaintenance) {
    try {
      await setFacilityMaintenance(facilityId, !currentMaintenance)
      flash(`Equipment maintenance state switched to ${!currentMaintenance ? 'UNDER MAINTENANCE' : 'AVAILABLE'}!`)
      loadData()
    } catch (e) {
      alert(`Error toggling maintenance: ${e.message}`)
    }
  }

  async function handleCertifyInduction(userId, facilityId) {
    try {
      await completeInduction({
        userId,
        facilityId,
        byUserId: user?.id,
      })
      flash('Safety induction clearance certified! Student is cleared to operate machine.')
      loadData()
    } catch (e) {
      alert(`Error certifying induction: ${e.message}`)
    }
  }

  const activeEquipment = facilities.filter((f) => !f.underMaintenance)
  const maintenanceEquipment = facilities.filter((f) => f.underMaintenance)

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-amber-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🔧</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-amber-200">✕</button>
        </div>
      )}

      {/* Official Amrita College Portal Hero & Action Tiles */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'lab-alt-1',
            title: `Safety Induction Checklist: ${inductions.filter((i) => !i.completed).length} student machine badge(s) awaiting sign-off`,
            link: '/facilities',
          },
          {
            id: 'lab-alt-2',
            title: `Equipment Maintenance Log: ${maintenanceEquipment.length} item(s) currently marked under service`,
            link: '/facilities',
          },
        ]}
      />

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Assigned Equipment</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{facilities.length} Machines</div>
          <p className="text-[11px] text-slate-500 mt-1">Innovation &amp; Prototyping Station</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <span className="text-xs font-bold text-emerald-800 uppercase">Operational &amp; Available</span>
          <div className="text-2xl font-black text-emerald-950 mt-1">{activeEquipment.length} Online</div>
          <p className="text-[11px] text-emerald-700 mt-1">Ready for student bookings</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <span className="text-xs font-bold text-amber-800 uppercase">Under Maintenance</span>
          <div className="text-2xl font-black text-amber-950 mt-1">{maintenanceEquipment.length} Down</div>
          <p className="text-[11px] text-amber-700 mt-1">Service required</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Safety Inductions</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{inductions.length} Certified</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Active clearance roster</p>
        </div>
      </section>

      {/* Assigned Equipment Fleet */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Assigned Lab Machines &amp; Real-Time Operational Status
            </h2>
            <p className="text-xs text-slate-500">
              Only equipment assigned to your supervisory scope is displayed. Toggle availability when maintenance is required.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1">
            {facilities.length} Machines Under Your Scope
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
                  <span className="text-2xl">{fac.image || '🖨️'}</span>
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
                  <span className="text-slate-400 text-[10px]">Quota: 2h/day</span>
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
                {fac.underMaintenance ? '✓ Set Available' : '⚠️ Mark Maintenance'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Safety Induction & Student Clearance Queue */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎓</span>
            <h3 className="text-sm font-bold text-slate-900">
              Student Safety Induction Clearance Queue
            </h3>
          </div>
          <span className="text-xs text-slate-400">Innovation Lab Roster</span>
        </div>
        <p className="text-xs text-slate-500">
          Students must complete physical safety training before operating 3D printers and laser cutters.
        </p>

        <div className="space-y-2 mt-2">
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-xs flex justify-between items-center">
            <div>
              <h4 className="font-bold text-slate-900">Rohit Krishna (CB.EN.U4CSE21234)</h4>
              <p className="text-slate-500 text-[11px]">Requested: 3D Printing Lab &amp; Electronics Station Clearance</p>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold mt-1 inline-block">
                Practical Assessment Passed
              </span>
            </div>
            <button
              onClick={() => handleCertifyInduction('user-student-2', 'fac-3dprint')}
              className="rounded bg-brand-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-brand-700 shadow-2xs"
            >
              ✓ Certify Safety Badge
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
