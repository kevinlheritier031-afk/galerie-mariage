import { verifyAdminToken } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Non autorisé.' })

  const { id, storage_path } = req.body || {}
  if (!id || !storage_path) return res.status(400).json({ error: 'Paramètres manquants.' })

  const url = process.env.SUPABASE_DIRECT_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  // Suppression du fichier dans Storage
  await fetch(`${url}/storage/v1/object/wedding-media/${storage_path}`, {
    method: 'DELETE',
    headers,
  })

  // Suppression de la ligne en base
  const dbRes = await fetch(`${url}/rest/v1/media?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  })

  if (!dbRes.ok) {
    const err = await dbRes.text()
    return res.status(500).json({ error: err })
  }

  res.status(200).json({ success: true })
}
