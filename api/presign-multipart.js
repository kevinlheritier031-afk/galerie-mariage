// Endpoint unifié pour les uploads vidéo
// action=init-put       → presigned PUT direct (fichiers < 100 Mo)
// action=init-multipart → démarre un upload multipart R2 (fichiers >= 100 Mo)
// action=complete       → CompleteMultipartUpload
// action=abort          → AbortMultipartUpload
import crypto from 'crypto'
import {
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from './_lib/r2.js'

const CHUNK_SIZE = 20 * 1024 * 1024 // 20 Mo

function isVideoType(ct) {
  return typeof ct === 'string' && ct.startsWith('video/')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { action = 'init-put', filename, contentType, fileSize, uploadId, key, parts } = req.body || {}

  // ── Finalise un multipart en cours ──
  if (action === 'complete') {
    if (!uploadId || !key || !Array.isArray(parts) || parts.length === 0)
      return res.status(400).json({ error: 'Paramètres manquants.' })
    try {
      await r2.send(new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map(({ partNumber, etag }) => ({ PartNumber: partNumber, ETag: etag })),
        },
      }))
      return res.status(200).json({ ok: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── Annule un multipart en cours ──
  if (action === 'abort') {
    if (!uploadId || !key) return res.status(400).json({ error: 'Paramètres manquants.' })
    try {
      await r2.send(new AbortMultipartUploadCommand({ Bucket: R2_BUCKET, Key: key, UploadId: uploadId }))
    } catch {}
    return res.status(200).json({ ok: true })
  }

  // ── Valide le type pour les actions d'init ──
  if (!contentType || !isVideoType(contentType))
    return res.status(400).json({ error: 'Type non autorisé.' })

  const ext = (filename?.split('.').pop() || 'mp4').toLowerCase()
  const newKey = `${crypto.randomUUID()}.${ext}`

  // ── Multipart : init + génération des presigned URLs ──
  if (action === 'init-multipart') {
    if (!fileSize) return res.status(400).json({ error: 'fileSize manquant.' })

    const { UploadId } = await r2.send(new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: newKey,
      ContentType: contentType,
    }))

    const partCount = Math.ceil(fileSize / CHUNK_SIZE)
    const presignedParts = await Promise.all(
      Array.from({ length: partCount }, (_, i) => i + 1).map(async (partNumber) => {
        const url = await getSignedUrl(r2, new UploadPartCommand({
          Bucket: R2_BUCKET,
          Key: newKey,
          UploadId,
          PartNumber: partNumber,
        }), { expiresIn: 7200 })
        return { partNumber, url }
      })
    )

    return res.status(200).json({
      uploadId: UploadId,
      key: newKey,
      publicUrl: `${R2_PUBLIC_URL}/${newKey}`,
      parts: presignedParts,
      chunkSize: CHUNK_SIZE,
    })
  }

  // ── PUT direct (défaut) ──
  const url = await getSignedUrl(r2, new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: newKey,
    ContentType: contentType,
  }), { expiresIn: 7200 })

  return res.status(200).json({ url, key: newKey, publicUrl: `${R2_PUBLIC_URL}/${newKey}` })
}
