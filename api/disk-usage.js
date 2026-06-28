// Vercel Serverless Function (Node.js) — relais vers l'API disque du VPS
// Évite le mixed content HTTPS→HTTP en faisant l'appel côté serveur
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const diskApiUrl = process.env.DISK_API_URL
  if (!diskApiUrl) {
    return res.status(500).json({ error: 'DISK_API_URL non configuré dans les variables Vercel.' })
  }

  try {
    const response = await fetch(`${diskApiUrl}/api/disk-usage`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      throw new Error(`Le VPS a répondu avec le statut ${response.status}`)
    }
    const data = await response.json()
    return res.status(200).json(data)
  } catch (err) {
    return res.status(503).json({ error: 'API disque inaccessible', detail: err.message })
  }
}
