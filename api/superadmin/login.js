import { createAdminToken } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { password } = req.body || {}
  const superPassword = process.env.SUPER_ADMIN_PASSWORD
  const jwtSecret = process.env.ADMIN_JWT_SECRET

  if (!superPassword || !jwtSecret) {
    return res.status(500).json({ error: 'Configuration serveur manquante.' })
  }

  if (!password || password !== superPassword) {
    await new Promise((r) => setTimeout(r, 500))
    return res.status(401).json({ error: 'Mot de passe incorrect.' })
  }

  const token = createAdminToken(jwtSecret, 'superadmin')
  res.status(200).json({ token })
}
