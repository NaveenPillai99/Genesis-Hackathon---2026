import { useCallback, useEffect, useRef, useState } from 'react'
import { onDataChanged } from './bus'

/**
 * Calls `fetcher()` on mount, whenever `deps` change, and whenever anything
 * in the app writes data (requests, approvals, bookings, ...). Works the
 * same against the mock backend or Supabase — see dataClient.js.
 *
 * `loading` is true only for the *first* fetch of a given query (mount, or
 * `deps` changing). A background refetch triggered by some unrelated write
 * elsewhere — the change bus doesn't know which collection changed — swaps
 * `data` in place without flipping `loading` back on.
 *
 * That matters: a page that renders `{loading ? <Spinner/> : <Content/>}`
 * would otherwise unmount `<Content/>` for an instant on *every* write
 * anywhere in the app, destroying any local state its children hold — an
 * open modal would close itself mid-submit, a half-typed form would clear.
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
