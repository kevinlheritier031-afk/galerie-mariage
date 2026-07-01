// Upload vidéo optimisé pour le super admin
// < 100 Mo  → presigned PUT direct (1 requête, rapide)
// >= 100 Mo → multipart parallèle 6 streams avec retry automatique

const MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100 Mo
const CONCURRENCY = 6
const MAX_RETRIES = 3

export async function adminVideoUpload(file, contentType, { onProgress, onPhase, onEta } = {}) {
  if (file.size >= MULTIPART_THRESHOLD) {
    return _multipart(file, contentType, { onProgress, onPhase, onEta })
  }
  return _singlePut(file, contentType, { onProgress, onPhase })
}

// ── PUT direct ───────────────────────────────────────────────────────────────
async function _singlePut(file, contentType, { onProgress, onPhase }) {
  onPhase?.('presign')

  const res = await fetch('/api/presign-multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'init-put', filename: file.name, contentType }),
  })
  if (!res.ok) throw new Error(`Presign HTTP ${res.status}`)
  const { url, key, publicUrl } = await res.json()

  onPhase?.('uploading')

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`PUT HTTP ${xhr.status}`))
    xhr.onerror = () => reject(new Error('Erreur réseau'))
    xhr.send(file)
  })

  return { key, publicUrl }
}

// ── Multipart parallèle ───────────────────────────────────────────────────────
async function _multipart(file, contentType, { onProgress, onPhase, onEta }) {
  onPhase?.('presign')

  const res = await fetch('/api/presign-multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'init-multipart', filename: file.name, contentType, fileSize: file.size }),
  })
  if (!res.ok) throw new Error(`Init multipart HTTP ${res.status}`)
  const { uploadId, key, publicUrl, parts, chunkSize } = await res.json()

  onPhase?.('uploading')

  const bytesPerPart = new Array(parts.length).fill(0)
  const completedParts = []
  const startTime = Date.now()

  function emitProgress() {
    const uploaded = bytesPerPart.reduce((a, b) => a + b, 0)
    onProgress?.(uploaded, file.size)

    const elapsed = (Date.now() - startTime) / 1000
    if (elapsed > 1 && uploaded > 0) {
      const speed = uploaded / elapsed
      const eta = Math.round((file.size - uploaded) / speed)
      onEta?.(eta > 0 ? eta : 0)
    }
  }

  try {
    const queue = [...parts]

    async function worker() {
      while (queue.length > 0) {
        const { partNumber, url } = queue.shift()
        const idx = partNumber - 1
        const start = idx * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        let etag
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            etag = await _uploadChunk(url, chunk, (loaded) => {
              bytesPerPart[idx] = loaded
              emitProgress()
            })
            break
          } catch (err) {
            if (attempt === MAX_RETRIES) throw new Error(`Chunk ${partNumber} échoué après ${MAX_RETRIES} tentatives : ${err.message}`)
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
          }
        }

        bytesPerPart[idx] = chunk.size
        completedParts.push({ partNumber, etag })
        emitProgress()
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    onPhase?.('finalizing')

    const completeRes = await fetch('/api/presign-multipart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', uploadId, key, parts: completedParts }),
    })
    if (!completeRes.ok) throw new Error(`Complete HTTP ${completeRes.status}`)

    return { key, publicUrl }

  } catch (err) {
    fetch('/api/presign-multipart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'abort', uploadId, key }),
    }).catch(() => {})
    throw err
  }
}

function _uploadChunk(url, chunk, onChunkProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onChunkProgress(e.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag')
        if (!etag) {
          reject(new Error('ETag manquant — vérifie la config CORS R2 (expose-headers: ETag)'))
          return
        }
        resolve(etag)
      } else {
        reject(new Error(`Chunk HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Erreur réseau'))
    xhr.send(chunk)
  })
}
