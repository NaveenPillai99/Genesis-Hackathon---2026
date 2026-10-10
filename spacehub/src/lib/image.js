/**
 * Resizes an image file client-side and returns a compressed data URL.
 * Used for the lost & found photo field — keeps the payload small enough to
 * live happily in localStorage (mock mode) or a Postgres text column
 * (Supabase mode) without needing a separate file-storage bucket wired up
 * for the pilot.
 */
export function fileToResizedDataUrl(file, { maxDim = 640, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null)
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'))

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
