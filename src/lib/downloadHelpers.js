// Génération de ZIP côté navigateur sans serveur
// Utilise JSZip pour assembler les médias sélectionnés
// Les fichiers sont téléchargés depuis les URLs publiques Supabase
import JSZip from 'jszip'

/**
 * Formate un nom de fichier lisible à partir d'un média
 * Format : Pseudo_2024-06-15_14h32.jpg (ou .mp4 pour les vidéos)
 * Gère les doublons en ajoutant un index (1), (2), etc.
 */
function buildFileName(media, usedNames) {
  const date = new Date(media.created_at)
  const dateStr = date.toISOString().slice(0, 10) // 2024-06-15
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const timeStr = `${hours}h${minutes}`

  // Nettoie le pseudo pour supprimer les caractères interdits dans les noms de fichiers
  const safePseudo = (media.pseudo || 'Invite').replace(/[^a-zA-ZÀ-ÿ0-9_-]/g, '_').slice(0, 30)

  const ext = media.type === 'video' ? 'mp4' : getImageExtension(media.public_url)
  let baseName = `${safePseudo}_${dateStr}_${timeStr}`
  let fileName = `${baseName}.${ext}`

  // Évite les doublons de nom dans le ZIP
  let index = 1
  while (usedNames.has(fileName)) {
    fileName = `${baseName}_(${index}).${ext}`
    index++
  }

  usedNames.add(fileName)
  return fileName
}

/**
 * Extrait l'extension depuis une URL
 * Fallback sur jpg si non détectable
 */
function getImageExtension(url) {
  const match = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toLowerCase() : 'jpg'
}

/**
 * Point d'entrée principal : 1 fichier = téléchargement direct, 2+ = ZIP
 * Même comportement que Google Photos, iCloud, Dropbox
 */
export async function downloadMedia(mediaList, onProgress) {
  if (mediaList.length === 1) {
    return downloadSingle(mediaList[0])
  }
  return downloadAsZip(mediaList, onProgress)
}

/**
 * Télécharge les médias sélectionnés et les emballe dans un ZIP
 * Puis déclenche le téléchargement via un lien <a> temporaire
 *
 * @param {Array} mediaList - Liste des médias à inclure
 * @param {Function} onProgress - Callback (current, total) pour la progression
 */
export async function downloadAsZip(mediaList, onProgress) {
  const zip = new JSZip()
  const usedNames = new Set()
  const total = mediaList.length

  for (let i = 0; i < mediaList.length; i++) {
    const media = mediaList[i]

    // Télécharge le fichier via le proxy pour avoir le bon MIME type
    const proxyUrl = `/api/download?url=${encodeURIComponent(media.public_url)}&filename=${encodeURIComponent(buildFileName(media, new Set()))}`
    const response = await fetch(proxyUrl)
    if (!response.ok) {
      throw new Error(`Impossible de télécharger : ${media.public_url}`)
    }

    const blob = await response.blob()
    const fileName = buildFileName(media, usedNames)

    // Ajoute le fichier au ZIP avec son nom lisible
    zip.file(fileName, blob)

    // Notifie l'avancement
    if (onProgress) onProgress(i + 1, total)
  }

  // Génère le ZIP en mémoire et déclenche le téléchargement
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const downloadUrl = URL.createObjectURL(zipBlob)

  // window.open plutôt que link.click() pour éviter la navigation de la page courante sur mobile
  const zipName = `galerie-mariage-${new Date().toISOString().slice(0, 10)}.zip`
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = zipName
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Libère la mémoire après 60 secondes
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000)
}

/**
 * Télécharge un seul média via le proxy serveur.
 * window.location.href déclenche le téléchargement dans l'onglet courant :
 * Chrome détecte Content-Disposition: attachment et télécharge sans naviguer,
 * sans ouvrir de nouvel onglet Chrome qui afficherait un lien content://.
 */
export function downloadSingle(media) {
  const fileName = buildFileName(media, new Set())
  const proxyUrl = `/api/download?url=${encodeURIComponent(media.public_url)}&filename=${encodeURIComponent(fileName)}`
  window.location.href = proxyUrl
}
