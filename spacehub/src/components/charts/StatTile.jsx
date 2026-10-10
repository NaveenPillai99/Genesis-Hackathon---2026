// Status is state, not identity — uses the fixed status palette (never
// themed) with an icon + label so meaning never rides on color alone.
const STATUS = {
  good: { fg: '#0ca30c', bg: '#0ca30c14', icon: '✓' },
  warning: { fg: '#b8790f', bg: '#fab21920', icon: '⏳' },
  serious: { fg: '#c15a36', bg: '#ec835a20', icon: '!' },
  critical: { fg: '#d03b3b', bg: '#d03b3b14', icon: '✕' },
  neutral: { fg: '#52514e', bg: '#89878114', icon: '•' },
}

export default function StatTile({ label, value, status = 'neutral' }) {
  const tone = STATUS[status] ?? STATUS.neutral
  return (
    <div className="card flex items-center gap-3 p-4">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ color: tone.fg, backgroundColor: tone.bg }}
      >
        {tone.icon}
      </span>
      <div>
        <p className="text-2xl font-extrabold leading-none text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}
