// Minimal pub/sub so any page can say "something changed, refetch" without the
// app needing a full state-management library. Used the same way regardless of
// whether the active backend is the mock store or Supabase (see dataClient.js).
// In the real Supabase deployment this is also fed by postgres_changes
// subscriptions, so bookings made from a second device show up here too.

const listeners = new Set()

export function emitDataChanged() {
  for (const cb of listeners) {
    try {
      cb()
    } catch (err) {
      console.error('bus listener error', err)
    }
  }
}

export function onDataChanged(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
