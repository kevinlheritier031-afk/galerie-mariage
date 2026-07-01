// Endpoint de logging centralisé
// Reçoit les événements error/warn/info depuis le client et les Vercel Functions
// et les insère dans la table logs de Supabase (accessible dans le panel admin)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { level, context, message, metadata, userAgent } = req.body || {}

  if (!level || !context || !message) {
    return res.status(400).json({ error: 'Paramètres manquants.' })
  }

  const validLevels = ['error', 'warn', 'info']
  if (!validLevels.includes(level)) {
    return res.status(400).json({ error: 'Niveau invalide.' })
  }

  const url = process.env.SUPABASE_DIRECT_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    return res.status(500).json({ error: 'Configuration Supabase manquante.' })
  }

  try {
    const dbRes = await fetch(`${url}/rest/v1/logs`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        level,
        context,
        message: String(message).slice(0, 2000),
        metadata: metadata || null,
        user_agent: (userAgent || req.headers['user-agent'] || '').slice(0, 500),
      }),
    })

    if (!dbRes.ok) {
      const err = await dbRes.text()
      return res.status(500).json({ error: err })
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
