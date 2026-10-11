import { useEffect, useState } from 'react'
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/dataClient'
import { api } from '../../lib/apiClient'
import { useAuth } from '../../context/AuthContext'

export default function NotificationDrawer({ isOpen, onClose }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      let items = []
      try {
        const apiItems = await api.getNotifications()
        if (Array.isArray(apiItems) && apiItems.length > 0) {
          items = apiItems.map((n) => ({
            id: n.id,
            recipientId: n.recipient_id || n.recipientId,
            title: n.title,
            message: n.message,
            category: n.category,
            link: n.link,
            isRead: !!(n.is_read ?? n.isRead),
            createdAt: n.created_at || n.createdAt || new Date().toISOString()
          }))
        }
      } catch (err) {
        // Fallback to dataClient mock
      }

      if (items.length === 0) {
        const localItems = await listNotifications(user.id)
        items = localItems || []
      }
      setNotifications(items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, user])

  async function handleMarkRead(id) {
    try {
      await api.markNotificationRead(id)
    } catch (err) {}
    try {
      await markNotificationRead(id)
    } catch (err) {}
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
  }

  async function handleMarkAll() {
    try {
      await api.markAllNotificationsRead()
    } catch (err) {}
    try {
      await markAllNotificationsRead(user.id)
    } catch (err) {}
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  if (!isOpen) return null

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="h-full w-full max-w-md bg-white p-5 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <h2 className="font-bold text-slate-800 text-lg">Notifications</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500 text-white text-xs px-2 py-0.5 font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        <div className="flex justify-between items-center py-2.5 text-xs text-slate-500">
          <span>Campus Alerts & Workflow Updates</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-brand-600 font-semibold hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading alerts…</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <span className="text-3xl block mb-2">🎉</span>
              No notifications right now.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`py-3.5 px-2 transition-colors rounded-lg my-1 ${
                  n.isRead ? 'bg-white opacity-75' : 'bg-brand-50/50 border-l-4 border-brand-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-slate-900 text-sm">{n.title}</h4>
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="text-[11px] text-brand-600 hover:text-brand-800 font-medium whitespace-nowrap"
                    >
                      Mark read
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="capitalize font-medium text-slate-500">
                    Category: {n.category || 'System'}
                  </span>
                  <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 text-center">
          <button onClick={onClose} className="btn-secondary w-full text-xs py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
