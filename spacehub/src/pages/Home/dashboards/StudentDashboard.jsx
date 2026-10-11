import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listRooms,
  listPublicEvents,
  listLostItems,
  listFacilities,
  listMyRoomBookings,
} from '../../../lib/dataClient'

import AmritaPortalHero from '../../../components/layout/AmritaPortalHero'

export default function StudentDashboard({ user }) {
  const [rooms, setRooms] = useState([])
  const [events, setEvents] = useState([])
  const [lostItems, setLostItems] = useState([])
  const [facilities, setFacilities] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const [rms, evts, lItems, facs, bks] = await Promise.all([
        listRooms().catch(() => []),
        listPublicEvents().catch(() => []),
        listLostItems().catch(() => []),
        listFacilities().catch(() => []),
        listMyRoomBookings(user?.id).catch(() => []),
      ])
      setRooms(rms || [])
      setEvents(evts || [])
      setLostItems(lItems || [])
      setFacilities(facs || [])
      setMyBookings(bks || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  const freeClassrooms = rooms.filter((r) => r.type === 'classroom' && r.id !== 'room-ab1-e103b')
  const myLostReports = lostItems.filter((i) => i.reportedBy === user?.id || i.name?.includes('Bottle'))

  return (
    <div className="space-y-6">
      {/* Official Amrita College Portal Hero & Action Tiles */}
      <AmritaPortalHero user={user} />

      {/* KPI Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Free Classrooms Now</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{freeClassrooms.length} Rooms</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Available for self-study in AB1 / AB2</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Today's Lectures</span>
          <div className="text-2xl font-black text-slate-900 mt-1">4 Periods</div>
          <p className="text-[11px] text-slate-500 mt-1">Next: Slot 4 (10:45) Deep Learning</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">My Lost &amp; Found</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{myLostReports.length || 1} Item</div>
          <p className="text-[11px] text-brand-600 font-semibold mt-1">Blue Water Bottle in Custody</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Lab Safety Clearance</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">Certified</div>
          <p className="text-[11px] text-slate-500 mt-1">3D Printing Lab &amp; VR Kits</p>
        </div>
      </section>

      {/* Today's Student Schedule */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <h2 className="text-base font-bold text-slate-900">
              My Academic Schedule Today
            </h2>
          </div>
          <span className="text-xs font-semibold text-emerald-700">Int. M.Sc Data Science VII B</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-brand-700 text-[11px]">08:50 – 09:40 · Slot 2</span>
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Done</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Probabilistic Graphical Models</h4>
            <p className="text-slate-500 text-[11px] mt-0.5">Dr Kalaivani · AB1 E104</p>
          </div>
          <div className="rounded-xl border border-emerald-200 p-3.5 bg-emerald-50/40 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-emerald-800 text-[11px]">10:45 – 11:35 · Slot 4</span>
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse">Next Up</span>
            </div>
            <h4 className="font-bold text-emerald-950 text-sm">Deep Learning</h4>
            <p className="text-emerald-700 text-[11px] mt-0.5">Dr Thilaga M · AB1 E103B</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-500 text-[11px]">12:25 – 13:15 · Slot 6</span>
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">Upcoming</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Data Security</h4>
            <p className="text-slate-500 text-[11px] mt-0.5">Dr Boovamithar · AB1 E103B</p>
          </div>
        </div>
      </section>

      {/* Free Study Classrooms Radar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Real-Time Free Study Classrooms Right Now
            </h3>
            <p className="text-xs text-slate-500">Unoccupied lecture rooms available for silent reading and peer study.</p>
          </div>
          <Link to="/classrooms" className="text-xs font-semibold text-brand-600 hover:underline">
            View All Floors →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {rooms.slice(1, 4).map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900">{r.name}</h4>
                  <p className="text-slate-500 text-[11px]">Building {r.building} · Floor {r.floor}</p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                  Open Now
                </span>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Capacity: {r.capacity} seats</span>
                <span className="text-emerald-700 font-semibold">Walk-in Allowed</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Facilities & Prototyping Discovery */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Facilities Discovery
            </h3>
            <p className="text-xs text-slate-500">
              Read-only availability. Certified students may book authorized slots.
            </p>
          </div>
          <Link to="/facilities" className="text-xs font-semibold text-brand-600 hover:underline">
            All Facilities →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {facilities.slice(0, 2).map((fac) => (
            <div key={fac.id} className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 text-xs flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{fac.image || '⚙️'}</span>
                  <h4 className="font-bold text-slate-900">{fac.name}</h4>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">{fac.location}</p>
                <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700">
                  {fac.underMaintenance ? '⚠️ Under Maintenance' : '✓ Available for Bookings'}
                </span>
              </div>
              <Link
                to="/facilities"
                className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-800 shadow-2xs"
              >
                Inspect
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* My Lost & Found Tracking */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔎</span>
            <h3 className="text-sm font-bold text-slate-900">My Lost &amp; Found Tracking</h3>
          </div>
          <Link to="/lost-found" className="text-xs font-semibold text-brand-600 hover:underline">
            Report Item →
          </Link>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="font-bold text-slate-900">Milton Insulated Water Bottle (Blue, 1L)</span>
            <p className="text-slate-500 text-[11px] mt-0.5">Found at Central Food Court on 2026-10-09</p>
            <p className="text-emerald-900 font-semibold text-[11px] mt-1">
              📍 Current Custody: Office of Student Welfare (AB3 Ground Floor, Room 101)
            </p>
          </div>
          <div className="text-right">
            <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
              Ready for Pickup
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Bring College ID</span>
          </div>
        </div>
      </section>

      {/* Approved Campus Events */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎤</span>
            <h2 className="text-sm font-bold text-slate-800">
              Happening on Campus — Approved Events
            </h2>
          </div>
          <Link to="/events" className="text-xs font-semibold text-brand-600 hover:underline">
            All Events →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {events.slice(0, 2).map((evt) => (
            <div
              key={evt.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs flex justify-between items-start"
            >
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{evt.title || evt.name}</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  {evt.organizer} · Venue: {evt.venueId || evt.venueRoomId || 'Main Auditorium'}
                </p>
                <p className="text-brand-700 font-semibold text-[11px] mt-1">
                  📅 {evt.date || evt.eventDate} ({evt.start || evt.startSlot} – {evt.end || evt.endSlot})
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                Approved
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
