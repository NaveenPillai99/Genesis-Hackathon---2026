import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  CAN_PROCESS_LOST_FOUND_CLAIMS,
  DAY_SLOTS,
  ROLES,
} from '../../lib/constants'
import {
  listLostItems,
  listRooms,
  listTimetableSlots,
  reportSmartLostItem,
  submitClaim,
  reviewClaim,
  recordHandover,
} from '../../lib/dataClient'
import { fileToResizedDataUrl } from '../../lib/image'

const CATEGORIES = [
  { id: 'electronics', label: 'Electronics & Gadgets', icon: '💻' },
  { id: 'documents', label: 'IDs & Documents', icon: '📄' },
  { id: 'accessories', label: 'Watches & Accessories', icon: '⌚' },
  { id: 'keys', label: 'Keys & Keychains', icon: '🔑' },
  { id: 'bags', label: 'Bags & Backpacks', icon: '🎒' },
  { id: 'books', label: 'Books & Stationery', icon: '📚' },
  { id: 'other', label: 'Other Items', icon: '📦' },
]

export default function LostFoundBoard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('browse')
  const [items, setItems] = useState([])
  const [rooms, setRooms] = useState([])
  const [timetable, setTimetable] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  // Claim modal state
  const [claimModal, setClaimModal] = useState({ isOpen: false, item: null, proof: '', phone: '' })

  // Handover modal state
  const [handoverModal, setHandoverModal] = useState({ isOpen: false, item: null, notes: '' })

  // Claim review modal state
  const [reviewModal, setReviewModal] = useState({ isOpen: false, item: null, claim: null, decision: '', notes: '' })

  const isHandler = CAN_PROCESS_LOST_FOUND_CLAIMS.has(user?.role)

  async function loadData() {
    setLoading(true)
    try {
      const [allItems, allRooms, allTimetable] = await Promise.all([
        listLostItems(),
        listRooms(),
        listTimetableSlots(),
      ])
      setItems(allItems || [])
      setRooms((allRooms || []).filter((r) => r.type === 'classroom'))
      setTimetable(allTimetable || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered browse items
  const foundItems = items.filter((i) => i.reportType === 'found')
  const lostItems = items.filter((i) => i.reportType === 'lost')

  const displayedFound = foundItems.filter((item) => {
    const matchesCat = !selectedCategory || item.category === selectedCategory
    const matchesSearch =
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locationFound?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  // Custodian items (for Handlers & Class Advisors)
  const custodianItems = items.filter((i) => {
    if (user.role === ROLES.CLASS_ADVISOR) {
      return i.assignedHandlerId === user.id || i.currentCustody === 'class_advisor'
    }
    return true
  })

  // Smart Matching Pairs
  const matchPairs = []
  lostItems.forEach((lost) => {
    foundItems.forEach((found) => {
      let score = 0
      const reasons = []
      if (lost.category === found.category) {
        score += 40
        reasons.push('Category matched')
      }
      if (
        lost.locationFound &&
        found.locationFound &&
        (lost.locationFound.toLowerCase().includes(found.locationFound.toLowerCase()) ||
          found.locationFound.toLowerCase().includes(lost.locationFound.toLowerCase()))
      ) {
        score += 35
        reasons.push('Location matched')
      }
      const lostWords = new Set(lost.description?.toLowerCase().split(/\s+/) || [])
      const foundWords = new Set(found.description?.toLowerCase().split(/\s+/) || [])
      const overlap = [...lostWords].filter((w) => w.length > 3 && foundWords.has(w))
      if (overlap.length > 0) {
        score += Math.min(25, overlap.length * 10)
        reasons.push(`${overlap.length} keyword(s) matched`)
      }
      if (score >= 40) {
        matchPairs.push({ lost, found, score, reasons })
      }
    })
  })

  async function handleClaimSubmit(e) {
    e.preventDefault()
    if (!claimModal.item || !claimModal.proof.trim()) return
    try {
      await submitClaim(claimModal.item.id, {
        claimantId: user.id,
        claimantName: user.name,
        proofDescription: claimModal.proof,
        contactPhone: claimModal.phone,
      })
      alert('Claim submitted successfully! The assigned custodian will review your proof.')
      setClaimModal({ isOpen: false, item: null, proof: '', phone: '' })
      loadData()
    } catch (err) {
      alert(err.message || 'Failed to submit claim')
    }
  }

  async function handleReviewSubmit() {
    if (!reviewModal.item || !reviewModal.claim) return
    try {
      await reviewClaim(reviewModal.item.id, reviewModal.claim.id, {
        decision: reviewModal.decision,
        handlerNotes: reviewModal.notes,
      })
      setReviewModal({ isOpen: false, item: null, claim: null, decision: '', notes: '' })
      loadData()
    } catch (err) {
      alert(err.message || 'Review failed')
    }
  }

  async function handleHandoverSubmit(e) {
    e.preventDefault()
    if (!handoverModal.item) return
    try {
      await recordHandover(handoverModal.item.id, {
        newCustody: 'returned',
        handoverNotes: handoverModal.notes || `Returned to verified owner by ${user.name}`,
      })
      alert('Item marked as returned and handover logged in audit history!')
      setHandoverModal({ isOpen: false, item: null, notes: '' })
      loadData()
    } catch (err) {
      alert(err.message || 'Handover logging failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Campus Lost &amp; Found
        </h1>
        <p className="text-sm text-slate-500">
          Intelligent location-aware routing, automated classroom schedule matching, and secure ownership verification.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1 text-sm font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab('browse')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'browse'
              ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>📦</span>
          <span>Browse Found Items ({foundItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('report-found')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'report-found'
              ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>✨</span>
          <span>Report Found Item (Auto-Route)</span>
        </button>

        <button
          onClick={() => setActiveTab('report-lost')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'report-lost'
              ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>🔍</span>
          <span>Report Lost Item</span>
        </button>

        <button
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'matches'
              ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>🎯</span>
          <span>Smart Matches ({matchPairs.length})</span>
        </button>

        {isHandler && (
          <button
            onClick={() => setActiveTab('custody')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
              activeTab === 'custody'
                ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>🛡️</span>
            <span>Custodian &amp; Claims Panel</span>
          </button>
        )}
      </div>

      {/* ---------------- TAB 1: BROWSE FOUND ITEMS ---------------- */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search found items by keyword, location, or item name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input flex-1 text-sm"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input sm:w-56 text-sm"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Cards Grid */}
          {displayedFound.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
              <span className="text-4xl block mb-2">🔎</span>
              No items matching your search criteria.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedFound.map((item) => {
                const statusTone = {
                  reported: 'bg-blue-50 text-blue-800 border-blue-200',
                  in_custody: 'bg-amber-50 text-amber-800 border-amber-200',
                  claim_pending: 'bg-purple-50 text-purple-800 border-purple-200',
                  returned: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                }[item.status] || 'bg-slate-100 text-slate-700'

                const isReturned = item.status === 'returned'

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                  >
                    <div>
                      {/* Photo / Icon */}
                      <div className="relative mb-3 h-40 w-full overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center border border-slate-100">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-5xl">
                            {CATEGORIES.find((c) => c.id === item.category)?.icon || '📦'}
                          </span>
                        )}
                        <span
                          className={`absolute top-2 right-2 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}
                        >
                          {item.status?.replace('_', ' ')}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="my-3 space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">📍</span>
                          <span className="font-semibold text-slate-700 truncate">{item.locationFound}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">🏛️</span>
                          <span className="truncate">Custodian: <strong>{item.assignedHandlerName || 'Student Welfare'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">🏢</span>
                          <span className="truncate">Stored at: {item.storageLocation || 'Campus Security'}</span>
                        </div>
                      </div>

                      {/* Transparent Routing Reason Badge */}
                      {item.routingReason && (
                        <div className="rounded-lg bg-brand-50/60 border border-brand-100 p-2 text-[11px] text-brand-900 mb-2">
                          <span className="font-bold block text-[10px] uppercase text-brand-700">
                            Smart Routing Rationale:
                          </span>
                          {item.routingReason}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        Found: {item.foundDate}
                      </span>
                      {!isReturned && (
                        <button
                          onClick={() => setClaimModal({ isOpen: true, item, proof: '', phone: '' })}
                          className="btn-primary !py-1.5 !px-3 text-xs"
                        >
                          Claim This Item
                        </button>
                      )}
                      {isReturned && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          ✓ Handed Over
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 2: REPORT FOUND ITEM (SMART AUTO-ROUTING) ---------------- */}
      {activeTab === 'report-found' && (
        <ReportFoundForm
          rooms={rooms}
          timetable={timetable}
          user={user}
          onSuccess={() => {
            setActiveTab('browse')
            loadData()
          }}
        />
      )}

      {/* ---------------- TAB 3: REPORT LOST ITEM ---------------- */}
      {activeTab === 'report-lost' && (
        <ReportLostForm
          user={user}
          onSuccess={() => {
            setActiveTab('matches')
            loadData()
          }}
        />
      )}

      {/* ---------------- TAB 4: SMART MATCHES ---------------- */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-xs text-indigo-900">
            <span className="font-bold text-sm block mb-1">🎯 Automated Match Engine</span>
            Our transparent similarity engine compares reported lost items against items in custody using category alignment, keyword overlap, and campus location proximity. Ownership is verified via custody verification.
          </div>

          {matchPairs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
              <span className="text-3xl block mb-2">✨</span>
              No high-confidence matches found between current lost reports and found items.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {matchPairs.map((pair, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase">Match Pair #{idx + 1}</span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 border border-emerald-200">
                      {pair.score}% Confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                      <span className="font-bold text-rose-700 block text-[10px] uppercase">Lost Report</span>
                      <strong className="text-slate-900 block mt-0.5">{pair.lost.title}</strong>
                      <span className="text-slate-500 text-[11px] block mt-1">{pair.lost.locationFound}</span>
                      <p className="text-slate-600 text-[11px] mt-1 line-clamp-2">{pair.lost.description}</p>
                    </div>

                    <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                      <span className="font-bold text-emerald-700 block text-[10px] uppercase">Found In Custody</span>
                      <strong className="text-slate-900 block mt-0.5">{pair.found.title}</strong>
                      <span className="text-slate-500 text-[11px] block mt-1">{pair.found.locationFound}</span>
                      <p className="text-slate-600 text-[11px] mt-1 line-clamp-2">{pair.found.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex gap-1.5 flex-wrap">
                      {pair.reasons.map((r, rIdx) => (
                        <span key={rIdx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => setClaimModal({ isOpen: true, item: pair.found, proof: '', phone: '' })}
                      className="btn-primary !py-1 !px-2.5 text-xs whitespace-nowrap"
                    >
                      File Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 5: CUSTODIAN & CLAIMS PANEL ---------------- */}
      {activeTab === 'custody' && isHandler && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🛡️</span>
              <span>Items In Your Custody &amp; Pending Claims</span>
            </h2>
          </div>

          <div className="space-y-4">
            {custodianItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">{item.title}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase border bg-amber-50 text-amber-800 border-amber-200">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Found at <strong>{item.locationFound}</strong> · Storage: <strong>{item.storageLocation}</strong>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">{item.description}</p>
                  </div>

                  {item.status !== 'returned' && (
                    <button
                      onClick={() => setHandoverModal({ isOpen: true, item, notes: '' })}
                      className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 text-xs self-start"
                    >
                      ✓ Record Handover &amp; Return
                    </button>
                  )}
                </div>

                {/* Claims for this item */}
                <div className="pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                    Claims Filed on This Item ({item.claims?.length || 0})
                  </h4>
                  {(!item.claims || item.claims.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No claims filed yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {item.claims.map((claim) => (
                        <div
                          key={claim.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs flex flex-col sm:flex-row justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{claim.claimantName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-brand-100 text-brand-800">
                                {claim.status}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1">
                              <strong>Proof of Ownership:</strong> {claim.proofDescription}
                            </p>
                            {claim.contactPhone && (
                              <p className="text-slate-500 text-[11px] mt-0.5">Phone: {claim.contactPhone}</p>
                            )}
                          </div>

                          {claim.status === 'pending' && (
                            <div className="flex gap-2 self-start sm:self-center">
                              <button
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    item,
                                    claim,
                                    decision: 'approved',
                                    notes: '',
                                  })
                                }
                                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 text-xs !py-1 !px-2.5"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    item,
                                    claim,
                                    decision: 'rejected',
                                    notes: '',
                                  })
                                }
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim Submission Modal */}
      {claimModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Claim: {claimModal.item?.title}
              </h3>
              <button onClick={() => setClaimModal({ isOpen: false, item: null, proof: '', phone: '' })} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-xs text-slate-500">
              Provide unique identifying proof of ownership (e.g. engravings, wallpaper, sticker markings, contents, or receipt).
            </p>
            <form onSubmit={handleClaimSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Proof of Ownership Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  value={claimModal.proof}
                  onChange={(e) => setClaimModal({ ...claimModal, proof: e.target.value })}
                  placeholder="e.g. Scratches on the battery door, contains a photo in the front pouch, student roll number written on page 1."
                  className="input w-full resize-none"
                  required
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Contact Phone Number</label>
                <input
                  type="tel"
                  value={claimModal.phone}
                  onChange={(e) => setClaimModal({ ...claimModal, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="input w-full"
                />
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClaimModal({ isOpen: false, item: null, proof: '', phone: '' })}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handover & Return Modal */}
      {handoverModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              Record Return Handover: {handoverModal.item?.title}
            </h3>
            <p className="text-xs text-slate-500">
              Record handover details and identity verification before closing the report.
            </p>
            <form onSubmit={handleHandoverSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Handover Verification Notes
                </label>
                <textarea
                  rows="3"
                  value={handoverModal.notes}
                  onChange={(e) => setHandoverModal({ ...handoverModal, notes: e.target.value })}
                  placeholder="e.g. Student ID verified in person; student entered device PIN correctly."
                  className="input w-full resize-none"
                />
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHandoverModal({ isOpen: false, item: null, notes: '' })}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary !bg-emerald-600 hover:!bg-emerald-700">
                  Confirm Handover &amp; Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claim Decision Modal */}
      {reviewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 text-sm capitalize">
              Decision for {reviewModal.claim?.claimantName}: {reviewModal.decision}
            </h3>
            <textarea
              rows="3"
              value={reviewModal.notes}
              onChange={(e) => setReviewModal({ ...reviewModal, notes: e.target.value })}
              placeholder="Notes to claimant regarding verification or collection instructions."
              className="input w-full resize-none"
            />
            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setReviewModal({ isOpen: false, item: null, claim: null, decision: '', notes: '' })}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleReviewSubmit} className="btn-primary">
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- SUBCOMPONENT: REPORT FOUND FORM (SMART AUTO-ROUTING) ----------------
function ReportFoundForm({ rooms, timetable, user, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'electronics',
    description: '',
    isClassroom: true,
    roomId: rooms[0]?.id || 'room-ab1-e104',
    locationFound: '',
    foundDate: new Date().toISOString().slice(0, 10),
    slotId: 'slot2',
    photoUrl: null,
  })
  const [submitting, setSubmitting] = useState(false)

  // Determine dynamic routing preview
  let routingPreview = null
  if (formData.isClassroom && formData.roomId) {
    const matchedSlot = timetable.find(
      (s) => s.roomId === formData.roomId && s.slotId === formData.slotId
    )
    const roomName = rooms.find((r) => r.id === formData.roomId)?.name || formData.roomId

    if (matchedSlot) {
      routingPreview = {
        destination: `Class Advisor: Dr Devika (${matchedSlot.classSection || 'Assigned Section'})`,
        detail: `✨ Smart Timetable Engine matched ${matchedSlot.courseName || matchedSlot.code} on ${formData.slotId?.toUpperCase()}. Report will be routed directly to the Class Advisor!`,
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      }
    } else {
      routingPreview = {
        destination: 'Office of Student Welfare (Ms Priya Balan)',
        detail: `No scheduled course in ${roomName} during this slot. Report will be routed to Central Student Welfare.`,
        tone: 'border-brand-200 bg-brand-50 text-brand-900',
      }
    }
  } else {
    routingPreview = {
      destination: 'Office of Student Welfare (Ms Priya Balan)',
      detail: 'Outdoor / Campus Common Area. Report will be routed directly to the Student Welfare Lost Property custodian.',
      tone: 'border-teal-200 bg-teal-50 text-teal-900',
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (file) {
      const dataUrl = await fileToResizedDataUrl(file)
      setFormData((prev) => ({ ...prev, photoUrl: dataUrl }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const loc = formData.isClassroom
        ? rooms.find((r) => r.id === formData.roomId)?.name || formData.roomId
        : formData.locationFound

      await reportSmartLostItem({
        reportType: 'found',
        title: formData.title,
        category: formData.category,
        description: formData.description,
        isClassroom: formData.isClassroom,
        roomId: formData.isClassroom ? formData.roomId : null,
        locationFound: loc,
        foundDate: formData.foundDate,
        slotId: formData.slotId,
        photoUrl: formData.photoUrl,
        finderId: user.id,
        finderName: user.name,
      })
      alert('Found item reported! The system has successfully auto-routed it to the responsible custodian.')
      onSuccess()
    } catch (err) {
      alert(err.message || 'Report submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <h2 className="text-lg font-bold text-slate-900 mb-1">
        Report a Found Item with Smart Routing
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Our routing engine dynamically matches classroom timetables to assign custody directly to the appropriate Class Advisor or Student Welfare officer.
      </p>

      {/* Dynamic Routing Preview Banner */}
      {routingPreview && (
        <div className={`rounded-xl border p-3.5 mb-5 text-xs ${routingPreview.tone}`}>
          <div className="font-bold uppercase tracking-wider text-[10px] mb-0.5">
            Automatic Custodian Assignment
          </div>
          <div className="font-extrabold text-sm">{routingPreview.destination}</div>
          <p className="mt-1 text-[11px] leading-relaxed">{routingPreview.detail}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Item Name / Short Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Casio Calculator, Blue Wildcraft Backpack, Room Key"
            className="input w-full text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input w-full"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Date Found</label>
            <input
              type="date"
              value={formData.foundDate}
              onChange={(e) => setFormData({ ...formData, foundDate: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>

        {/* Location Type Picker */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <label className="font-bold text-slate-800 block text-xs">Where was this item found?</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="isClassroom"
                checked={formData.isClassroom}
                onChange={() => setFormData({ ...formData, isClassroom: true })}
                className="text-brand-600"
              />
              <span className="font-semibold text-slate-800">Inside a Classroom</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="isClassroom"
                checked={!formData.isClassroom}
                onChange={() => setFormData({ ...formData, isClassroom: false })}
                className="text-brand-600"
              />
              <span className="font-semibold text-slate-800">Outside Classroom (Corridor, Lawn, Canteen)</span>
            </label>
          </div>

          {formData.isClassroom ? (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-slate-600 block mb-1">Classroom</label>
                <select
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                  className="input w-full"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.building})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-600 block mb-1">Class Slot / Time</label>
                <select
                  value={formData.slotId}
                  onChange={(e) => setFormData({ ...formData, slotId: e.target.value })}
                  className="input w-full"
                >
                  {DAY_SLOTS.filter((s) => !s.nonBookable).map((s) => (
                    <option key={s.id} value={s.id}>{s.label} ({s.start} - {s.end})</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <label className="text-slate-600 block mb-1">Specific Campus Location</label>
              <input
                type="text"
                value={formData.locationFound}
                onChange={(e) => setFormData({ ...formData, locationFound: e.target.value })}
                placeholder="e.g. Central Library 2nd Floor, AB2 Cafeteria, Basketball Court"
                className="input w-full"
                required={!formData.isClassroom}
              />
            </div>
          )}
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Description &amp; Appearance (Mask private student IDs) <span className="text-red-500">*</span>
          </label>
          <textarea
            rows="3"
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Color, brand, markings, or contents. Do not publish sensitive roll numbers publicly."
            className="input w-full resize-none"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Attach Photo (Optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="input w-full"
          />
          {formData.photoUrl && (
            <div className="mt-2 h-20 w-20 rounded-lg overflow-hidden border border-slate-200">
              <img src={formData.photoUrl} alt="Preview" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting & Routing…' : 'Submit Found Report'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------- SUBCOMPONENT: REPORT LOST FORM ----------------
function ReportLostForm({ user, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'electronics',
    description: '',
    locationFound: '',
    foundDate: new Date().toISOString().slice(0, 10),
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await reportSmartLostItem({
        reportType: 'lost',
        title: formData.title,
        category: formData.category,
        description: formData.description,
        locationFound: formData.locationFound,
        foundDate: formData.foundDate,
        finderId: user.id,
        finderName: user.name,
      })
      alert('Lost item report registered! The system will notify you if a match is discovered.')
      onSuccess()
    } catch (err) {
      alert(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Report a Lost Item</h2>
      <p className="text-xs text-slate-500 mb-4">
        Log an item you misplaced so the campus matching engine can link it to incoming found reports.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Item Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Dell Inspiron Power Adapter, Titan Watch"
            className="input w-full text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input w-full"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Date Lost</label>
            <input
              type="date"
              value={formData.foundDate}
              onChange={(e) => setFormData({ ...formData, foundDate: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Last Seen Location <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            value={formData.locationFound}
            onChange={(e) => setFormData({ ...formData, locationFound: e.target.value })}
            placeholder="e.g. AB1 E-104 or Canteen Benches"
            className="input w-full"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Detailed Description <span className="text-red-500">*</span></label>
          <textarea
            rows="3"
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe distinguishing features, scratches, stickers, or brand."
            className="input w-full resize-none"
          />
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Registering…' : 'Submit Lost Report'}
          </button>
        </div>
      </form>
    </div>
  )
}
