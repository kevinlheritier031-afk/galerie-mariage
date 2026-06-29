import { verifyAdminToken } from '../_lib/auth.js'

const DEFAULT_TITLE = 'Notre Mariage 💍'

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
    const r = await fetch(`${url}/rest/v1/settings?key=eq.app_title&select=value`, { headers })
    const data = await r.json()
    return res.status(200).json({ value: data[0]?.value || DEFAULT_TITLE })
  }

  if (req.method === 'PUT') {
    const { value } = req.body || {}
    if (typeof value !== 'string' || value.trim().length === 0) {
      return res.status(400).json({ error: 'Titre invalide.' })
    }
    const title = value.trim().slice(0, 100)

    // UPSERT : crée la ligne si elle n'existe pas encore
    const r = await fetch(`${url}/rest/v1/settings`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'app_title', value: title }),
    })
    if (!r.ok) return res.status(500).json({ error: 'Erreur lors de la sauvegarde.' })
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
