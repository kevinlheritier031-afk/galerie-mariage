// Finalise un upload multipart R2
// Reçoit la liste des parts (partNumber + etag) et envoie CompleteMultipartUpload à R2
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from './_lib/r2.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { uploadId, key, parts } = req.body || {}

  if (!uploadId || !key || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'Paramètres manquants.' })
  }

  await r2.send(new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map(({ partNumber, etag }) => ({
        PartNumber: partNumber,
        ETag: etag,
      })),
    },
  }))

  res.status(200).json({ ok: true })
}
