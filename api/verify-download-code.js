// Rate limiting en mémoire (reset sur cold start — acceptable pour une app de mariage)
const attempts = new Map()
const MAX_ATTEMPTS = 5
const BLOCK_MS = 10 * 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  const now = Date.now()
  const record = attempts.get(ip) || { count: 0, blockedUntil: 0 }

  if (record.blockedUntil > now) {
    return res.status(429).json({
      valid: false,
      blocked: true,
      blockedUntil: record.blockedUntil,
    })
  }

  const { code } = req.body || {}

  // Priorité : Supabase settings, fallback sur variable d'env
  let correctCode = process.env.DOWNLOAD_CODE
  try {
    const url = process.env.SUPABASE_DIRECT_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    const r = await fetch(`${url}/rest/v1/settings?key=eq.download_code&select=value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    const data = await r.json()
    if (data[0]?.value) correctCode = data[0].value
  } catch { /* garde la valeur env en fallback */ }

  if (!correctCode) return res.status(500).json({ error: 'Configuration manquante.' })

  if (typeof code === 'string' && code.trim() === correctCode) {
    attempts.delete(ip)
    return res.status(200).json({ valid: true })
  }

  record.count = (record.count || 0) + 1
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS
  }
  attempts.set(ip, record)

  return res.status(200).json({
    valid: false,
    blocked: record.count >= MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - record.count),
  })
}
