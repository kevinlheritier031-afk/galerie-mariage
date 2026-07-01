// Upload vidéo super admin : PUT direct pour tous les fichiers
// Multipart S3 retiré car le CORS R2 ne renvoyait pas ETag → chaque chunk
// était retenté 4 fois en entier, multipliant par 4 le temps d'upload.
// Single PUT = 0 preflight, 0 retry, 1 seule connexion directe vers R2.

export async function adminVideoUpload(file, contentType, { onProgress, onPhase, onEta } = {}) {
  onPhase?.('presign')

  const res = await fetch('/api/presign-multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'init-put', filename: file.name, contentType }),
  })
  if (!res.ok) throw new Error(`Presign HTTP ${res.status}`)
  const { url, key, publicUrl } = await res.json()

  onPhase?.('uploading')
  const startTime = Date.now()

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.timeout = 30 * 60 * 1000 // 30 min max (fail fast si R2 ne répond pas)
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      onProgress?.(e.loaded, e.total)
      const elapsed = (Date.now() - startTime) / 1000
      if (elapsed > 2 && e.loaded > 0) {
        const speed = e.loaded / elapsed
        const eta = Math.round((e.total - e.loaded) / speed)
        onEta?.(eta > 0 ? eta : 0)
      }
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
      ? resolve()
      : reject(new Error(`PUT HTTP ${xhr.status}`))
    xhr.onerror = () => reject(new Error('Erreur réseau'))
    xhr.ontimeout = () => reject(new Error('Timeout — R2 ne répond pas'))
    xhr.send(file)
  })

  return { key, publicUrl }
}
