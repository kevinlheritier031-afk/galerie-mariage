// Proxy de téléchargement côté serveur
// Récupère le fichier depuis Supabase et le renvoie avec Content-Disposition: attachment
// Nécessaire sur mobile (Android/iOS) où le navigateur ne sait pas ouvrir
// un blob URL sans MIME type explicite — ça finit en "content://" ou s'ouvre dans le navigateur
export default async function handler(req, res) {
  const { url, filename } = req.query

  if (!url || !filename) {
    return res.status(400).json({ error: 'Paramètres manquants' })
  }

  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'URL invalide' })
  }

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(30_000) })

    if (!upstream.ok) {
      return res.status(502).json({ error: 'Fichier inaccessible depuis le stockage' })
    }

    // Priorité à l'extension du fichier pour le MIME type
    // Supabase self-hosted peut renvoyer application/octet-stream même pour des images
    const ext = filename.split('.').pop().toLowerCase()
    const mimeMap = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', webm: 'video/webm',
    }
    const contentType = mimeMap[ext] || upstream.headers.get('content-type') || 'application/octet-stream'

    const data = Buffer.from(await upstream.arrayBuffer())

    res.setHeader('Content-Type', contentType)
    // filename* (RFC 5987) gère les prénoms avec accents (é, à, ô…)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    )
    res.setHeader('Content-Length', data.length)
    res.setHeader('Cache-Control', 'private, no-cache')
    res.end(data)
  } catch {
    res.status(500).json({ error: 'Erreur serveur lors du téléchargement' })
  }
}
