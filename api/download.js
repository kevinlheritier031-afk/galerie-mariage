// Proxy de téléchargement côté serveur
// Récupère le fichier depuis Supabase et le renvoie avec Content-Disposition: attachment
// Nécessaire sur mobile (Android/iOS) où le navigateur ne sait pas ouvrir
// un blob URL sans MIME type explicite — ça finit en "content://" ou s'ouvre dans le navigateur
//
// Cas spécial vidéos R2 : redirect 302 vers l'URL publique R2 avec Content-Disposition
// Le bucket R2 étant public, pas besoin de proxyer le fichier en mémoire
// (évite OOM/timeout sur Vercel pour les vidéos volumineuses)
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

export default async function handler(req, res) {
  const { url, filename } = req.query

  if (!url || !filename) {
    return res.status(400).json({ error: 'Paramètres manquants' })
  }

  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'URL invalide' })
  }

  // Vidéos R2 : redirect direct vers l'URL publique R2
  // On ajoute response-content-disposition en query param (supporté par R2/S3)
  if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) {
    const disposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    const redirectUrl = `${url}?response-content-disposition=${encodeURIComponent(disposition)}`
    res.setHeader('Cache-Control', 'private, no-cache')
    return res.redirect(302, redirectUrl)
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
