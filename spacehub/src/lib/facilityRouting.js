import { ROLES } from './constants'

export function planRequestRoute({ facility, requesterRole, nodeHours }) {
  const needsEndorsement = requesterRole === ROLES.STUDENT || requesterRole === ROLES.CLASS_REP
  const isHpc = facility.allocationModel === 'compute_time'
  const reviewerId = isHpc
    ? 'user-hpcfaculty-1'
    : facility.requiresAdminApproval
      ? 'user-labadmin-1'
      : 'user-labassist-1'
  const reviewerRole = isHpc ? ROLES.HPC_FACULTY : facility.requiresAdminApproval ? ROLES.LAB_ADMIN : ROLES.LAB_ASSISTANT
  const level = isHpc && Number(nodeHours || 0) > 20 ? 'faculty_supervision' : needsEndorsement ? 'mentor_then_lab' : 'lab_review'
  const levelReasons = isHpc
    ? ['HPC requests are routed to the HPC faculty or manager.']
    : facility.requiresAdminApproval
      ? ['This facility requires Lab Administrator sign-off.']
      : ['Routine facility access is reviewed by the Lab Assistant.']

  return { needsEndorsement, reviewerId, reviewerRole, level, levelReasons }
}
