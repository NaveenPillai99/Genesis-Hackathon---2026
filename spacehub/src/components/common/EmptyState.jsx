export default function EmptyState({ icon = '📭', title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="text-3xl">{icon}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint && <p className="max-w-sm text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
