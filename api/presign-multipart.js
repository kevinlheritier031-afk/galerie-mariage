// Initie un upload multipart R2 et pré-génère toutes les URLs de parts
// Le client reçoit uploadId + liste de presigned PUT URLs (une par chunk de 10 Mo)
import crypto from 'crypto'
import { CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from './_lib/r2.js'

const CHUNK_SIZE = 20 * 1024 * 1024 // 20 Mo

// Accepte tout type video/* plutôt qu'une liste figée (évite les refus sur formats téléphone rares)
function isVideoType(ct) {
  return typeof ct === 'string' && ct.startsWith('video/')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { filename, contentType, fileSize } = req.body || {}

  if (!contentType || !fileSize || !isVideoType(contentType)) {
    return res.status(400).json({ error: 'Paramètres manquants ou type non autorisé.' })
  }

  const ext = (filename?.split('.').pop() || 'mp4').toLowerCase()
  const key = `${crypto.randomUUID()}.${ext}`

  const { UploadId } = await r2.send(new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  }))

  const partCount = Math.ceil(fileSize / CHUNK_SIZE)

  const parts = await Promise.all(
    Array.from({ length: partCount }, (_, i) => i + 1).map(async (partNumber) => {
      const url = await getSignedUrl(r2, new UploadPartCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId,
        PartNumber: partNumber,
      }), { expiresIn: 7200 })
      return { partNumber, url }
    })
  )

  res.status(200).json({
    uploadId: UploadId,
    key,
    publicUrl: `${R2_PUBLIC_URL}/${key}`,
    parts,
    chunkSize: CHUNK_SIZE,
  })
}
