import { QRCodeSVG } from 'qrcode.react'

/**
 * Renders the QR code that would be stuck on a room door in production —
 * encodes a deep link straight into that room's page in the app, per the
 * brief's "QR codes on room doors that open straight into that room's page."
 */
export default function RoomQR({ roomId, bookingId, size = 160 }) {
  const payload = bookingId
    ? `spacehub://checkin/${bookingId}`
    : `spacehub://room/${roomId}`
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <QRCodeSVG value={payload} size={size} includeMargin bgColor="#ffffff" fgColor="#0f172a" />
      <code className="break-all text-center text-[10px] text-slate-400">{payload}</code>
    </div>
  )
}
