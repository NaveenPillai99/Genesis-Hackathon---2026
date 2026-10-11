import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listLostItems,
  recordHandover,
} from '../../../lib/dataClient'

import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function StudentWelfareDashboard({ user }) {
  const [lostItems, setLostItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashMsg, setFlashMsg] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const items = await listLostItems().catch(() => [])
      setLostItems(items || [])
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

  async function handleHandoverItem(itemId) {
    try {
      await recordHandover(itemId, {
        newCustody: 'returned',
        handoverNotes: `Physical custody verified with College ID check by ${user?.name}.`,
      })
      flash('Item successfully returned to verified student owner with custody audit trail entry!')
      loadData()
    } catch (e) {
      alert(`Error recording handover: ${e.message}`)
    }
  }

  const inCustodyItems = lostItems.filter((i) => i.status === 'in_custody' || i.status === 'reported')
  const pendingClaims = lostItems.filter((i) => i.status === 'claim_pending')
  const returnedItems = lostItems.filter((i) => i.status === 'returned')

  return (
    <div className="space-y-6">
      {flashMsg && (
        <div className="rounded-xl bg-teal-600 text-white px-4 py-3 text-xs md:text-sm font-bold shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🎒</span>
            <span>{flashMsg}</span>
          </div>
          <button onClick={() => setFlashMsg('')} className="text-white hover:text-teal-200">✕</button>
        </div>
      )}

      {/* Official Amrita College Portal Hero & Action Tiles */}
      <AmritaPortalHero
        user={user}
        customAlerts={[
          {
            id: 'swf-alt-1',
            title: `Locker Custody Inventory: ${inCustodyItems.length} student possessions secured in Student Welfare Locker (AB3 Room 101)`,
            link: '/lost-found',
          },
          {
            id: 'swf-alt-2',
            title: `Pending Verification: ${pendingClaims.length} ownership claim(s) require physical ID check prior to handover`,
            link: '/lost-found',
          },
        ]}
      />

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 shadow-2xs">
          <span className="text-xs font-bold text-teal-800 uppercase">Items in Custody</span>
          <div className="text-2xl font-black text-teal-950 mt-1">{inCustodyItems.length} Items</div>
          <p className="text-[11px] text-teal-700 mt-1">Stored in Student Welfare locker</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Pending Ownership Claims</span>
          <div className="text-2xl font-black text-amber-600 mt-1">{pendingClaims.length} Claims</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting physical ID verification</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Successfully Restored</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{returnedItems.length} Restored</div>
          <p className="text-[11px] text-slate-500 mt-1">With signed custodial logs</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Classroom Escalations</span>
          <div className="text-2xl font-black text-slate-900 mt-1">0 Escalated</div>
          <p className="text-[11px] text-slate-500 mt-1">&gt;7 days auto-escalation rule active</p>
        </div>
      </section>

      {/* Custody Items List */}
      <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Physical Custody Intake &amp; Dispatch Desk
            </h2>
            <p className="text-xs text-slate-500">
              Items discovered in campus common areas or escalated from academic classrooms after 7 days.
            </p>
          </div>
          <span className="rounded-full bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-1">
            {inCustodyItems.length} Active in Custody
          </span>
        </div>

        <div className="space-y-3">
          {inCustodyItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-teal-200/80 bg-teal-50/20 p-4 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">{item.name || item.title}</h4>
                  <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Custody: {item.currentCustody || 'Student Welfare'}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Location: {item.location || 'Central Food Court'} · Found by: {item.finderName || 'Student'}
                </p>
                <p className="text-teal-900 font-medium text-[11px] mt-1 bg-white p-1 rounded border border-teal-200/60 inline-block">
                  📌 {item.routingReason || 'Common-Area Found Item (Immediate Student Welfare Custody)'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleHandoverItem(item.id)}
                  className="rounded-lg bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-700 shadow-2xs"
                >
                  ✓ Verify ID &amp; Hand Over
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
