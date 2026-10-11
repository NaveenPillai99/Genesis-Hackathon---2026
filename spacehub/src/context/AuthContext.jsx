import { createContext, useContext, useEffect, useState } from 'react'
import { getProfile } from '../lib/dataClient'
import { setToken, api } from '../lib/apiClient'

const STORAGE_KEY = 'campusconnect_current_user_id'
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

  async function loginAs(profile) {
    localStorage.setItem(STORAGE_KEY, profile.id)
    setUserId(profile.id)
    setUser(profile)
    // Synchronize JWT token from backend
    try {
      const res = await api.quickLogin(profile.id)
      if (res.access_token) {
        setToken(res.access_token)
      }
    } catch (e) {
      console.warn('Backend quick-login sync skipped:', e)
    }
  }

  async function loginWithCredentials(email, password) {
    try {
      const res = await api.login(email, password)
      if (res.access_token) {
        setToken(res.access_token)
        localStorage.setItem(STORAGE_KEY, res.user.id)
        setUserId(res.user.id)
        setUser(res.user)
        return res.user
      }
    } catch (err) {
      throw err
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setUserId(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginAs, loginWithCredentials, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
