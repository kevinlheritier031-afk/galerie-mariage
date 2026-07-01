// Finalise ou annule un upload multipart R2
// POST { action: 'complete', uploadId, key, parts } → CompleteMultipartUpload
// POST { action: 'abort',    uploadId, key }        → AbortMultipartUpload
import { CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from './_lib/r2.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { action, uploadId, key, parts } = req.body || {}
  if (!action || !uploadId || !key) return res.status(400).json({ error: 'Paramètres manquants.' })

  if (action === 'complete') {
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'Parts manquantes.' })
    }
    try {
      await r2.send(new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts].sort((a, b) => a.partNumber - b.partNumber).map(({ partNumber, etag }) => ({
            PartNumber: partNumber,
            ETag: etag,
          })),
        },
      }))
    } catch (err) {
      return res.status(500).json({ error: `CompleteMultipartUpload échoué : ${err.message}` })
    }
    return res.status(200).json({ ok: true })
  }

  if (action === 'abort') {
    try {
      await r2.send(new AbortMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
      }))
    } catch {
      // Ignore si déjà complété ou expiré
    }
    return res.status(200).json({ ok: true })
  }

  res.status(400).json({ error: 'Action inconnue.' })
}
