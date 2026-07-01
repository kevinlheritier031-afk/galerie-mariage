// Validation des fichiers avant upload
// Photos : vérification du type MIME uniquement
// Vidéos : aucune limite (taille ni durée) — R2 gère jusqu'à 5 Go

export function validatePhoto(file) {
  if (file.type.startsWith('video/')) {
    return { valid: false, error: 'Les vidéos ne sont pas acceptées, seulement les photos.' }
  }
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Le fichier sélectionné n\'est pas une image.' }
  }
  return { valid: true }
}

// Lit la durée sans bloquer l'upload — aucune validation, juste pour stocker l'info en base
export function validateVideo(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const objectUrl = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ valid: true, duration: Math.round(video.duration) })
    }
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ valid: true, duration: null })
    }
    video.src = objectUrl
  })
}
