// Validation des fichiers avant upload
// Photos : vérification du type MIME uniquement
// Vidéos : vérification durée et taille via un élément video temporaire

// Charge les limites depuis les variables d'environnement
const MAX_VIDEO_DURATION = parseInt(import.meta.env.VITE_MAX_VIDEO_DURATION || '60', 10)
const MAX_VIDEO_SIZE_MB = parseInt(import.meta.env.VITE_MAX_VIDEO_SIZE_MB || '2048', 10)

/**
 * Valide une photo — vérifie uniquement le type MIME
 * Retourne { valid: true } ou { valid: false, error: string }
 */
export function validatePhoto(file) {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Le fichier sélectionné n\'est pas une image.' }
  }
  return { valid: true }
}

/**
 * Valide une vidéo — vérifie la taille et la durée
 * La durée est lue en chargeant le fichier dans un élément video temporaire invisible
 * Retourne une Promise<{ valid: true, duration: number } | { valid: false, error: string }>
 */
export function validateVideo(file) {
  return new Promise((resolve) => {
    // Vérification taille d'abord (synchrone, pas besoin de charger le fichier)
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > MAX_VIDEO_SIZE_MB) {
      resolve({
        valid: false,
        error: `La vidéo dépasse la limite de ${MAX_VIDEO_SIZE_MB} Mo (taille actuelle : ${sizeMB.toFixed(1)} Mo).`,
      })
      return
    }

    // Vérification durée via un élément video temporaire
    const video = document.createElement('video')
    video.preload = 'metadata'
    // Crée une URL temporaire en mémoire pour lire les métadonnées sans uploader
    const objectUrl = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      // Libère la mémoire immédiatement après lecture des métadonnées
      URL.revokeObjectURL(objectUrl)
      const duration = Math.round(video.duration)

      if (duration > MAX_VIDEO_DURATION) {
        resolve({
          valid: false,
          error: `La vidéo dépasse la limite de ${MAX_VIDEO_DURATION} secondes (durée : ${duration}s).`,
        })
        return
      }

      resolve({ valid: true, duration })
    }

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ valid: false, error: 'Impossible de lire ce fichier vidéo.' })
    }

    video.src = objectUrl
  })
}
