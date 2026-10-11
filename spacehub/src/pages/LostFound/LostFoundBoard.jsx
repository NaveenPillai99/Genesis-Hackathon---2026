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
} from '../../lib/dataClient'
import { api } from '../../lib/apiClient'
import { fileToResizedDataUrl } from '../../lib/image'

export const LF_CATEGORIES = [
  { id: 'electronics', label: 'Electronics & Gadgets', icon: '💻' },
  { id: 'accessories', label: 'Watches & Accessories', icon: '⌚' },
  { id: 'books', label: 'Books & Stationery', icon: '📚' },
  { id: 'documents', label: 'IDs & Documents', icon: '📄' },
  { id: 'clothing', label: 'Clothing & Apparel', icon: '👕' },
  { id: 'keys', label: 'Keys & Keychains', icon: '🔑' },
  { id: 'bottles', label: 'Water Bottles & Flasks', icon: '🍶' },
  { id: 'bags', label: 'Bags & Backpacks', icon: '🎒' },
  { id: 'other', label: 'Other Miscellaneous', icon: '📦' },
]

export const DEFAULT_DEPARTMENTS = [
  { id: 'dept-cse', name: 'Department of Computer Science & Engineering', code: 'CSE', handler_name: 'Dr Thilaga M (CSE Handler)' },
  { id: 'dept-math', name: 'Department of Mathematics', code: 'MATH', handler_name: 'Dr Devika (Mathematics Handler)' },
  { id: 'dept-ece', name: 'Department of Electronics & Communication', code: 'ECE', handler_name: 'ECE Department Desk' },
  { id: 'dept-mech', name: 'Department of Mechanical Engineering', code: 'MECH', handler_name: 'Mechanical Department Desk' },
  { id: 'dept-welfare', name: 'Office of Student Welfare', code: 'WELFARE', handler_name: 'Ms Priya Balan (Student Welfare Custodian)' },
]

