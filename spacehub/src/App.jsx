import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { initRealtime } from './lib/dataClient'
import AppShell from './components/layout/AppShell'
import { Spinner } from './components/common/Feedback'

import RoleSelect from './pages/Login/RoleSelect'
import Dashboard from './pages/Home/Dashboard'
import ClassroomBoard from './pages/Classrooms/ClassroomBoard'
import AcademicScheduling from './pages/AcademicScheduling/AcademicScheduling'
import EventFeed from './pages/Events/EventFeed'
import RequestVenue from './pages/Events/RequestVenue'
import AdminApprovals from './pages/Events/AdminApprovals'
import FacilityCatalogue from './pages/Facilities/FacilityCatalogue'
import HPCAllocation from './pages/Facilities/HPCAllocation'
import FacilitiesOverview from './pages/Facilities/FacilitiesOverview'
import HPCFacultyDashboard from './pages/Home/dashboards/HPCFacultyDashboard'
import LabAssistantDashboard from './pages/Home/dashboards/LabAssistantDashboard'
import LabAdminDashboard from './pages/Home/dashboards/LabAdminDashboard'
import LostFoundBoard from './pages/LostFound/LostFoundBoard'
import AdminDashboard from './pages/Admin/AdminDashboard'
import GovernanceAudit from './pages/Admin/GovernanceAudit'
import UserProfile from './pages/Profile/UserProfile'
import { CAN_APPROVE_EVENT, CAN_VIEW_AUDIT_LOGS, ROLES } from './lib/constants'

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

function FacilityDashboard({ Component }) {
  const { user } = useAuth()
  return <Component user={user} />
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
        <Route path="/academic-scheduling" element={<AcademicScheduling />} />
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
        <Route path="/facilities/overview" element={<FacilitiesOverview />} />
        <Route
          path="/facilities/hpc-management"
          element={
            <RequireRole allow={(r) => r === ROLES.HPC_FACULTY}>
              <FacilityDashboard Component={HPCFacultyDashboard} />
            </RequireRole>
          }
        />
        <Route
          path="/facilities/lab-assistant"
          element={
            <RequireRole allow={(r) => r === ROLES.LAB_ASSISTANT}>
              <FacilityDashboard Component={LabAssistantDashboard} />
            </RequireRole>
          }
        />
        <Route
          path="/facilities/lab-administration"
          element={
            <RequireRole allow={(r) => r === ROLES.LAB_ADMIN}>
              <FacilityDashboard Component={LabAdminDashboard} />
            </RequireRole>
          }
        />
        <Route path="/facilities/hpc" element={<HPCAllocation />} />
        <Route path="/lost-found" element={<LostFoundBoard />} />
        <Route
          path="/admin"
          element={
            <RequireRole allow={(r) => r === ROLES.ADMIN || r === ROLES.RESOURCE_ADMIN || r === ROLES.SYS_ADMIN}>
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/governance"
          element={
            <RequireRole allow={(r) => CAN_VIEW_AUDIT_LOGS.has(r)}>
              <GovernanceAudit />
            </RequireRole>
          }
        />
        <Route path="/profile" element={<UserProfile />} />
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
