// Annule un upload multipart R2 en cours (libère les parts partielles sur R2)
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from './_lib/r2.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { uploadId, key } = req.body || {}
  if (!uploadId || !key) return res.status(400).json({ error: 'Paramètres manquants.' })

  try {
    await r2.send(new AbortMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      UploadId: uploadId,
    }))
  } catch {
    // Ignore si déjà complété ou expiré
  }

  res.status(200).json({ ok: true })
}