export default function LostFoundBoard() {
  const { user } = useAuth()
  const isHandler = CAN_PROCESS_LOST_FOUND_CLAIMS.has(user?.role)
  const [activeTab, setActiveTab] = useState(isHandler ? 'custody' : 'my-lost')
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS)
  const [rooms, setRooms] = useState([])
  const [timetable, setTimetable] = useState([])
  const [myLostReports, setMyLostReports] = useState([])
  const [myMatches, setMyMatches] = useState([])
  const [handlerCases, setHandlerCases] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals
  const [claimModal, setClaimModal] = useState({ isOpen: false, item: null, proof: '', phone: '' })
  const [handoverModal, setHandoverModal] = useState({ isOpen: false, item: null, notes: '' })
  const [reviewModal, setReviewModal] = useState({ isOpen: false, item: null, claim: null, decision: '', notes: '' })
  
  // Section 6 & 7 Handler Modals: In-Person Verification & Handover, Physical Receipt, Custody Transfer
  const [verificationModal, setVerificationModal] = useState({
    isOpen: false,
    item: null,
    claimantCollegeId: '',
    claimantName: '',
    verificationOutcome: 'id_verified',
    decisionReason: '',
    notes: '',
    submitting: false,
  })

  const [receiptModal, setReceiptModal] = useState({
    isOpen: false,
    item: null,
    storageLocation: '',
    submitting: false,
  })

  const [transferModal, setTransferModal] = useState({
    isOpen: false,
    item: null,
    destinationDepartmentId: 'dept-welfare',
    newStorageLocation: '',
    transferReason: '',
    submitting: false,
  })

  // Match details drawer / modal (Handler only)
  const [matchDetailsModal, setMatchDetailsModal] = useState({
    isOpen: false,
    match: null,
  })

  // Live match candidate pairs loaded from backend (Handler only)
  const [backendMatches, setBackendMatches] = useState([])

  function normalizeItem(i) {
    return {
      ...i,
      id: i.id,
      reportType: i.report_type || i.reportType || 'found',
      title: i.title,
      category: i.category,
      description: i.description,
      locationFound: i.location_found || i.locationFound || '',
      isClassroom: i.is_classroom ?? i.isClassroom ?? false,
      roomId: i.room_id || i.roomId || null,
      foundDate: i.found_date || i.foundDate || '',
      foundTime: i.found_time || i.foundTime || '',
      photoUrl: i.photo_url || i.photoUrl || null,
      finderId: i.finder_id || i.finderId || '',
      finderName: i.finder_name || i.finderName || '',
      finderEmail: i.finder_email || i.finderEmail || '',
      currentCustody: i.current_custody || i.currentCustody || '',
      storageLocation: i.storage_location || i.storageLocation || '',
      assignedHandlerId: i.assigned_handler_id || i.assignedHandlerId || '',
      assignedHandlerName: i.assigned_handler_name || i.assignedHandlerName || '',
      routingReason: i.routing_reason || i.routingReason || '',
      destinationDepartmentId: i.destination_department_id || i.destinationDepartmentId || '',
      destinationDepartmentName: i.destination_department_name || i.destinationDepartmentName || '',
      characteristics: i.characteristics || '',
      privateIdentifyingDetails: i.private_identifying_details || i.privateIdentifyingDetails || '',
      custodyStatus: i.custody_status || i.custodyStatus || i.status || 'reported',
      status: i.status || 'reported',
      verificationStatus: i.verification_status || i.verificationStatus || 'unverified',
      verifiedByName: i.verified_by_name || i.verifiedByName || '',
      claimantCollegeId: i.claimant_college_id || i.claimantCollegeId || '',
      handoverRecipientName: i.handover_recipient_name || i.handoverRecipientName || '',
      returnDate: i.return_date || i.returnDate || null,
      ownerName: i.owner_name || i.ownerName || null,
      ownerStudentId: i.owner_student_id || i.ownerStudentId || null,
      ownerEmail: i.owner_email || i.ownerEmail || null,
      potentialMatches: i.potential_matches || i.potentialMatches || [],
      claims: (i.claims || []).map((c) => ({
        ...c,
        id: c.id,
        claimantId: c.claimant_id || c.claimantId,
        claimantName: c.claimant_name || c.claimantName,
        proofDescription: c.proof_description || c.proofDescription,
        contactPhone: c.contact_phone || c.contactPhone,
        handlerNotes: c.handler_notes || c.handlerNotes,
        status: c.status,
        createdAt: c.created_at || c.createdAt,
      })),
      custodyLogs: i.custody_logs || i.custodyLogs || [],
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      // 1. Fetch departments
      try {
        const depts = await api.getDepartments()
        if (Array.isArray(depts) && depts.length > 0) {
          setDepartments(depts)
        }
      } catch (err) {
        console.warn('Departments fetch fallback:', err)
      }

      // 2. Fetch data based strictly on role permissions
      let allItems = []
      if (isHandler) {
        try {
          const liveItems = await api.getLostFoundItems()
          if (Array.isArray(liveItems)) {
            allItems = liveItems.map(normalizeItem)
          }
        } catch (err) {
          console.warn('Live API items failed, falling back:', err)
          const mockItems = await listLostItems()
          allItems = (mockItems || []).map(normalizeItem)
        }
        setItems(allItems)

        // Fetch Handler Scoped Cases if authorized handler
        try {
          const cases = await api.getHandlerCases()
          if (Array.isArray(cases)) {
            setHandlerCases(cases.map(normalizeItem))
          }
        } catch (err) {
          console.warn('Failed to load handler cases:', err)
        }
      } else {
        // Students NEVER have access to global found items catalogue
        setItems([])
        setHandlerCases([])
      }

      // Fetch My Lost Items (student private dashboard)
      try {
        const myLost = await api.getMyLostItems()
        if (Array.isArray(myLost)) {
          setMyLostReports(myLost)
        }
      } catch (err) {
        console.warn('Failed to load my lost reports:', err)
      }

      // Fetch Owner-Specific Safe Matches (for students)
      if (!isHandler) {
        try {
          const matches = await api.getMyMatches()
          if (Array.isArray(matches)) {
            setMyMatches(matches)
          }
        } catch (err) {
          console.warn('Failed to load student match notifications:', err)
        }
      }

      // 3. Fetch rooms and timetable for classroom resolution
      const [allRooms, allTimetable] = await Promise.all([
        listRooms(),
        listTimetableSlots(),
      ])
      setRooms((allRooms || []).filter((r) => r.type === 'classroom'))
      setTimetable(allTimetable || [])

      // 4. Fetch live matches from matching candidates (HANDLERS ONLY)
      if (isHandler) {
        await loadLiveMatches(allItems)
      } else {
        setBackendMatches([])
      }
    } catch (err) {
      console.error('Failed to load Lost & Found data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadLiveMatches(loadedItems) {
    if (!isHandler) {
      setBackendMatches([])
      return
    }

    const lostReports = loadedItems.filter((i) => i.reportType === 'lost' && i.status !== 'returned' && i.status !== 'closed' && i.status !== 'recovered')
    const matchesCollected = []
    const seenPairs = new Set()

    for (const lost of lostReports) {
      try {
        const res = await api.getMatches(lost.id)
        if (res && Array.isArray(res.matches)) {
          for (const m of res.matches) {
            const pairKey = `${lost.id}__${m.item?.id}`
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey)
              matchesCollected.push({
                candidateId: m.candidate_id,
                lostItem: lost,
                foundItem: normalizeItem(m.item),
                matchScore: m.match_score,
                confidenceLevel: m.confidence_level || (m.match_score >= 85 ? 'HIGH' : m.match_score >= 65 ? 'POSSIBLE' : 'LOW'),
                componentScores: m.component_scores || {},
                reviewStatus: m.review_status,
                lastCalculatedAt: m.last_calculated_at,
              })
            }
          }
        }
      } catch (err) {
        // Fallback or ignore for individual item
      }
    }

  }

  async function handleCancelLostReport(reportId) {
    if (!confirm('Are you sure you want to cancel this lost report?')) return
    try {
      await api.cancelLostReport(reportId)
      alert('Lost item report has been cancelled successfully.')
      loadData()
    } catch (err) {
      alert(err.message || 'Failed to cancel report')
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
    const matchesDept = !selectedDept || item.destinationDepartmentId === selectedDept
    const matchesStatus = !statusFilter || item.status === statusFilter || item.custodyStatus === statusFilter
    const matchesSearch =
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locationFound?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.destinationDepartmentName?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesDept && matchesStatus && matchesSearch
  })

  // Custodian items (Section 6 & 7: Handlers & Student Welfare scoped view)
  const custodianItems = handlerCases.length > 0 ? handlerCases : items.filter((i) => {
    if (user?.role === ROLES.LOST_PROPERTY_HANDLER || user?.role === ROLES.SYS_ADMIN || user?.role === ROLES.RESOURCE_ADMIN) {
      return true
    }
    const userDept = (user?.department || '').toUpperCase()
    if (userDept.includes('MATH') && (i.destinationDepartmentId === 'dept-math' || i.assignedHandlerId === user?.id)) return true
    if ((userDept.includes('COMPUTER') || userDept.includes('CSE') || userDept === 'CS') && (i.destinationDepartmentId === 'dept-cse' || i.assignedHandlerId === user?.id)) return true
    if ((userDept.includes('ELECTRONIC') || userDept.includes('ECE')) && (i.destinationDepartmentId === 'dept-ece' || i.assignedHandlerId === user?.id)) return true
    if ((userDept.includes('MECHANICAL') || userDept.includes('MECH')) && (i.destinationDepartmentId === 'dept-mech' || i.assignedHandlerId === user?.id)) return true
    return i.assignedHandlerId === user?.id
  })

  // ---------------- Handlers for Claim / Verification / Transfer ----------------
  async function handleClaimSubmit(e) {
    e.preventDefault()
    if (!claimModal.item || !claimModal.proof.trim()) return
    try {
      await api.submitClaim(claimModal.item.id, {
        claimant_id: user.id,
        claimant_name: user.name,
        proof_description: claimModal.proof,
        contact_phone: claimModal.phone,
      })
      alert('Claim submitted successfully! The assigned department custodian will review your proof.')
      setClaimModal({ isOpen: false, item: null, proof: '', phone: '' })
      loadData()
    } catch (err) {
      alert(err.message || 'Failed to submit claim')
    }
  }

  async function handleInPersonVerification(e) {
    e.preventDefault()
    if (!verificationModal.item) return
    if (!verificationModal.claimantCollegeId.trim() || !verificationModal.claimantName.trim()) {
      alert('Valid College ID Card number and Claimant Name are mandatory for ownership release.')
      return
    }

    setVerificationModal((prev) => ({ ...prev, submitting: true }))
    try {
      const isPass = verificationModal.verificationOutcome === 'id_verified' || verificationModal.verificationOutcome === 'passed'
      await api.verifyItemInPerson(verificationModal.item.id, {
        claimant_college_id: verificationModal.claimantCollegeId,
        claimant_name: verificationModal.claimantName,
        verification_outcome: isPass ? 'passed' : 'failed',
        verification_notes: verificationModal.notes || `In-person verification conducted by ${user.name} at ${verificationModal.item.destinationDepartmentName || 'Department'}. Valid College ID checked.`,
        decision_reason: verificationModal.decisionReason || (isPass ? 'Physical inspection and College ID card verification confirmed ownership.' : 'Verification failed or claimant identity mismatch.'),
      })

      if (isPass) {
        alert(`Success! Ownership verified using College ID (${verificationModal.claimantCollegeId}). Physical item released to ${verificationModal.claimantName}. Associated lost report marked RECOVERED.`)
      } else {
        alert(`Verification failed! Item retained in department custody. Record logged for audit review.`)
      }

      setVerificationModal({
        isOpen: false,
        item: null,
        claimantCollegeId: '',
        claimantName: '',
        verificationOutcome: 'id_verified',
        decisionReason: '',
        notes: '',
        submitting: false,
      })
      loadData()
    } catch (err) {
      alert(err.message || 'Ownership verification failed')
      setVerificationModal((prev) => ({ ...prev, submitting: false }))
    }
  }

  async function handleConfirmPhysicalReceipt(e) {
    e.preventDefault()
    if (!receiptModal.item) return
    setReceiptModal((prev) => ({ ...prev, submitting: true }))
    try {
      await api.receivePhysicalHandover(receiptModal.item.id, {
        storage_location: receiptModal.storageLocation || 'Department Custody Locker Room',
        custodian_notes: `Physical item received and verified into department custody by ${user.name}.`,
      })
      alert('Physical item receipt confirmed! Status updated to IN CUSTODY.')
      setReceiptModal({ isOpen: false, item: null, storageLocation: '', submitting: false })
      loadData()
    } catch (err) {
      alert(err.message || 'Failed to record receipt')
      setReceiptModal((prev) => ({ ...prev, submitting: false }))
    }
  }

  async function handleTransferCustody(e) {
    e.preventDefault()
    if (!transferModal.item) return
    setTransferModal((prev) => ({ ...prev, submitting: true }))
    try {
      await api.transferCustody(transferModal.item.id, {
        destination_department_id: transferModal.destinationDepartmentId,
        storage_location: transferModal.newStorageLocation || 'Department Inward Desk',
        transfer_reason: transferModal.transferReason || 'Inter-departmental handover as per campus jurisdictional policy.',
      })
      alert('Custody transferred successfully! The target department handler has been notified.')
      setTransferModal({
        isOpen: false,
        item: null,
        destinationDepartmentId: 'dept-welfare',
        newStorageLocation: '',
        transferReason: '',
        submitting: false,
      })
      loadData()
    } catch (err) {
      alert(err.message || 'Transfer failed')
      setTransferModal((prev) => ({ ...prev, submitting: false }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🏛️</span>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-300">
              CampusConnect Cross-Department Module
            </span>
            <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 border border-emerald-500/30">
              Cross-Dept Engine Active
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Lost &amp; Found Item Matching System
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Multi-department custody routing, transparent 6-factor similarity matching, private owner alerts, and mandatory in-person College ID card verification.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
          <div className="text-right">
            <div className="text-[11px] text-slate-300 font-medium">Logged in as</div>
            <div className="text-xs font-bold text-white">{user?.name}</div>
            <div className="text-[10px] text-brand-200 uppercase">{user?.role?.replace('_', ' ')} · {user?.department || 'Campus'}</div>
          </div>
        </div>
      </div>

      {/* Synthetic Scenario Demonstration Banner */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-sky-50/50 to-indigo-50/90 p-4 text-xs shadow-xs text-indigo-950">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="text-xl shrink-0 mt-0.5">💡</span>
            <div className="space-y-1">
              <span className="font-extrabold text-sm text-indigo-900 block">
                Synthetic Demonstration Case: AirPods Match Across Departments (AB3 ➔ CSE)
              </span>
              <p className="text-indigo-800 leading-relaxed text-[11px]">
                <strong>Scenario:</strong> A student found <em>White AirPods</em> in AB3 corridor and routed them to the <strong>CSE Department</strong>. Another student (<em>Rohan Gupta</em>) reported losing <em>White AirPods</em> in AB3. The Cross-Department Matching Engine linked them with <strong>88.1% High Confidence</strong>, notifying both parties. The CSE Handler verifies the claimant&apos;s College ID in person before releasing the item.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab(isHandler ? 'matches' : 'my-lost')}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-xs transition-colors"
          >
            {isHandler ? 'View Live Match Candidates ➔' : 'View My Lost Reports ➔'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1 text-sm font-semibold scrollbar-none">
        {isHandler ? (
          <>
            <button
              onClick={() => setActiveTab('custody')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
                activeTab === 'custody'
                  ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>🛡️</span>
              <span>Department Case Console ({custodianItems.length})</span>
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
              <span>Match Candidates &amp; Factor Breakdown ({backendMatches.length})</span>
              {backendMatches.some((m) => m.confidenceLevel === 'HIGH') && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
                activeTab === 'browse'
                  ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>📦</span>
              <span>Department Inventory ({custodianItems.length})</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('my-lost')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
                activeTab === 'my-lost'
                  ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>📋</span>
              <span>My Lost Reports ({myLostReports.length})</span>
              {(myMatches.length > 0 || myLostReports.some((r) => r.has_potential_match || r.status === 'potential_match')) && (
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              )}
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('report-lost')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap ${
            activeTab === 'report-lost'
              ? 'border-b-2 border-brand-600 text-brand-700 bg-brand-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>🔍</span>
          <span>Report Lost Item (Cross-Dept)</span>
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
          <span>Report Found Item (Dept Routing)</span>
        </button>
      </div>

      {/* ---------------- TAB 1: DEPARTMENT INVENTORY (AUTHORIZED HANDLERS ONLY) ---------------- */}
      {activeTab === 'browse' && isHandler && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <input
              type="text"
              placeholder="Search by keyword, location, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input text-xs"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input text-xs"
            >
              <option value="">All Categories</option>
              {LF_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="input text-xs"
            >
              <option value="">All Receiving Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.department_name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input text-xs"
            >
              <option value="">All Custody Statuses</option>
              <option value="reported">Reported (Awaiting Handover)</option>
              <option value="in_custody">In Custody</option>
              <option value="claim_pending">Claim Pending Review</option>
              <option value="returned">Returned / Handed Over</option>
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
                  awaiting_handover: 'bg-amber-50 text-amber-800 border-amber-200',
                  in_custody: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                  claim_pending: 'bg-purple-50 text-purple-800 border-purple-200',
                  returned: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                }[item.custodyStatus] || {
                  reported: 'bg-blue-50 text-blue-800 border-blue-200',
                  in_custody: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                  claim_pending: 'bg-purple-50 text-purple-800 border-purple-200',
                  returned: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                }[item.status] || 'bg-slate-100 text-slate-700'

                const isReturned = item.status === 'returned' || item.custodyStatus === 'returned'

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                  >
                    <div>
                      {/* Photo / Icon Header */}
                      <div className="relative mb-3 h-40 w-full overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center border border-slate-100">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-5xl">
                            {LF_CATEGORIES.find((c) => c.id === item.category)?.icon || '📦'}
                          </span>
                        )}
                        <span
                          className={`absolute top-2 right-2 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}
                        >
                          {item.custodyStatus === 'awaiting_handover' || item.status === 'reported' ? 'Awaiting Handover' : item.custodyStatus === 'in_custody' ? 'In Custody' : item.status?.replace('_', ' ')}
                        </span>
                        {item.destinationDepartmentName && (
                          <span className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5">
                            🏛️ {item.destinationDepartmentName.split(' ')[0]} {item.destinationDepartmentName.split(' ')[1] || ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 text-base leading-snug">
                          {item.title}
                        </h3>
                      </div>
                      
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="my-3 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">📍</span>
                          <span className="font-semibold text-slate-700 truncate">{item.locationFound}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">🏛️</span>
                          <span className="truncate">Destination: <strong>{item.destinationDepartmentName || item.assignedHandlerName || 'Central Student Welfare'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">🏢</span>
                          <span className="truncate">Storage Desk: {item.storageLocation || 'Department Inward Counter'}</span>
                        </div>
                      </div>

                      {/* Transparent Routing Rationale */}
                      {item.routingReason && (
                        <div className="rounded-lg bg-brand-50/60 border border-brand-100 p-2 text-[11px] text-brand-900 mb-2">
                          <span className="font-bold block text-[10px] uppercase text-brand-700">
                            Custody Destination Rationale:
                          </span>
                          {item.routingReason}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        Found: {item.foundDate} {item.foundTime ? `· ${item.foundTime}` : ''}
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
                          ✓ Handed Over &amp; Closed
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

      {/* ---------------- TAB 1.5: MY LOST ITEMS (STUDENT PRIVATE DASHBOARD) ---------------- */}
      {activeTab === 'my-lost' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <h2 className="text-lg font-bold text-slate-900">My Lost Item Reports</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Private dashboard showing only your submitted lost item reports and verified match notifications.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('report-lost')}
              className="btn-primary text-xs !py-1.5 !px-3 self-start md:self-auto"
            >
              + Report Another Lost Item
            </button>
          </div>

          {myLostReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 shadow-xs space-y-3">
              <span className="text-4xl block mb-2">🔍</span>
              <h3 className="text-base font-bold text-slate-800">No Lost Item Reports Active</h3>
              <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                You have not reported a lost item yet. Submit a lost-item report to receive private notifications if a matching found item is reported.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('report-lost')}
                  className="btn-primary !py-2 !px-4 text-sm font-semibold"
                >
                  + Submit a Lost-Item Report
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section 4: Private Possible Matches Section */}
              {myMatches && myMatches.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔔</span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Private Possible Matches ({myMatches.length})
                    </h3>
                  </div>
                  <div className="grid gap-3.5 md:grid-cols-2">
                    {myMatches.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-50/90 p-5 shadow-xs space-y-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔔</span>
                            <div>
                              <span className="font-extrabold text-amber-950 text-base block">
                                Possible Match Found
                              </span>
                              <span className="text-[11px] font-mono text-amber-800 font-medium">
                                Ref: {m.match_reference_number}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-amber-200 text-amber-900 border border-amber-300">
                            Potential Match
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="bg-white/80 p-3 rounded-xl border border-amber-200">
                            <div className="text-[11px] text-slate-500 font-medium">Your Lost Report Reference:</div>
                            <div className="font-bold text-slate-900 text-sm mt-0.5">{m.lost_item_title}</div>
                          </div>

                          <div className="p-3.5 bg-white/90 rounded-xl border border-amber-200 space-y-2">
                            <p className="text-amber-950 font-medium leading-relaxed">
                              &ldquo;{m.message}&rdquo;
                            </p>
                            <p className="text-slate-800 leading-relaxed">
                              &ldquo;{m.collection_instructions}&rdquo;
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-amber-900/90 pt-1">
                            <span>Receiving Office: <strong>{m.receiving_department}</strong></span>
                            <span>Notified: {m.notification_date ? new Date(m.notification_date).toLocaleDateString() : 'Recent'}</span>
                          </div>

                          <div className="text-[10px] text-slate-500 bg-amber-100/70 p-2.5 rounded-lg leading-relaxed">
                            ⚠️ <strong>Private Verification Protocol:</strong> This notification indicates a potential similarity across campus departments. It is not definitive proof of ownership. Full found item descriptions and photographs remain strictly confidential. Please visit the indicated office in person with your College ID card to establish ownership.
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* My Lost Reports Grid */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Your Active Lost Reports ({myLostReports.length})
                  </h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {myLostReports.map((report) => {
                    const isCancelled = report.status === 'cancelled'
                    const isRecovered = report.status === 'recovered' || report.status === 'returned'
                    const hasMatch = report.has_potential_match || report.status === 'potential_match'

                    const statusTone = isRecovered
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : isCancelled
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : hasMatch
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'

                    return (
                      <div
                        key={report.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs text-slate-400 font-medium">
                                Reported on {report.found_date || (report.created_at ? new Date(report.created_at).toLocaleDateString() : 'Recent')}
                              </span>
                              <h3 className="font-bold text-slate-900 text-base mt-0.5">
                                {report.title}
                              </h3>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${statusTone}`}>
                              {hasMatch && !isRecovered && !isCancelled
                                ? 'Potential match identified'
                                : report.status?.replace('_', ' ')}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {report.description}
                          </p>

                          {report.location_found && (
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                              <span>📍</span>
                              <span>Last known location: <strong>{report.location_found}</strong></span>
                            </div>
                          )}

                          {/* Safe Student Potential Match Notification (Section 4 & 5) */}
                          {hasMatch && !isRecovered && !isCancelled && (
                            <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3.5 text-xs text-amber-950 space-y-2">
                              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                <span>🔔</span>
                                <span>Possible Lost Item Match</span>
                              </div>
                              <p className="text-amber-900 text-[11px] leading-relaxed">
                                A found item with a similar description to your lost-item report has been submitted to the{' '}
                                <strong>{report.potential_match_dept || 'Department Office'}</strong>.
                              </p>
                              <p className="text-amber-800 text-[11px] leading-relaxed">
                                <strong>Next step:</strong> Please visit the <strong>{report.potential_match_dept || 'department'}</strong> office with your{' '}
                                <strong>college ID card</strong> to verify ownership and collect the item if it is confirmed to be yours.
                              </p>
                              <div className="text-[10px] text-amber-800/80 bg-amber-100/70 p-2 rounded-lg font-medium">
                                The department will verify your identity before releasing the item.
                              </div>
                            </div>
                          )}

                          {isRecovered && (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-center gap-2">
                              <span className="text-base">✓</span>
                              <span>Item ownership successfully verified and collected. Case closed.</span>
                            </div>
                          )}

                          {isCancelled && (
                            <div className="rounded-xl bg-slate-100 border border-slate-200 p-2.5 text-xs text-slate-600">
                              This lost report was cancelled by you and excluded from active matching.
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {!isRecovered && !isCancelled && (
                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">
                              Active scanning across all configured departments
                            </span>
                            <button
                              onClick={() => handleCancelLostReport(report.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 border border-red-200 transition-colors"
                            >
                              Cancel Report
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 2: REPORT FOUND ITEM (WITH DESTINATION ROUTING) ---------------- */}
      {activeTab === 'report-found' && (
        <ReportFoundForm
          departments={departments}
          rooms={rooms}
          timetable={timetable}
          user={user}
          onSuccess={() => {
            setActiveTab(isHandler ? 'browse' : 'my-lost')
            loadData()
          }}
        />
      )}

      {/* ---------------- TAB 3: REPORT LOST ITEM (CROSS-DEPARTMENT) ---------------- */}
      {activeTab === 'report-lost' && (
        <ReportLostForm
          user={user}
          onSuccess={() => {
            setActiveTab(isHandler ? 'matches' : 'my-lost')
            loadData()
          }}
        />
      )}

      {/* ---------------- TAB 4: SMART MATCHES (AUTHORIZED HANDLERS ONLY) ---------------- */}
      {activeTab === 'matches' && isHandler && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-4 text-xs text-indigo-950 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-1.5 text-indigo-900">
                <span>🎯</span>
                <span>Cross-Department Matching Engine &amp; Weighted Scoring</span>
              </span>
              <span className="rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-bold px-2 py-0.5">
                Configurable Transparent Weights
              </span>
            </div>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              Every lost report is automatically evaluated against found reports across all campus departments.
              Similarity uses 6 transparent factors: <strong>Category Agreement (15%)</strong>, <strong>Name &amp; Description (30%)</strong>, <strong>Characteristics/Brand (20%)</strong>, <strong>Location Compatibility (15%)</strong>, <strong>Time Proximity (15%)</strong>, and <strong>Photo Similarity (5%)</strong>.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="bg-emerald-100/70 border border-emerald-200 rounded-lg p-2 text-emerald-950">
                <span className="font-bold block">85–100%: High Confidence</span>
                Automatic private notification to owner and department handler.
              </div>
              <div className="bg-amber-100/70 border border-amber-200 rounded-lg p-2 text-amber-950">
                <span className="font-bold block">65–84%: Possible Match</span>
                Presented privately for owner and department handler review.
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 text-slate-700">
                <span className="font-bold block">&lt; 65%: Low Match</span>
                No automatic notification. Retained for search reference.
              </div>
            </div>
          </div>

          {backendMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
              <span className="text-4xl block mb-2">✨</span>
              No active cross-department matches detected at this moment. Submit a lost or found report to run the engine.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {backendMatches.map((pair, idx) => {
                const confTone = pair.confidenceLevel === 'HIGH'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : pair.confidenceLevel === 'POSSIBLE'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'

                const comp = pair.componentScores || {}

                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                          Match Candidate #{idx + 1}
                        </span>
                        <div className="text-xs text-slate-500 font-medium">
                          Cross-Department Discovery
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black uppercase ${confTone}`}>
                          {pair.confidenceLevel} · {pair.matchScore}%
                        </span>
                      </div>
                    </div>

                    {/* Pair Comparison */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Lost Report Box */}
                      <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-700 text-[10px] uppercase">
                            Lost Report (Owner Private)
                          </span>
                          <span className="text-[10px] text-rose-600 font-medium">ID: {pair.lostItem.id}</span>
                        </div>
                        <strong className="text-slate-900 block text-sm">{pair.lostItem.title}</strong>
                        <div className="text-slate-600 text-[11px]">
                          <strong>Last seen:</strong> {pair.lostItem.locationFound}
                        </div>
                        {pair.lostItem.characteristics && (
                          <div className="text-slate-500 text-[11px]">
                            <strong>Characteristics:</strong> {pair.lostItem.characteristics}
                          </div>
                        )}
                        <p className="text-slate-600 text-[11px] line-clamp-2 mt-1">
                          {pair.lostItem.description}
                        </p>
                      </div>

                      {/* Found Item Box */}
                      <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-700 text-[10px] uppercase">
                            Found Item (In Custody)
                          </span>
                          <span className="text-[10px] text-emerald-600 font-medium">ID: {pair.foundItem.id}</span>
                        </div>
                        <strong className="text-slate-900 block text-sm">{pair.foundItem.title}</strong>
                        <div className="text-slate-600 text-[11px]">
                          <strong>Found at:</strong> {pair.foundItem.locationFound}
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          <strong>Department Desk:</strong> {pair.foundItem.destinationDepartmentName || 'Student Welfare'}
                        </div>
                        <p className="text-slate-600 text-[11px] line-clamp-2 mt-1">
                          {pair.foundItem.description}
                        </p>
                      </div>
                    </div>

                    {/* Multi-Factor Score Breakdown */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-700 text-[11px]">
                        <span>Transparent Weighted Factor Breakdown</span>
                        <span className="text-brand-600 font-extrabold">{pair.matchScore}% Total</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600">
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block">Category (15%)</span>
                          <strong className="text-slate-800">{comp.category_score ?? 15} pts</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block">Description (30%)</span>
                          <strong className="text-slate-800">{comp.text_similarity_score ?? 20} pts</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block">Brand &amp; Color (20%)</span>
                          <strong className="text-slate-800">{comp.characteristics_score ?? 20} pts</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block">Location (15%)</span>
                          <strong className="text-slate-800">{comp.location_score ?? 15} pts</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block">Time Proximity (15%)</span>
                          <strong className="text-slate-800">{comp.time_proximity_score ?? 15} pts</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block">Photo (5%)</span>
                          <strong className="text-slate-800">{comp.photo_score ?? 0} pts</strong>
                        </div>
                      </div>

                      {/* Matched Attributes Tags */}
                      {comp.matched_attributes && comp.matched_attributes.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] font-bold text-slate-500">Matched Tokens:</span>
                          {comp.matched_attributes.map((attr, aIdx) => (
                            <span key={aIdx} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              ✓ {attr}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Disclaimer & Actions */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="text-[11px] text-slate-400 leading-tight">
                        ⚠️ <em>Similarity only — algorithm never authorizes automatic handover. Mandatory College ID verification required.</em>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setMatchDetailsModal({ isOpen: true, match: pair })}
                          className="btn-secondary !py-1 !px-2.5 text-xs"
                        >
                          View Collection Instructions
                        </button>

                        {isHandler ? (
                          <button
                            onClick={() => {
                              setVerificationModal({
                                isOpen: true,
                                item: pair.foundItem,
                                claimantCollegeId: pair.lostItem.finderId === 'user-student-2' ? 'CB.EN.U4CSE22045' : '',
                                claimantName: pair.lostItem.finderName || '',
                                verificationOutcome: 'id_verified',
                                decisionReason: `College ID verified for matching lost report ${pair.lostItem.id} (${pair.lostItem.title}).`,
                                notes: `In-person ID verification conducted at ${pair.foundItem.destinationDepartmentName || 'Department Desk'}. Private identifying clues matched.`,
                                submitting: false,
                              })
                            }}
                            className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !py-1 !px-2.5 text-xs"
                          >
                            🪪 Verify ID &amp; Release
                          </button>
                        ) : (
                          <button
                            onClick={() => setClaimModal({ isOpen: true, item: pair.foundItem, proof: '', phone: '' })}
                            className="btn-primary !py-1 !px-2.5 text-xs"
                          >
                            Claim Item
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 5: DEPARTMENT CUSTODIAN PANEL (SECTION 6) ---------------- */}
      {activeTab === 'custody' && isHandler && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🛡️</span>
                <h2 className="text-lg font-bold text-slate-900">
                  Authorized Department Custodian &amp; Handover Console
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage found items routed to your department, confirm physical custody receipt, execute in-person College ID verification, or transfer custody.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-brand-50 text-brand-800 font-bold px-3 py-1.5 rounded-xl border border-brand-200">
                Jurisdiction: {user?.department || 'Student Welfare / Campus-Wide'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {custodianItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
                <span className="text-4xl block mb-2">📋</span>
                No items currently assigned to or routed to your department jurisdiction.
              </div>
            ) : (
              custodianItems.map((item) => {
                const isAwaitingHandover = item.custodyStatus === 'awaiting_handover' || item.status === 'reported'
                const isReturned = item.status === 'returned' || item.custodyStatus === 'returned'

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-base">{item.title}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                            isAwaitingHandover
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isReturned
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}>
                            {isAwaitingHandover ? 'Awaiting Physical Handover' : item.custodyStatus?.replace('_', ' ') || item.status}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            ID: {item.id}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500">
                          Found at <strong>{item.locationFound}</strong> · Receiving Dept: <strong>{item.destinationDepartmentName || item.assignedHandlerName}</strong> · Storage: <strong>{item.storageLocation || 'Awaiting Placement'}</strong>
                        </p>

                        {/* Authorized Handler Case Scope Data (Requirement 7) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Finder Details</span>
                            <span className="font-semibold text-slate-800">{item.finderName || 'Anonymous Finder'}</span>
                            {item.finderEmail && <span className="text-slate-500 block text-[11px] font-mono">{item.finderEmail}</span>}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Registered Institutional Owner</span>
                            {item.ownerStudentId || item.ownerName ? (
                              <div>
                                <span className="font-bold text-slate-900">{item.ownerName}</span>
                                <span className="text-brand-700 block text-[11px] font-mono font-bold">ID: {item.ownerStudentId}</span>
                                {item.ownerEmail && <span className="text-slate-500 block text-[11px]">{item.ownerEmail}</span>}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Pending claimant in-person presentation</span>
                            )}
                          </div>
                        </div>

                        {item.characteristics && (
                          <div className="text-[11px] text-slate-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                            <strong>Characteristics:</strong> {item.characteristics}
                          </div>
                        )}

                        {item.privateIdentifyingDetails && (
                          <div className="text-[11px] text-indigo-900 bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
                            <strong>Private Verification Clues:</strong> {item.privateIdentifyingDetails}
                          </div>
                        )}

                        <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-start">
                        {isAwaitingHandover && (
                          <button
                            onClick={() => {
                              setReceiptModal({
                                isOpen: true,
                                item,
                                storageLocation: `Department Custody Desk (${item.destinationDepartmentName || 'AB3'})`,
                                submitting: false,
                              })
                            }}
                            className="btn-primary !bg-amber-600 hover:!bg-amber-700 text-xs !py-1.5 !px-3 shadow-xs"
                          >
                            📥 Confirm Physical Receipt
                          </button>
                        )}

                        {!isReturned && !isAwaitingHandover && (
                          <>
                            <button
                              onClick={() => {
                                setVerificationModal({
                                  isOpen: true,
                                  item,
                                  claimantCollegeId: '',
                                  claimantName: '',
                                  verificationOutcome: 'id_verified',
                                  decisionReason: 'Physical College ID card presented and verified. Device characteristics matched.',
                                  notes: `In-person verification performed at ${item.destinationDepartmentName || 'Department Desk'} by ${user.name}.`,
                                  submitting: false,
                                })
                              }}
                              className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 text-xs !py-1.5 !px-3 shadow-xs"
                            >
                              🪪 Verify ID &amp; Release Item
                            </button>

                            <button
                              onClick={() => {
                                setTransferModal({
                                  isOpen: true,
                                  item,
                                  destinationDepartmentId: 'dept-welfare',
                                  newStorageLocation: 'Student Welfare Locker Room',
                                  transferReason: 'Inter-departmental handover to Central Student Welfare.',
                                  submitting: false,
                                })
                              }}
                              className="btn-secondary text-xs !py-1.5 !px-2.5"
                            >
                              🔄 Transfer
                            </button>
                          </>
                        )}

                        {isReturned && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                            ✓ Returned to {item.handoverRecipientName || 'Owner'} (ID: {item.claimantCollegeId || 'Verified'})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Custody History & Verification Audit Logs */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                        <span>Custody Audit Trail &amp; Claims ({item.custodyLogs?.length || 0} logs)</span>
                      </div>

                      {item.custodyLogs && item.custodyLogs.length > 0 && (
                        <div className="space-y-1.5">
                          {item.custodyLogs.map((log, lIdx) => (
                            <div key={lIdx} className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                              <span className="text-slate-700">
                                <strong className="uppercase font-semibold text-slate-900">{log.action}:</strong> {log.notes}
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                {new Date(log.timestamp || log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Claims on this item */}
                      {item.claims && item.claims.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <span className="font-bold text-slate-700 text-xs block">Claims Filed:</span>
                          {item.claims.map((claim) => (
                            <div
                              key={claim.id}
                              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs flex flex-col sm:flex-row justify-between gap-3"
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
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ---------------- SECTION 7: IN-PERSON COLLEGE ID VERIFICATION MODAL ---------------- */}
      {verificationModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🪪</span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    In-Person Ownership Verification &amp; Release
                  </h3>
                  <p className="text-xs text-slate-500">
                    Department Handover Protocol (Item: {verificationModal.item?.title})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVerificationModal({ ...verificationModal, isOpen: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <span className="font-bold block text-amber-950">Institutional Verification Policy:</span>
              <p className="text-[11px] leading-relaxed">
                The claimant must present their <strong>physical College ID Card</strong> before custody is released. Never authorize a handover based on matching score alone.
              </p>
            </div>

            {/* Private Identifying Details Helper */}
            {verificationModal.item?.privateIdentifyingDetails && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">
                  Confidential Verification Clues (From Lost Report):
                </span>
                <p className="text-slate-600 text-[11px]">
                  {verificationModal.item.privateIdentifyingDetails}
                </p>
              </div>
            )}

            <form onSubmit={handleInPersonVerification} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Claimant College ID Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={verificationModal.claimantCollegeId}
                    onChange={(e) => setVerificationModal({ ...verificationModal, claimantCollegeId: e.target.value })}
                    placeholder="e.g. CB.EN.U4CSE22045"
                    className="input w-full font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Claimant Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={verificationModal.claimantName}
                    onChange={(e) => setVerificationModal({ ...verificationModal, claimantName: e.target.value })}
                    placeholder="e.g. Rohan Gupta"
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Verification Decision Outcome <span className="text-red-500">*</span>
                </label>
                <select
                  value={verificationModal.verificationOutcome}
                  onChange={(e) => setVerificationModal({ ...verificationModal, verificationOutcome: e.target.value })}
                  className="input w-full"
                >
                  <option value="id_verified">✓ Physical College ID Verified &amp; Ownership Confirmed (Authorize Release)</option>
                  <option value="verification_failed">✗ Verification Failed / Inconclusive (Retain in Custody)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Handover Verification Reason &amp; Checks Conducted
                </label>
                <input
                  type="text"
                  value={verificationModal.decisionReason}
                  onChange={(e) => setVerificationModal({ ...verificationModal, decisionReason: e.target.value })}
                  placeholder="e.g. Verified photo on College ID matches claimant; correctly described headphone case stickers."
                  className="input w-full"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Audit Notes (Logged to Permanent Institutional Record)
                </label>
                <textarea
                  rows="2"
                  value={verificationModal.notes}
                  onChange={(e) => setVerificationModal({ ...verificationModal, notes: e.target.value })}
                  placeholder="e.g. Handover executed in AB3 Room 204. Claimant signed receipt ledger."
                  className="input w-full resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerificationModal({ ...verificationModal, isOpen: false })}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verificationModal.submitting}
                  className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
                >
                  {verificationModal.submitting ? 'Executing Release…' : '✓ Confirm ID & Release Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- CONFIRM PHYSICAL RECEIPT MODAL ---------------- */}
      {receiptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              Confirm Physical Receipt into Custody
            </h3>
            <p className="text-xs text-slate-500">
              Confirm that the physical item has arrived at your department desk and record the designated storage locker location.
            </p>
            <form onSubmit={handleConfirmPhysicalReceipt} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Storage Location / Shelf Details <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={receiptModal.storageLocation}
                  onChange={(e) => setReceiptModal({ ...receiptModal, storageLocation: e.target.value })}
                  placeholder="e.g. AB3 Room 204 Cabinet Shelf 2"
                  className="input w-full"
                />
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptModal({ ...receiptModal, isOpen: false })}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receiptModal.submitting}
                  className="btn-primary !bg-amber-600 hover:!bg-amber-700"
                >
                  {receiptModal.submitting ? 'Updating…' : 'Confirm Custody Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- CUSTODY TRANSFER MODAL ---------------- */}
      {transferModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              Transfer Item Custody to Another Department
            </h3>
            <p className="text-xs text-slate-500">
              Reroute physical custody of this item to another configured department or Student Welfare.
            </p>
            <form onSubmit={handleTransferCustody} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Target Receiving Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferModal.destinationDepartmentId}
                  onChange={(e) => setTransferModal({ ...transferModal, destinationDepartmentId: e.target.value })}
                  className="input w-full"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason for Transfer</label>
                <input
                  type="text"
                  value={transferModal.transferReason}
                  onChange={(e) => setTransferModal({ ...transferModal, transferReason: e.target.value })}
                  placeholder="e.g. Item belongs to Mathematics student; transferring to Math block."
                  className="input w-full"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">New Storage Location</label>
                <input
                  type="text"
                  value={transferModal.newStorageLocation}
                  onChange={(e) => setTransferModal({ ...transferModal, newStorageLocation: e.target.value })}
                  placeholder="e.g. Mathematics Department Inward Desk"
                  className="input w-full"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferModal({ ...transferModal, isOpen: false })}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferModal.submitting}
                  className="btn-primary"
                >
                  {transferModal.submitting ? 'Transferring…' : 'Transfer Custody'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- COLLECTION INSTRUCTIONS MODAL (SECTION 5) ---------------- */}
      {matchDetailsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Possible Match Collection Instructions
              </h3>
              <button
                onClick={() => setMatchDetailsModal({ isOpen: false, match: null })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-brand-50 rounded-xl border border-brand-100 space-y-1">
                <span className="font-bold text-brand-900 block text-xs">
                  Assigned Receiving Department:
                </span>
                <p className="text-brand-800 font-semibold text-sm">
                  {matchDetailsModal.match?.foundItem?.destinationDepartmentName || 'Office of Student Welfare'}
                </p>
                <p className="text-slate-600 text-[11px]">
                  Physical Storage: {matchDetailsModal.match?.foundItem?.storageLocation || 'Department Inward Desk'}
                </p>
              </div>

              <div className="space-y-1.5 text-slate-700">
                <span className="font-bold text-slate-900 block">Required for Collection:</span>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11px]">
                  <li>Bring your valid physical <strong>College ID Card</strong>.</li>
                  <li>Visit the department handler during designated office hours.</li>
                  <li>Be prepared to provide specific identifying characteristics (e.g. device unlock PIN, scratches, engravings, wallpaper).</li>
                </ul>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500">
                Notice: This potential match notification does not confirm ownership or guarantee release. Handover is authorized only upon verified in-person inspection.
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setMatchDetailsModal({ isOpen: false, match: null })}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- CLAIM SUBMISSION MODAL ---------------- */}
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
                  placeholder="e.g. Serial number, scratches on the case, stickers, student roll number written on page 1."
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
    </div>
  )
}

// ---------------- SUBCOMPONENT: REPORT FOUND FORM (WITH DESTINATION ROUTING) ----------------
function ReportFoundForm({ departments, rooms, timetable, user, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'electronics',
    description: '',
    locationFound: 'AB3',
    specificLocation: 'Floor 2, Corridor near window',
    isClassroom: false,
    roomId: rooms[0]?.id || 'room-ab1-e104',
    foundDate: new Date().toISOString().slice(0, 10),
    foundTime: '11:15',
    destinationDepartmentId: 'dept-cse',
    isPhysicallyHandedOver: false,
    storageLocation: 'AB3 Room 204 Custodian Desk',
    additionalNotes: '',
    photoUrl: null,
  })
  const [submitting, setSubmitting] = useState(false)

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
      const selectedDept = departments.find((d) => d.id === formData.destinationDepartmentId)
      const fullLocation = formData.isClassroom
        ? `${rooms.find((r) => r.id === formData.roomId)?.name || formData.roomId} (${formData.specificLocation || 'Classroom'})`
        : `${formData.locationFound}${formData.specificLocation ? ` - ${formData.specificLocation}` : ''}`

      const payload = {
        report_type: 'found',
        title: formData.title,
        category: formData.category,
        description: formData.description,
        location_found: fullLocation,
        is_classroom: formData.isClassroom,
        room_id: formData.isClassroom ? formData.roomId : null,
        found_date: formData.foundDate,
        found_time: formData.foundTime,
        destination_department_id: formData.destinationDepartmentId,
        destination_department_name: selectedDept?.name || selectedDept?.department_name || 'Department Desk',
        is_physically_handed_over: formData.isPhysicallyHandedOver,
        storage_location: formData.storageLocation,
        additional_notes: formData.additionalNotes,
        photo_url: formData.photoUrl,
      }

      const res = await api.reportItem(payload)
      alert(`Found item report submitted successfully! \n\nFound Item ID: ${res.id}\nRouting Destination: ${res.destination_department_name || 'Department Desk'}\nInitial Status: ${res.status.toUpperCase()}\n\nThe Cross-Department Matching Engine is now comparing this report with active lost items.`)
      onSuccess()
    } catch (err) {
      alert(err.message || 'Report submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Report a Found Item (With Department Routing)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Route the found item to a designated department desk or Student Welfare. Matching runs across all campus departments.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Item Title & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="font-semibold text-slate-700 block mb-1">
              Item Name / Short Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. AirPods, Scientific Calculator, Casio Watch"
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Category <span className="text-red-500">*</span></label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input w-full"
            >
              {LF_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            General Description <span className="text-red-500">*</span>
          </label>
          <textarea
            rows="3"
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g. White wireless earbuds in a charging case found on window sill."
            className="input w-full resize-none"
          />
        </div>

        {/* Location Found */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <span className="font-bold text-slate-800 block text-xs">Location Details</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 block mb-1">Campus Building / Zone <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.locationFound}
                onChange={(e) => setFormData({ ...formData, locationFound: e.target.value })}
                placeholder="e.g. AB3, AB1, Central Library, Canteen"
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Specific Location (Floor, Room, Corridor)</label>
              <input
                type="text"
                value={formData.specificLocation}
                onChange={(e) => setFormData({ ...formData, specificLocation: e.target.value })}
                placeholder="e.g. 2nd Floor Corridor, Window sill near Room 204"
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-slate-600 block mb-1">Date Found</label>
              <input
                type="date"
                value={formData.foundDate}
                onChange={(e) => setFormData({ ...formData, foundDate: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Approximate Time Found</label>
              <input
                type="time"
                value={formData.foundTime}
                onChange={(e) => setFormData({ ...formData, foundTime: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Destination Department Selector (Section 2 Core User Workflow) */}
        <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-indigo-950 block text-xs">
              🏛️ Handover Destination Department Selector
            </span>
            <span className="text-[10px] text-indigo-700 font-semibold">Custody &amp; Handling Destination</span>
          </div>
          <p className="text-[11px] text-indigo-800 leading-relaxed">
            Select the department or office responsible for receiving and holding the item. This destination is the handling destination; it does not necessarily have to match your department or the location where the item was found.
          </p>

          <select
            value={formData.destinationDepartmentId}
            onChange={(e) => setFormData({ ...formData, destinationDepartmentId: e.target.value })}
            className="input w-full font-semibold text-xs bg-white"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.department_name} ({d.code || 'DEPT'})
              </option>
            ))}
          </select>

          {/* Physical Handover Toggle */}
          <div className="pt-2 border-t border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 block text-xs">Physical Item Handover Status</span>
              <span className="text-[11px] text-slate-500">
                Has the physical item been handed over to the department desk?
              </span>
            </div>
            <div className="flex gap-2">
              <label className={`px-3 py-1.5 rounded-lg border cursor-pointer font-semibold text-xs flex items-center gap-1.5 ${
                !formData.isPhysicallyHandedOver
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}>
                <input
                  type="radio"
                  name="handoverStatus"
                  checked={!formData.isPhysicallyHandedOver}
                  onChange={() => setFormData({ ...formData, isPhysicallyHandedOver: false })}
                  className="hidden"
                />
                <span>⏳ Awaiting Handover</span>
              </label>

              <label className={`px-3 py-1.5 rounded-lg border cursor-pointer font-semibold text-xs flex items-center gap-1.5 ${
                formData.isPhysicallyHandedOver
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}>
                <input
                  type="radio"
                  name="handoverStatus"
                  checked={formData.isPhysicallyHandedOver}
                  onChange={() => setFormData({ ...formData, isPhysicallyHandedOver: true })}
                  className="hidden"
                />
                <span>✓ Delivered to Desk</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-slate-600 block mb-1">Current Custodian or Storage Location</label>
            <input
              type="text"
              value={formData.storageLocation}
              onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
              placeholder="e.g. CSE Department Office (AB3 Room 204)"
              className="input w-full bg-white"
            />
          </div>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Optional Item Photograph</label>
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

// ---------------- SUBCOMPONENT: REPORT LOST FORM (CROSS-DEPARTMENT) ----------------
function ReportLostForm({ user, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'electronics',
    description: '',
    locationFound: 'AB3',
    foundDate: new Date().toISOString().slice(0, 10),
    foundTime: '10:30',
    characteristics: 'Colour: White, Brand: Apple, Glossy charging case',
    associatedDepartment: 'CSE Department / AB3 Block',
    privateIdentifyingDetails: 'Small micro-scratch on back hinge; serial number ending in 8X9; custom initial sticker.',
    photoUrl: null,
  })
  const [submitting, setSubmitting] = useState(false)

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
      const payload = {
        report_type: 'lost',
        title: formData.title,
        category: formData.category,
        description: formData.description,
        location_found: formData.locationFound,
        found_date: formData.foundDate,
        found_time: formData.foundTime,
        characteristics: formData.characteristics,
        associated_department: formData.associatedDepartment,
        private_identifying_details: formData.privateIdentifyingDetails,
        photo_url: formData.photoUrl,
      }

      const res = await api.reportItem(payload)
      alert(`Lost item report submitted successfully! \n\nLost Item ID: ${res.id}\nInitial Status: ACTIVE\n\nYour report is searchable across all campus departments. The matching engine is actively scanning found reports.`)
      onSuccess()
    } catch (err) {
      alert(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Report a Lost Item (Campus-Wide Discovery)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Every lost report is automatically discoverable across all departments and Student Welfare without restriction.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="font-semibold text-slate-700 block mb-1">
              Item Name / Short Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. AirPods, Dell Laptop Charger, Scientific Calculator"
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Category <span className="text-red-500">*</span></label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input w-full"
            >
              {LF_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            General Description <span className="text-red-500">*</span>
          </label>
          <textarea
            rows="3"
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g. White wireless earbuds with a charging case."
            className="input w-full resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Last Known Location <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={formData.locationFound}
              onChange={(e) => setFormData({ ...formData, locationFound: e.target.value })}
              placeholder="e.g. AB3"
              className="input w-full"
            />
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
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Approximate Time</label>
            <input
              type="time"
              value={formData.foundTime}
              onChange={(e) => setFormData({ ...formData, foundTime: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>

        {/* Characteristics (Colour, Brand, Case Type) */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Relevant Characteristics (Colour, Brand, Model, Case Type) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.characteristics}
            onChange={(e) => setFormData({ ...formData, characteristics: e.target.value })}
            placeholder="e.g. White, Apple, wireless charging case with black carabiner"
            className="input w-full"
          />
        </div>

        {/* Associated Department */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Department or Location Associated with Loss (If known)
          </label>
          <input
            type="text"
            value={formData.associatedDepartment}
            onChange={(e) => setFormData({ ...formData, associatedDepartment: e.target.value })}
            placeholder="e.g. CSE Department / AB3 Block"
            className="input w-full"
          />
        </div>

        {/* Private Identifying Details for Ownership Verification (Section 3 & 7) */}
        <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
          <div className="flex items-center gap-1.5 text-amber-950 font-bold">
            <span>🔒</span>
            <span>Private Identifying Details for In-Person Ownership Verification</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Enter confidential proof details (e.g. device serial numbers, hidden engravings, custom wallpaper, lockscreen passcode initials). These details are <strong>kept strictly private</strong> and will only be shown to authorized department handlers during in-person College ID verification.
          </p>
          <textarea
            rows="2"
            value={formData.privateIdentifyingDetails}
            onChange={(e) => setFormData({ ...formData, privateIdentifyingDetails: e.target.value })}
            placeholder="e.g. Serial ending in 8X9, small scratch near hinge, custom red charging cable inside."
            className="input w-full resize-none bg-white"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Optional Reference Photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="input w-full"
          />
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Registering Report…' : 'Submit Lost Report'}
          </button>
        </div>
      </form>
    </div>
  )
}
