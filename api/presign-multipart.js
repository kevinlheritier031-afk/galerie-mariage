// Génère une presigned PUT URL pour upload direct navigateur → R2
// Une seule requête HTTP au lieu du cycle multipart (init + N parts + finalize)
import crypto from 'crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from './_lib/r2.js'

function isVideoType(ct) {
  return typeof ct === 'string' && ct.startsWith('video/')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { filename, contentType } = req.body || {}

  if (!contentType || !isVideoType(contentType)) {
    return res.status(400).json({ error: 'Paramètres manquants ou type non autorisé.' })
  }

  const ext = (filename?.split('.').pop() || 'mp4').toLowerCase()
  const key = `${crypto.randomUUID()}.${ext}`

  const url = await getSignedUrl(r2, new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  }), { expiresIn: 7200 })

  res.status(200).json({
    url,
    key,
    publicUrl: `${R2_PUBLIC_URL}/${key}`,
  })
}
