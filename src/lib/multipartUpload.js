// Upload vidéo direct navigateur → R2 via presigned PUT URL
// Un seul PUT = un seul CORS preflight, zéro overhead multipart
export async function multipartUpload(file, contentType, onProgress, onPhase) {
  onPhase?.('presign')

  const initRes = await fetch('/api/presign-multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType }),
  })
  if (!initRes.ok) throw new Error(`Presign HTTP ${initRes.status}`)
  const { url, key, publicUrl } = await initRes.json()

  onPhase?.('uploading')

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`PUT R2 HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Erreur réseau'))
    xhr.send(file)
  })

  return { key, publicUrl }
}
