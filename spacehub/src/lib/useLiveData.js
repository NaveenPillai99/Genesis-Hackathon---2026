import { useCallback, useEffect, useRef, useState } from 'react'
import { onDataChanged } from './bus'

/**
 * Calls `fetcher()` on mount, whenever `deps` change, and whenever anything
 * in the app writes data (bookings, approvals, requests, ...). Works the
 * same against the mock backend or Supabase — see dataClient.js.
 *
 * `loading` is only true for the *first* fetch of a given query (mount, or
 * `deps` changing) — a background refetch triggered by some unrelated
 * mutation elsewhere in the app (the bus doesn't know which table changed)
 * updates `data` in place without toggling `loading` back on. That matters:
 * a page that does `{loading ? <Spinner/> : <RealContent/>}` would otherwise
 * unmount `<RealContent/>` for an instant on every single mutation anywhere
 * in the app, wiping any local state a child was holding — e.g. an open
 * modal closing itself mid-interaction the moment any other data changed.
 */
export function useLiveData(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const loadedRef = useRef(false)

  // A new query identity (deps changed) should still show a loading state.
  useEffect(() => {
    loadedRef.current = false
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => {
    let cancelled = false
    if (!loadedRef.current) setLoading(true)
    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
          loadedRef.current = true
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => reload(), [reload])
  useEffect(() => onDataChanged(reload), [reload])

  return { data, loading, error, reload }
}
