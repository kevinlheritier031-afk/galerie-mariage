// Visionneuse plein écran pour photos et vidéos
// Photos : navigation gauche/droite avec flèches et touches clavier
// Vidéos : lecteur HTML5 natif centré
// Fermeture par clic sur l'overlay, bouton ✕ ou touche Escape
import { useEffect, useCallback, useState } from 'react'
import VideoPlayer from './VideoPlayer.jsx'

export default function Lightbox({ media, currentIndex, onClose, onPrev, onNext, downloadMode, onDownload }) {
  const current = media[currentIndex]
  const [downloadDone, setDownloadDone] = useState(false)

  function handleDownloadClick(e) {
    e.stopPropagation()
    onDownload(current)
    setDownloadDone(true)
    setTimeout(() => setDownloadDone(false), 2500)
  }
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < media.length - 1

  // Navigation clavier : Escape ferme, flèches naviguent
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    },
    [onClose, onPrev, onNext, hasPrev, hasNext]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // Bloque le scroll du fond pendant que le lightbox est ouvert
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  if (!current) return null

  return (
    // Overlay sombre avec fade-in
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      {/* Barre haute : télécharger + fermer */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {downloadMode !== 'disabled' && onDownload && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white transition-all active:scale-95"
            style={{ background: downloadDone ? 'rgba(34,197,94,0.9)' : 'rgba(201,168,76,0.85)' }}
            onClick={handleDownloadClick}
            aria-label="Télécharger"
          >
            {downloadDone ? '✓ Lancé !' : '💾 Télécharger'}
          </button>
        )}
        <button
          className="text-white text-3xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* Flèche gauche */}
      {hasPrev && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-4xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          aria-label="Précédent"
        >
          ‹
        </button>
      )}

      {/* Contenu principal — stoppe la propagation pour ne pas fermer au clic sur le média */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {current.type === 'video' ? (
          <VideoPlayer src={current.public_url} />
        ) : (
          <img
            src={current.public_url}
            alt={`Photo de ${current.pseudo}`}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
            draggable={false}
          />
        )}

        {/* Métadonnées : pseudo et horodatage */}
        <div className="text-white/80 text-sm text-center">
          <span className="font-medium text-white">{current.pseudo || 'Invité anonyme'}</span>
          {' · '}
          {new Date(current.created_at).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {/* Flèche droite */}
      {hasNext && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-4xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); onNext() }}
          aria-label="Suivant"
        >
          ›
        </button>
      )}

      {/* Compteur discret en bas */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
        {currentIndex + 1} / {media.length}
      </div>
    </div>
  )
}
