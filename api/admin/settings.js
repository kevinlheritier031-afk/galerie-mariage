import { verifyAdminToken } from '../_lib/auth.js'

const ALLOWED_VALUES = ['open', 'protected', 'disabled']

export default async function handler(req, res) {
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Non autorisé.' })

  const url = process.env.SUPABASE_DIRECT_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  if (req.method === 'GET') {
    const r = await fetch(`${url}/rest/v1/settings?key=eq.download_mode&select=value`, { headers })
    const data = await r.json()
    return res.status(200).json({ value: data[0]?.value || 'open' })
  }

  if (req.method === 'PUT') {
    const { value } = req.body || {}
    if (!ALLOWED_VALUES.includes(value)) {
      return res.status(400).json({ error: 'Valeur invalide.' })
    }
    const r = await fetch(`${url}/rest/v1/settings?key=eq.download_mode`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ value }),
    })
    if (!r.ok) return res.status(500).json({ error: 'Erreur lors de la sauvegarde.' })
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
