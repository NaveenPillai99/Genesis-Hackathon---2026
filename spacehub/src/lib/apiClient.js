// Direct API client communicating with FastAPI backend (/api)

const API_BASE = '/api'

export function getToken() {
  return localStorage.getItem('campusconnect_token')
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('campusconnect_token', token)
  } else {
    localStorage.removeItem('campusconnect_token')
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let errDetail = 'Request failed'
    try {
      const errJson = await res.json()
      errDetail = errJson.detail || errJson.message || JSON.stringify(errJson)
    } catch {
      errDetail = res.statusText
    }
    throw new Error(errDetail)
  }

  return res.json()
}

// API Methods
export const api = {
  // Auth
  getDemoUsers: () => apiRequest('/auth/demo-users'),
  quickLogin: (userId) => apiRequest(`/auth/quick-login/${userId}`, { method: 'POST' }),
  login: (email, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  getMe: () => apiRequest('/auth/me'),

  // Classrooms
  getRooms: (params = '') => apiRequest(`/classrooms/rooms${params ? '?' + params : ''}`),
  getAvailability: (date, roomId = '') =>
    apiRequest(`/classrooms/availability?date=${date}${roomId ? '&room_id=' + roomId : ''}`),
  getTimetable: (params = '') => apiRequest(`/classrooms/timetable${params ? '?' + params : ''}`),
  bookRoom: (data) => apiRequest('/classrooms/book', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  checkinRoom: (bookingId) => apiRequest(`/classrooms/bookings/${bookingId}/checkin`, { method: 'POST' }),
  cancelBooking: (bookingId) => apiRequest(`/classrooms/bookings/${bookingId}/cancel`, { method: 'POST' }),

  // Academic Scheduling (Timetable Changes)
  getChangeRequests: (params = '') => apiRequest(`/timetable/change-requests${params ? '?' + params : ''}`),
  proposeChangeRequest: (data) => apiRequest('/timetable/change-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  reviewChangeRequest: (requestId, data) => apiRequest(`/timetable/change-requests/${requestId}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Events
  getEvents: (params = '') => apiRequest(`/events/${params ? '?' + params : ''}`),
  getEventFeed: () => apiRequest('/events/feed'),
  requestEvent: (data) => apiRequest('/events/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  reviewEvent: (eventId, data) => apiRequest(`/events/${eventId}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Facilities
  getFacilities: () => apiRequest('/facilities/'),
  bookFacility: (data) => apiRequest('/facilities/book', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getHPC: () => apiRequest('/facilities/hpc'),
  requestHPC: (data) => apiRequest('/facilities/hpc', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  reviewHPC: (hpcId, decision) => apiRequest(`/facilities/hpc/${hpcId}/review?decision=${decision}`, { method: 'POST' }),
  getHpcOverview: () => apiRequest('/hpc/overview'),
  listHpcNodes: () => apiRequest('/hpc/nodes'),
  updateHpcNodeStatus: (nodeId, data) => apiRequest(`/hpc/nodes/${nodeId}/status`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  listHpcJobs: () => apiRequest('/hpc/jobs'),
  listHpcIncidents: () => apiRequest('/hpc/incidents'),
  createHpcIncident: (data) => apiRequest('/hpc/incidents', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  setMaintenance: (facilityId, data) => apiRequest(`/facilities/${facilityId}/maintenance`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  grantInduction: (facilityId, userId) => apiRequest(`/facilities/${facilityId}/induct`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  }),

  // Lost & Found
  getDepartments: () => apiRequest('/lost-found/departments'),
  getLostFoundItems: (params = '') => apiRequest(`/lost-found/${params ? '?' + params : ''}`),
  getMyReports: () => apiRequest('/lost-found/my-reports'),
  getAssignedItems: () => apiRequest('/lost-found/assigned-to-me'),
  getItem: (itemId) => apiRequest(`/lost-found/${itemId}`),
  reportItem: (data) => apiRequest('/lost-found/report', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMatches: (itemId) => apiRequest(`/lost-found/${itemId}/matches`),
  submitClaim: (itemId, data) => apiRequest(`/lost-found/${itemId}/claim`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  reviewClaim: (claimId, data) => apiRequest(`/lost-found/claims/${claimId}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  recordHandover: (itemId, data) => apiRequest(`/lost-found/${itemId}/handover`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  verifyItemInPerson: (itemId, data) => apiRequest(`/lost-found/${itemId}/in-person-verification`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  receivePhysicalHandover: (itemId, data) => apiRequest(`/lost-found/${itemId}/receive-handover`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  transferCustody: (itemId, data) => apiRequest(`/lost-found/${itemId}/transfer`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Notifications
  getNotifications: () => apiRequest('/notifications/'),
  markNotificationRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'POST' }),

  // Audit
  getAuditLogs: (params = '') => apiRequest(`/audit/${params ? '?' + params : ''}`),

  // Analytics
  getAnalytics: () => apiRequest('/analytics/utilization'),

  // E-Governance Adapter
  getEGovernanceSpec: () => apiRequest('/egovernance/spec'),
  simulateEGovernanceSync: () => apiRequest('/egovernance/simulate-sync', { method: 'POST' }),
}
