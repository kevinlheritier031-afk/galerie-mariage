import crypto from 'crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from './_lib/r2.js'

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/webm', 'video/3gpp',
])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { filename, contentType } = req.body || {}

  if (!contentType || !ALLOWED_VIDEO_TYPES.has(contentType)) {
    return res.status(400).json({ error: 'Type de fichier non autorisé.' })
  }

  const ext = (filename?.split('.').pop() || 'mp4').toLowerCase()
  const key = `${crypto.randomUUID()}.${ext}`

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 })
  const publicUrl = `${R2_PUBLIC_URL}/${key}`

  res.status(200).json({ uploadUrl, key, publicUrl })
}
