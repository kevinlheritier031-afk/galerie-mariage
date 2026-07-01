// Endpoint admin pour lire et supprimer les logs applicatifs
import { verifyAdminToken } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Non autorisé.' })

  const url = process.env.SUPABASE_DIRECT_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (req.method === 'GET') {
    const dbRes = await fetch(
      `${url}/rest/v1/logs?order=created_at.desc&limit=200`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    const data = await dbRes.json()
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    await fetch(`${url}/rest/v1/logs?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
