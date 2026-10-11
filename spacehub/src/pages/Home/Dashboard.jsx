import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../lib/constants'

import CampusDirectorDashboard from './dashboards/CampusDirectorDashboard'
import DeanDashboard from './dashboards/DeanDashboard'
import HODDashboard from './dashboards/HODDashboard'
import HPCFacultyDashboard from './dashboards/HPCFacultyDashboard'
import FacilitiesOverview from '../Facilities/FacilitiesOverview'
import StudentDashboard from './dashboards/StudentDashboard'
import ClassRepDashboard from './dashboards/ClassRepDashboard'
import ClassAdvisorDashboard from './dashboards/ClassAdvisorDashboard'
import GeneralFacultyDashboard from './dashboards/GeneralFacultyDashboard'
import CentralResourceAdminDashboard from './dashboards/CentralResourceAdminDashboard'
import StudentWelfareDashboard from './dashboards/StudentWelfareDashboard'
import SystemAdminDashboard from './dashboards/SystemAdminDashboard'
import LabAssistantDashboard from './dashboards/LabAssistantDashboard'
import LabAdminDashboard from './dashboards/LabAdminDashboard'

export default function Dashboard() {
  const { user } = useAuth()
  const role = user?.role || ROLES.STUDENT

  switch (role) {
    case ROLES.CAMPUS_DIRECTOR:
      return <CampusDirectorDashboard user={user} />

    case ROLES.DEAN:
      return <DeanDashboard user={user} />

    case ROLES.HOD:
      return <HODDashboard user={user} />

    case ROLES.HPC_FACULTY:
      return <FacilitiesOverview user={user} />

    case ROLES.CLASS_REP:
      return <ClassRepDashboard user={user} />

    case ROLES.CLASS_ADVISOR:
      return <ClassAdvisorDashboard user={user} />

    case ROLES.FACULTY:
      return <GeneralFacultyDashboard user={user} />

    case ROLES.LAB_ASSISTANT:
      return <LabAssistantDashboard user={user} />

    case ROLES.LAB_ADMIN:
      return <LabAdminDashboard user={user} />

    case ROLES.RESOURCE_ADMIN:
    case 'admin':
      return <CentralResourceAdminDashboard user={user} />

    case ROLES.LOST_PROPERTY_HANDLER:
      return <StudentWelfareDashboard user={user} />

    case ROLES.SYS_ADMIN:
      return <SystemAdminDashboard user={user} />

    case ROLES.STUDENT:
    default:
      return <StudentDashboard user={user} />
  }
}
