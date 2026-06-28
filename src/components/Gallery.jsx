// Galerie publique principale — route /
// Grille responsive 1/2/3 colonnes selon la taille d'écran
// Mode sélection : appui long mobile ou bouton Sélectionner desktop
// Realtime Supabase : les nouveaux uploads apparaissent instantanément
import { useState, useCallback } from 'react'
import MediaCard from './MediaCard.jsx'
import Lightbox from './Lightbox.jsx'
import UploadModal from './UploadModal.jsx'
import SelectionBar from './SelectionBar.jsx'
import DownloadCodeModal from './DownloadCodeModal.jsx'
import { useMedia } from '../hooks/useMedia.js'
import { useSettings } from '../hooks/useSettings.js'

export default function Gallery() {
  const { media, loading, error } = useMedia()
  const { downloadMode } = useSettings()

  // État du lightbox
  const [lightboxIndex, setLightboxIndex] = useState(null)

  // État du mode sélection
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Modales
  const [showUpload, setShowUpload] = useState(false)
  const [showCodeModal, setShowCodeModal] = useState(false)

  // Médias sélectionnés sous forme de tableau (pour le ZIP)
  const selectedMedia = media.filter((m) => selectedIds.has(m.id))

  // Active le mode sélection (depuis appui long mobile)
  const activateSelectionMode = useCallback(() => {
    setSelectionMode(true)
  }, [])

  // Coche ou décoche un média
  function toggleSelect(m) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(m.id)) {
        next.delete(m.id)
      } else {
        next.add(m.id)
      }
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(media.map((m) => m.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  return (
    <div className="min-h-screen" style={{ background: '#FDFAF6' }}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gold/20 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}
          >
            Notre Mariage 💍
          </h1>

          {/* Compteur de médias + bouton sélection desktop */}
          <div className="flex items-center gap-3">
            {!selectionMode && media.length > 0 && (
              <>
                <span className="text-sm hidden sm:block" style={{ color: '#8A7F72' }}>
                  {media.length} souvenir{media.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setSelectionMode(true)}
                  className="hidden sm:block text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors"
                  style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
                >
                  Sélectionner
                </button>
              </>
            )}

            {/* Barre de contrôle sélection */}
            {selectionMode && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium" style={{ color: '#2C2C2C' }}>
                  {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                </span>
                <button
                  onClick={selectAll}
                  className="text-xs underline"
                  style={{ color: '#C9A84C' }}
                >
                  Tout
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs underline"
                  style={{ color: '#8A7F72' }}
                >
                  Aucun
                </button>
                <button
                  onClick={exitSelectionMode}
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: '#8A7F72', color: '#8A7F72' }}
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Contenu principal ─── */}
      <main className="max-w-5xl mx-auto px-3 py-4 pb-32">
        {/* État de chargement */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-card bg-gray-200 animate-pulse aspect-square" />
            ))}
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="text-center py-16 text-red-500">
            <p className="text-4xl mb-3">⚠️</p>
            <p>{error}</p>
          </div>
        )}

        {/* Galerie vide */}
        {!loading && !error && media.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📷</p>
            <p className="text-lg font-medium" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
              Aucun souvenir pour l'instant
            </p>
            <p className="text-sm mt-2" style={{ color: '#8A7F72' }}>
              Soyez le premier à partager un moment !
            </p>
          </div>
        )}

        {/* Grille responsive */}
        {!loading && media.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {media.map((m, index) => (
              <MediaCard
                key={m.id}
                media={m}
                isSelectionMode={selectionMode}
                isSelected={selectedIds.has(m.id)}
                onSelect={toggleSelect}
                onOpenLightbox={() => setLightboxIndex(index)}
                onActivateSelectionMode={activateSelectionMode}
              />
            ))}
          </div>
        )}
      </main>

      {/* ─── Bouton flottant Ajouter ─── */}
      {!selectionMode && (
        <button
          onClick={() => setShowUpload(true)}
          className="fixed bottom-6 right-4 z-30 flex items-center gap-2 px-4 rounded-full shadow-lg font-semibold text-white transition-transform hover:scale-105 active:scale-95"
          style={{
            background: '#C9A84C',
            minHeight: '56px',
            fontSize: '15px',
          }}
        >
          📷 Ajouter
        </button>
      )}

      {/* ─── Lightbox ─── */}
      {lightboxIndex !== null && (
        <Lightbox
          media={media}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, i - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(media.length - 1, i + 1))}
        />
      )}

      {/* ─── Modal upload ─── */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}

      {/* ─── Barre de sélection fixe ─── */}
      <SelectionBar
        selectedMedia={selectedMedia}
        downloadMode={downloadMode}
        onRequestCode={() => setShowCodeModal(true)}
        onClear={exitSelectionMode}
      />

      {/* ─── Modal code téléchargement ─── */}
      {showCodeModal && (
        <DownloadCodeModal
          selectedMedia={selectedMedia}
          onClose={() => setShowCodeModal(false)}
        />
      )}
    </div>
  )
}
