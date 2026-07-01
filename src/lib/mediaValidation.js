// Validation des fichiers avant upload
// Photos : vérification du type MIME uniquement
// Vidéos : vérification durée uniquement — pas de limite de taille (R2 gère jusqu'à 5 Go)

const MAX_VIDEO_DURATION = 180

export function validatePhoto(file) {
  if (file.type.startsWith('video/')) {
    return { valid: false, error: 'Les vidéos ne sont pas acceptées, seulement les photos.' }
  }
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Le fichier sélectionné n\'est pas une image.' }
  }
  return { valid: true }
}

export function validateVideo(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const objectUrl = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
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
