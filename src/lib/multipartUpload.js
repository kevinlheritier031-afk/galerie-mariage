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

  let bytesUploaded = 0
  const completedParts = []

  try {
    // 2. Upload chaque part
    for (const { partNumber, url } of parts) {
      const start = (partNumber - 1) * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)

      const etag = await uploadPart(url, chunk, contentType, (loaded) => {
        onProgress(bytesUploaded + loaded, file.size)
      })

      bytesUploaded += chunk.size
      completedParts.push({ partNumber, etag })
      onProgress(bytesUploaded, file.size)
    }

    // 3. Finalise l'upload
    const completeRes = await fetch('/api/multipart-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', uploadId, key, parts: completedParts }),
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
          reject(new Error(`Part ${url} : ETag manquant dans la réponse`))
          return
        }
        resolve(etag.replace(/"/g, ''))
      } else {
        reject(new Error(`Part upload HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Erreur réseau sur part upload'))
    xhr.send(chunk)
  })
}
