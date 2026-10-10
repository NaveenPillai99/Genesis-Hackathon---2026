import { createContext, useContext, useEffect, useState } from 'react'
import { getProfile } from '../lib/dataClient'

// Pilot auth: "simple buttons for different types of users". The brief's
// production plan reuses the existing Amrita login (Supabase Auth, or an SSO
// token handed in by the MyAmrita app shell) and pulls the role from
// existing records — see supabase/schema.sql's comment on `profiles`. For
// the standalone pilot there's no real login system to hook into yet, so
// picking a seeded demo account stands in for it.

const STORAGE_KEY = 'spacehub_current_user_id'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setUser(null)
      setLoading(false)
      return
    }
    setLoading(true)
    getProfile(userId)
      .then((p) => {
        if (!cancelled) setUser(p)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  function loginAs(profile) {
    localStorage.setItem(STORAGE_KEY, profile.id)
    setUserId(profile.id)
    setUser(profile)
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setUserId(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginAs, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
