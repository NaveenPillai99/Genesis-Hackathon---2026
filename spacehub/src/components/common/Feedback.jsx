export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  )
}

export function ErrorNote({ error }) {
  if (!error) return null
  return (
    <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
      {error.message || String(error)}
    </div>
  )
}

export function SuccessNote({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-emerald-500 hover:text-emerald-700">
          ✕
        </button>
      )}
    </div>
  )
}
