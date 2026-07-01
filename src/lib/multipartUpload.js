// Upload multipart vers R2 : découpe le fichier en chunks de 10 Mo
// et uploade chaque part via une presigned URL PUT
// onProgress(bytesUploaded, totalBytes) appelé à chaque chunk complété

export async function multipartUpload(file, contentType, onProgress) {
  // 1. Initie l'upload et récupère les URLs de parts
  const initRes = await fetch('/api/presign-multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType,
      fileSize: file.size,
    }),
  })
  if (!initRes.ok) throw new Error(`Presign multipart HTTP ${initRes.status}`)
  const { uploadId, key, publicUrl, parts, chunkSize } = await initRes.json()

  const bytesPerPart = new Array(parts.length).fill(0)
  const completedParts = []
  const CONCURRENCY = 6

  function totalUploaded() {
    return bytesPerPart.reduce((a, b) => a + b, 0)
  }

  try {
    // 2. Upload les parts en parallèle (4 simultanées max)
    const queue = [...parts]
    async function worker() {
      while (queue.length > 0) {
        const { partNumber, url } = queue.shift()
        const idx = partNumber - 1
        const start = idx * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        const etag = await uploadPart(url, chunk, contentType, (loaded) => {
          bytesPerPart[idx] = loaded
          onProgress(totalUploaded(), file.size)
        })

        bytesPerPart[idx] = chunk.size
        completedParts.push({ partNumber, etag })
        onProgress(totalUploaded(), file.size)
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    // 3. Finalise l'upload
    const completeRes = await fetch('/api/multipart-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', uploadId, key, parts: completedParts.sort((a, b) => a.partNumber - b.partNumber) }),
    })
    if (!completeRes.ok) throw new Error(`Complete multipart HTTP ${completeRes.status}`)

    return { key, publicUrl }

  } catch (err) {
    // Annule les parts partielles sur R2
    fetch('/api/multipart-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'abort', uploadId, key }),
    }).catch(() => {})
    throw err
  }
}

function uploadPart(url, chunk, contentType, onChunkProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    // Content-Type non envoyé sur les parts — R2 l'ignore et c'est requis par la spec S3
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onChunkProgress(e.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag')
        if (!etag) {
          reject(new Error(`ETag manquant sur la part ${xhr.status} — vérifier la config CORS R2`))
          return
        }
        // Les guillemets font partie du format ETag (RFC 7232) — R2 les exige dans CompleteMultipartUpload
        resolve(etag)
      } else {
        reject(new Error(`Part upload HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Erreur réseau sur part upload'))
    xhr.send(chunk)
  })
}
