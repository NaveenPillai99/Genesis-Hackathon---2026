import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../lib/constants'

const SECTIONS = [
  {
    role: ROLES.HPC_FACULTY,
    path: '/facilities/hpc-management',
    icon: '⚡',
    title: 'HPC Faculty',
    description: 'Monitor cluster nodes, compute jobs, incidents, and HPC operations.',
  },
  {
    role: ROLES.LAB_ASSISTANT,
    path: '/facilities/lab-assistant',
    icon: '🛠️',
    title: 'Lab Assistant',
    description: 'Manage assigned equipment, maintenance status, bookings, and inductions.',
  },
  {
    role: ROLES.LAB_ADMIN,
    path: '/facilities/lab-administration',
    icon: '🔬',
    title: 'Lab Administrator',
    description: 'Oversee laboratory facilities, assistant rosters, policies, and utilization.',
  },
]

export default function FacilitiesOverview() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Campus facilities</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Facilities</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          One workspace for HPC operations, laboratory equipment, and facility administration.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SECTIONS.map((section) => {
          const isCurrentSection = user?.role === section.role
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className="text-3xl">{section.icon}</span>
                {isCurrentSection && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Current workspace
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900">{section.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{section.description}</p>
              <span className="mt-5 block text-xs font-bold text-brand-700">
                {isCurrentSection ? 'Open subsection →' : 'Role-specific subsection'}
              </span>
            </>
          )

          return isCurrentSection ? (
            <Link
              key={section.role}
              to={section.path}
              className="card border-brand-300 bg-brand-50/40 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {content}
            </Link>
          ) : (
            <div key={section.role} className="card p-5 opacity-75">
              {content}
            </div>
          )
        })}
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-bold text-slate-800">Browse available facilities</p>
          <p className="text-xs text-slate-500">View equipment, request access, and manage facility bookings.</p>
        </div>
        <Link to="/facilities" className="btn-primary">
          Open facility catalogue
        </Link>
      </div>
    </div>
  )
}
