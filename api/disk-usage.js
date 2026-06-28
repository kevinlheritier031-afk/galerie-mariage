export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://galerie-mariage.vercel.app')
  res.setHeader('Cache-Control', 'no-store')

  const diskApiUrl = process.env.DISK_API_URL
  const diskSecret = process.env.DISK_API_SECRET

  if (!diskApiUrl) {
    return res.status(500).json({ error: 'DISK_API_URL non configuré.' })
  }

  try {
    const response = await fetch(`${diskApiUrl}/api/disk-usage`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'x-disk-secret': diskSecret || '' },
    })
    if (!response.ok) throw new Error(`Le VPS a répondu avec le statut ${response.status}`)
    const data = await response.json()
    return res.status(200).json(data)
  } catch (err) {
    return res.status(503).json({ error: 'API disque inaccessible', detail: err.message })
  }
}
