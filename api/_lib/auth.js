import crypto from 'crypto'

export function createAdminToken(secret) {
  const expiry = Date.now() + 24 * 60 * 60 * 1000
  const payload = `admin:${expiry}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(`${payload}:${hmac}`).toString('base64url')
}

export function verifyAdminToken(req) {
  const auth = req.headers['authorization'] || ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const secret = process.env.ADMIN_JWT_SECRET
  if (!secret) return false
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const lastColon = decoded.lastIndexOf(':')
    const hmac = decoded.slice(lastColon + 1)
    const payload = decoded.slice(0, lastColon)
    const [role, expiry] = payload.split(':')
    if (role !== 'admin') return false
    if (Date.now() > parseInt(expiry)) return false
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const a = Buffer.from(hmac, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
