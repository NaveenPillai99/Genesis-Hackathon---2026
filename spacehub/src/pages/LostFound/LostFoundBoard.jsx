import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLiveData } from '../../lib/useLiveData'
import { listBlocks, listLostItems, markItemClaimed, reportLostItem } from '../../lib/dataClient'
import { fileToResizedDataUrl } from '../../lib/image'
import EmptyState from '../../components/common/EmptyState'
import Badge from '../../components/common/Badge'
import { ErrorNote, Spinner } from '../../components/common/Feedback'

export default function LostFoundBoard() {
  const { user } = useAuth()
  const { data: items, loading } = useLiveData(() => listLostItems(), [])
  const { data: blocks } = useLiveData(() => listBlocks(), [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Lost &amp; Found</h1>
        <p className="text-sm text-slate-500">
          An item found anywhere in a block is reported against that block — everyone who had a class or booking there that day
          is privately notified.
        </p>
      </div>

      <ReportForm blocks={blocks} />

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-800">Reported items</h2>
        {loading ? (
          <Spinner />
        ) : !items || items.length === 0 ? (
          <EmptyState icon="🔎" title="Nothing reported yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div key={item.id} className="card flex items-start gap-3 p-4">
                {item.photoUrl ? (
                  <img src={item.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl">📦</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{item.description}</p>
                  <p className="text-xs text-slate-500">
                    {item.block} ·{' '}
                    {new Date(item.reportedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  {item.notifiedUserIds?.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {item.notifiedUserIds.length} people with a class or booking in {item.block} that day notified privately
                    </p>
                  )}
                  {item.status === 'claimed' && <p className="mt-1 text-xs text-emerald-600">✓ Claimed</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge tone={item.status === 'claimed' ? 'green' : 'amber'}>{item.status}</Badge>
                  {item.status === 'unclaimed' && (
                    <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => markItemClaimed(item.id, user.id)}>
                      Mark claimed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ReportForm({ blocks }) {
  const { user } = useAuth()
  const [block, setBlock] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  async function onPhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setPhotoFile(null)
      setPhotoPreview(null)
      return
    }
    setError(null)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      setPhotoFile(dataUrl)
      setPhotoPreview(dataUrl)
    } catch (err) {
      setError(err)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const item = await reportLostItem({ block, description, foundBy: user.id, photoUrl: photoFile })
      setDone(item)
      setDescription('')
      setPhotoFile(null)
      setPhotoPreview(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-5">
      <p className="label">Report a found item</p>
      <div className="grid gap-3 sm:grid-cols-[1fr,2fr]">
        <select required className="input" value={block} onChange={(e) => setBlock(e.target.value)}>
          <option value="">Which block?</option>
          {blocks?.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <input
          required
          className="input"
          placeholder="e.g. Blue water bottle, found near room AB1-E103B on the back bench"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <p className="-mt-1 text-[11px] text-slate-400">
        Only pick the block the item was found in — mention the exact room, floor or landmark in the description above.
      </p>

      <div className="flex items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          📷 Add a photo
          <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
        </label>
        {photoPreview && (
          <div className="flex items-center gap-2">
            <img src={photoPreview} alt="Preview" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
            <button
              type="button"
              className="text-xs font-semibold text-rose-600 hover:underline"
              onClick={() => {
                setPhotoFile(null)
                setPhotoPreview(null)
              }}
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <ErrorNote error={error} />
      {done && (
        <p className="text-xs font-semibold text-emerald-700">
          ✓ Reported. {done.notifiedUserIds?.length ?? 0} people with a class or booking in {done.block} today notified privately.
        </p>
      )}
      <button className="btn-primary self-start" disabled={busy} type="submit">
        {busy ? 'Reporting…' : 'Report item'}
      </button>
    </form>
  )
}
