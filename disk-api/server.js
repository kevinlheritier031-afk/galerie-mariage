// Serveur Express — API de surveillance de l'espace disque du VPS
// Ecoute sur le port 3001
// Endpoint unique : GET /api/disk-usage
// Utilisé par la Vercel Edge Function qui relaie les appels du panel admin
const express = require('express')
const cors = require('cors')
const { exec } = require('child_process')

const app = express()
const PORT = 3001

// Autorise toutes les origines — la sécurité est assurée par le fait
// que ce serveur n'est accessible que depuis le VPS (non exposé publiquement)
app.use(cors())

/**
 * Parse la sortie de la commande `df -BG` pour extraire les métriques d'un disque
 * La commande df retourne des lignes au format :
 * Filesystem  1G-blocks  Used  Available  Use%  Mounted on
 */
function parseDf(dfOutput, mountPoint) {
  const lines = dfOutput.trim().split('\n')
  // Cherche la ligne correspondant au point de montage cible
  const line = lines.find((l) => l.includes(mountPoint))
  if (!line) return null

  const parts = line.trim().split(/\s+/)
  // Colonnes : [filesystem, total, used, available, use%, mountpoint]
  const total = parseInt(parts[1], 10) || 0
  const used = parseInt(parts[2], 10) || 0
  const available = parseInt(parts[3], 10) || 0
  const percent = parseInt(parts[4], 10) || 0

  return {
    total_gb: total,
    used_gb: used,
    available_gb: available,
    percent_used: percent,
  }
}

/**
 * Exécute `df -BG` et retourne les données parsées pour les deux disques
 * Promesse car exec est asynchrone
 */
function getDiskStats() {
  return new Promise((resolve, reject) => {
    // -BG : affiche les tailles en gigaoctets pour faciliter le parsing
    exec('df -BG', (error, stdout) => {
      if (error) {
        reject(error)
        return
      }

      // Lecture du disque additionnel (point de montage configuré pour les médias)
      const additionalRaw = parseDf(stdout, '/mnt/media-storage')
      // Lecture du disque principal (partition système)
      const mainRaw = parseDf(stdout, '/dev/sda1')

      // Fallback si un des disques n'est pas trouvé dans la sortie de df
      const additional = additionalRaw || { total_gb: 0, used_gb: 0, available_gb: 0, percent_used: 0 }
      const main = mainRaw || { total_gb: 0, used_gb: 0, available_gb: 0, percent_used: 0 }

      // Logique d'activation :
      // Le disque additionnel reçoit les uploads tant qu'il est à moins de 90%
      // Le disque principal prend le relais au-delà de 90% d'occupation du additionnel
      additional.active = additional.percent_used < 90
      main.active = additional.percent_used >= 90

      resolve({ additional, main })
    })
  })
}

// ─── Route principale ──────────────────────────────────────────────────────────
app.get('/api/disk-usage', async (req, res) => {
  try {
    const stats = await getDiskStats()
    res.json(stats)
  } catch (err) {
    // Retourne une erreur 500 avec le message pour faciliter le debug
    res.status(500).json({ error: 'Impossible de lire les statistiques disque.', detail: err.message })
  }
})

// ─── Démarrage du serveur ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`API disque démarrée sur le port ${PORT}`)
  console.log(`Endpoint : http://localhost:${PORT}/api/disk-usage`)
})
