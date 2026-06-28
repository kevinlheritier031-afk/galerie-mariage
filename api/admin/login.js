import { createAdminToken } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { password } = req.body || {}
  const adminPassword = process.env.ADMIN_PASSWORD
  const jwtSecret = process.env.ADMIN_JWT_SECRET

  if (!adminPassword || !jwtSecret) {
    return res.status(500).json({ error: 'Configuration serveur manquante.' })
  }

  if (!password || password !== adminPassword) {
    // Délai anti-bruteforce même côté serveur
    await new Promise((r) => setTimeout(r, 500))
    return res.status(401).json({ error: 'Mot de passe incorrect.' })
  }

  const token = createAdminToken(jwtSecret)
  res.status(200).json({ token })
}
