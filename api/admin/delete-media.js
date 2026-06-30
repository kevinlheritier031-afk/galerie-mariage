import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { verifyAdminToken } from '../_lib/auth.js'
import { r2, R2_BUCKET } from '../_lib/r2.js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Non autorisé.' })

  const { id, storage_path, source } = req.body || {}
  if (!id || !storage_path) return res.status(400).json({ error: 'Paramètres manquants.' })

  if (source === 'r2') {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: storage_path }))
  } else {
    const url = process.env.SUPABASE_DIRECT_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    await fetch(`${url}/storage/v1/object/wedding-media/${storage_path}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
  }

  const url = process.env.SUPABASE_DIRECT_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  const dbRes = await fetch(`${url}/rest/v1/media?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  })

  if (!dbRes.ok) {
    const err = await dbRes.text()
    return res.status(500).json({ error: err })
  }

  res.status(200).json({ success: true })
}
