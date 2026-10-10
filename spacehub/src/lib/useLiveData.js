import { useCallback, useEffect, useRef, useState } from 'react'
import { onDataChanged } from './bus'

/**
 * Calls `fetcher()` on mount, whenever `deps` change, and whenever anything
 * in the app writes data (bookings, approvals, inductions, ...). Works the
 * same against the mock backend or Supabase — see dataClient.js.
 */
export function useLiveData(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(() => {
    let cancelled = false
    setLoading(true)
    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
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
