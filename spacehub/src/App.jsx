import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { initRealtime } from './lib/dataClient'
import AppShell from './components/layout/AppShell'
import { Spinner } from './components/common/Feedback'

import RoleSelect from './pages/Login/RoleSelect'
import Dashboard from './pages/Home/Dashboard'
import ClassroomBoard from './pages/Classrooms/ClassroomBoard'
import EventFeed from './pages/Events/EventFeed'
import RequestVenue from './pages/Events/RequestVenue'
import AdminApprovals from './pages/Events/AdminApprovals'
import FacilityCatalogue from './pages/Facilities/FacilityCatalogue'
import LostFoundBoard from './pages/LostFound/LostFoundBoard'
import AdminDashboard from './pages/Admin/AdminDashboard'
import { CAN_APPROVE_EVENT, ROLES } from './lib/constants'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Loading your account…" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireRole({ allow, children }) {
  const { user } = useAuth()
  if (!allow(user?.role)) {
    return (
      <div className="card p-6 text-sm text-slate-500">
        This section isn't available for your role ({user?.role}).
      </div>
    )
  }
  return children
}

function AppRoutes() {
  useEffect(() => initRealtime(), [])
  return (
    <Routes>
      <Route path="/login" element={<RoleSelect />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/classrooms" element={<ClassroomBoard />} />
        <Route path="/events" element={<EventFeed />} />
        <Route path="/events/new" element={<RequestVenue />} />
        <Route
          path="/events/approvals"
          element={
            <RequireRole allow={(r) => CAN_APPROVE_EVENT.has(r)}>
              <AdminApprovals />
            </RequireRole>
          }
        />
        <Route path="/facilities" element={<FacilityCatalogue />} />
        <Route path="/lost-found" element={<LostFoundBoard />} />
        <Route
          path="/admin"
          element={
            <RequireRole allow={(r) => r === ROLES.ADMIN}>
              <AdminDashboard />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
