// Single import point the whole app uses for data. Picks the real Supabase
// backend when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set, otherwise
// falls back to the in-browser mock backend — same function names either way.
import * as mock from '../mock/mockClient'
import * as live from './supabaseClient'

export const backendMode = live.isSupabaseConfigured ? 'supabase' : 'mock'
const impl = live.isSupabaseConfigured ? live : mock

export const {
  listProfiles,
  getProfile,
  listRooms,
  getRoom,
  listTimetableSlots,
  getAvailability,
  getWeeklyBookedHours,
  createRoomBooking,
  cancelRoomBooking,
  checkInBooking,
  listMyRoomBookings,
  listRoomBookingsForRoom,
  blockRoomDate,
  unblockRoomDate,
  listBlockedDates,
  adminCancelBooking,
  listFacilities,
  getFacility,
  setFacilityMaintenance,
  hasInduction,
  listInductions,
  completeInduction,
  listFacilityBookings,
  listMyFacilityBookings,
  createFacilityBooking,
  cancelFacilityBooking,
  requestHpcAllocation,
  decideHpcAllocation,
  listHpcAllocations,
  listEvents,
  listPublicEvents,
  getCompetingRequests,
  suggestAlternativeVenues,
  createEventRequest,
  createDirectEvent,
  decideEvent,
  recommendEvent,
  selectEventAlternative,
  autoDecideCluster,
  listMyEvents,
  resetDemoEvents,
  getRecentBookersOfRoom,
  getPeopleWithActivityInBlock,
  listBlocks,
  reportLostItem,
  listLostItems,
  listLostItemsNotifyingUser,
  markItemClaimed,
  reportMaintenance,
  updateMaintenanceStatus,
  listMaintenanceReports,
  getUtilizationStats,
  HPC_THRESHOLD,
  // Academic Scheduling
  listChangeRequests,
  proposeChangeRequest,
  reviewChangeRequest,
  resetDemoChangeRequests,
  // Enhanced Lost & Found
  reportSmartLostItem,
  submitClaim,
  reviewClaim,
  recordHandover,
  // Notifications & Audit & Governance
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listAuditLogs,
  getEGovernanceSpec,
  simulateEGovernanceSync,
  // HPC Cluster Operations
  getHpcOverview,
  listHpcNodes,
  updateHpcNodeStatus,
  listHpcJobs,
  listHpcIncidents,
  createHpcIncident,
} = impl

export function initRealtime() {
  if (live.isSupabaseConfigured) return live.subscribeToRealtimeChanges()
  return () => {}
}
