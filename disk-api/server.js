const express = require('express')
const cors = require('cors')
const { exec } = require('child_process')

const app = express()
const PORT = 3001

// Validation du token secret partagé avec la Vercel Function
app.use((req, res, next) => {
  const secret = process.env.DISK_API_SECRET
  if (!secret) return next() // Mode dev sans secret configuré
  if (req.headers['x-disk-secret'] !== secret) {
    return res.status(401).json({ error: 'Non autorisé.' })
  }
  next()
})

app.use(cors({ origin: false })) // CORS désactivé — accessible uniquement via la Vercel Function

function parseDf(dfOutput, mountPoint) {
  const lines = dfOutput.trim().split('\n')
  const line = lines.find((l) => l.includes(mountPoint))
  if (!line) return null
  const parts = line.trim().split(/\s+/)
  return {
    total_gb: parseInt(parts[1], 10) || 0,
    used_gb: parseInt(parts[2], 10) || 0,
    available_gb: parseInt(parts[3], 10) || 0,
    percent_used: parseInt(parts[4], 10) || 0,
  }
}

function getDiskStats() {
  return new Promise((resolve, reject) => {
    exec('df -BG', (error, stdout) => {
      if (error) { reject(error); return }
      const additionalRaw = parseDf(stdout, '/mnt/media-storage')
      const mainRaw = parseDf(stdout, '/dev/sda1')
      const additional = additionalRaw || { total_gb: 0, used_gb: 0, available_gb: 0, percent_used: 0 }
      const main = mainRaw || { total_gb: 0, used_gb: 0, available_gb: 0, percent_used: 0 }
      additional.active = additional.percent_used < 90
      main.active = additional.percent_used >= 90
      resolve({ additional, main })
    })
  })
}

app.get('/api/disk-usage', async (req, res) => {
  try {
    const stats = await getDiskStats()
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lire les statistiques disque.', detail: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`API disque démarrée sur le port ${PORT}`)
})
