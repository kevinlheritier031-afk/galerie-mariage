// Carte affichant un média (photo ou vidéo) dans la grille
// Vidéos : miniature avec icône ▶️ superposée
// Mode sélection : clic coche/décoche, bordure dorée pulsante sur sélection
// Hors mode sélection : clic ouvre le Lightbox
import { useState, useRef, useCallback } from 'react'

// Durée de l'appui long pour activer le mode sélection (ms)
const LONG_PRESS_DURATION = 600

export default function MediaCard({
  media,
  isSelectionMode,
  isSelected,
  onSelect,
  onOpenLightbox,
  onActivateSelectionMode,
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const longPressTimer = useRef(null)

  // Formate la date en heure courte : "14:32"
  const time = new Date(media.created_at).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // Détecte l'appui long sur mobile pour activer le mode sélection
  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      if (!isSelectionMode) onActivateSelectionMode()
    }, LONG_PRESS_DURATION)
  }, [isSelectionMode, onActivateSelectionMode])

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current)
  }, [])

  function handleClick() {
    if (isSelectionMode) {
      onSelect(media)
    } else {
      onOpenLightbox()
    }
  }

  return (
    <div
      className="relative rounded-card overflow-hidden cursor-pointer bg-white transition-transform duration-200 hover:scale-[1.02]"
      style={{
        boxShadow: isSelected
          ? 'none'
          : '0 2px 8px rgba(0,0,0,0.08)',
        animation: isSelected ? 'goldPulse 1.5s ease-in-out infinite' : 'none',
        border: isSelected ? '3px solid #C9A84C' : '3px solid transparent',
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      {/* Miniature du média */}
      <div className="aspect-square relative overflow-hidden bg-gray-100">
        {!imageLoaded && (
          // Placeholder de chargement
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}

        {media.type === 'video' ? (
          // Pour les vidéos : on affiche une image de prévisualisation via l'URL
          // Supabase Storage ne génère pas de miniature automatique,
          // on utilise un élément video caché pour charger la miniature
          <VideoThumbnail src={media.public_url} onLoad={() => setImageLoaded(true)} />
        ) : (
          <img
            src={media.public_url}
            alt={`Photo de ${media.pseudo}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        )}

        {/* Icône ▶️ sur les vidéos */}
        {media.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <span className="text-white text-lg ml-0.5">▶</span>
            </div>
          </div>
        )}

        {/* Case à cocher — permanente sur mobile en mode sélection, au survol desktop */}
        <div
          className={`absolute top-2 left-2 transition-opacity ${
            isSelectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 sm:opacity-0 hover:opacity-100'
          }`}
        >
          <div
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
            style={{
              background: isSelected ? '#C9A84C' : 'rgba(255,255,255,0.9)',
              borderColor: isSelected ? '#C9A84C' : 'rgba(255,255,255,0.9)',
            }}
          >
            {isSelected && <span className="text-white text-xs font-bold">✓</span>}
          </div>
        </div>

        {/* Badge type vidéo avec durée */}
        {media.type === 'video' && media.duration_seconds && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {media.duration_seconds}s
          </div>
        )}
      </div>

      {/* Infos en bas de carte */}
      <div className="px-2.5 py-2">
        <p className="text-xs font-medium truncate" style={{ color: '#2C2C2C' }}>
          {media.pseudo || 'Invité anonyme'}
        </p>
        <p className="text-xs" style={{ color: '#8A7F72' }}>
          {time}
        </p>
      </div>
    </div>
  )
}

// Miniature vidéo : charge le fichier vidéo pour capturer la première frame
function VideoThumbnail({ src, onLoad }) {
  return (
    <video
      src={src}
      className="w-full h-full object-cover"
      preload="metadata"
      muted
      playsInline
      onLoadedMetadata={onLoad}
    />
  )
}
