// Upload vidéo super admin
// Si VITE_WORKER_URL est défini → upload via Cloudflare Worker (PoP local → R2 interne) = rapide
// Sinon → PUT presigned R2 direct (fallback, plus lent selon la route réseau)

const WORKER_URL = import.meta.env.VITE_WORKER_URL
const WORKER_SECRET = import.meta.env.VITE_WORKER_SECRET

export async function adminVideoUpload(file, contentType, { onProgress, onPhase, onEta } = {}) {
  if (WORKER_URL && WORKER_SECRET) {
    return _workerUpload(file, contentType, { onProgress, onPhase, onEta })
  }
  return _presignedPut(file, contentType, { onProgress, onPhase, onEta })
}

// ── Via Cloudflare Worker (chemin optimal : PoP CF local → R2 binding interne) ──
function _workerUpload(file, contentType, { onProgress, onPhase, onEta }) {
  onPhase?.('uploading')
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${WORKER_URL}/upload-video`)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('X-Filename', file.name)
    xhr.setRequestHeader('X-Upload-Secret', WORKER_SECRET)
    xhr.timeout = 30 * 60 * 1000

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

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('Réponse Worker invalide'))
        }
      } else {
        reject(new Error(`Worker HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Erreur réseau'))
    xhr.ontimeout = () => reject(new Error('Timeout'))
    xhr.send(file)
  })
}

// ── Presigned PUT direct (fallback sans Worker) ──
async function _presignedPut(file, contentType, { onProgress, onPhase, onEta }) {
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
    xhr.timeout = 30 * 60 * 1000
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
