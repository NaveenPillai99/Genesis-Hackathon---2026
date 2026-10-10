const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-rose-100 text-rose-700',
  purple: 'bg-violet-100 text-violet-700',
}

export default function Badge({ tone = 'slate', children, className = '' }) {
  return <span className={`badge ${TONES[tone] ?? TONES.slate} ${className}`}>{children}</span>
}
