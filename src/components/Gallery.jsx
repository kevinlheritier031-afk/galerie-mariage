import { useState, useCallback } from 'react'
import MediaCard from './MediaCard.jsx'
import Lightbox from './Lightbox.jsx'
import UploadModal from './UploadModal.jsx'
import SelectionBar from './SelectionBar.jsx'
import DownloadCodeModal from './DownloadCodeModal.jsx'
import { useMedia } from '../hooks/useMedia.js'
import { useSettings } from '../hooks/useSettings.js'

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'photo', label: 'Photos' },
  { key: 'video', label: 'Vidéos' },
]

export default function Gallery() {
  const { media, loading, error } = useMedia()
  const { downloadMode } = useSettings()
  const [activeTab, setActiveTab] = useState('all')

  const [lightboxIndex, setLightboxIndex] = useState(null)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const [showUpload, setShowUpload] = useState(false)
  const [showCodeModal, setShowCodeModal] = useState(false)

  const photoCount = media.filter((m) => m.type === 'photo').length
  const videoCount = media.filter((m) => m.type === 'video').length

  const filteredMedia =
    activeTab === 'all' ? media : media.filter((m) => m.type === activeTab)

  const selectedMedia = media.filter((m) => selectedIds.has(m.id))

  const activateSelectionMode = useCallback(() => setSelectionMode(true), [])

  function toggleSelect(m) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(m.id)) next.delete(m.id)
      else next.add(m.id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(filteredMedia.map((m) => m.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  function switchTab(key) {
    setActiveTab(key)
    exitSelectionMode()
  }

  return (
    <div className="min-h-screen" style={{ background: '#FDFAF6' }}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gold/20 px-4 py-3">
        <div className="max-w-5xl mx-auto">
          {/* Ligne titre + actions */}
          <div className="flex items-center justify-between">
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}
            >
              Notre Mariage 💍
            </h1>

            <div className="flex items-center gap-3">
              {!selectionMode && media.length > 0 && (
                <>
                  <span className="text-sm hidden sm:block" style={{ color: '#8A7F72' }}>
                    {media.length} souvenir{media.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="hidden sm:block text-sm px-3 py-1.5 rounded-lg border font-medium"
                    style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
                  >
                    Sélectionner
                  </button>
                </>
              )}

              {selectionMode && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium" style={{ color: '#2C2C2C' }}>
                    {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                  </span>
                  <button onClick={selectAll} className="text-xs underline" style={{ color: '#C9A84C' }}>
                    Tout
                  </button>
                  <button onClick={deselectAll} className="text-xs underline" style={{ color: '#8A7F72' }}>
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

          {/* Onglets Tout / Photos / Vidéos */}
          {!loading && media.length > 0 && (
            <div className="flex gap-2 mt-3">
              {TABS.map((tab) => {
                const count =
                  tab.key === 'all' ? media.length
                  : tab.key === 'photo' ? photoCount
                  : videoCount
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => switchTab(tab.key)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                    style={{
                      background: active ? '#C9A84C' : '#C9A84C18',
                      color: active ? '#fff' : '#8A7F72',
                    }}
                  >
                    {tab.label}{' '}
                    <span className="opacity-70 text-xs">({count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </header>

      {/* ─── Contenu principal ─── */}
      <main className="max-w-5xl mx-auto px-2 py-3 pb-32">
        {/* Chargement */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
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

        {/* Onglet vide mais galerie non vide */}
        {!loading && media.length > 0 && filteredMedia.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{activeTab === 'photo' ? '📷' : '🎥'}</p>
            <p className="text-sm" style={{ color: '#8A7F72' }}>
              Aucune {activeTab === 'photo' ? 'photo' : 'vidéo'} pour l'instant.
            </p>
          </div>
        )}

        {/* Grille 2 cols mobile / 3 tablette / 4 desktop */}
        {!loading && filteredMedia.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredMedia.map((m) => {
              const originalIndex = media.findIndex((item) => item.id === m.id)
              return (
                <MediaCard
                  key={m.id}
                  media={m}
                  isSelectionMode={selectionMode}
                  isSelected={selectedIds.has(m.id)}
                  onSelect={toggleSelect}
                  onOpenLightbox={() => setLightboxIndex(originalIndex)}
                  onActivateSelectionMode={activateSelectionMode}
                />
              )
            })}
          </div>
        )}
      </main>

      {/* ─── Bouton flottant Ajouter ─── */}
      {!selectionMode && (
        <button
          onClick={() => setShowUpload(true)}
          className="fixed bottom-6 right-4 z-30 flex items-center gap-2 px-4 rounded-full shadow-lg font-semibold text-white transition-transform hover:scale-105 active:scale-95"
          style={{ background: '#C9A84C', minHeight: '56px', fontSize: '15px' }}
        >
          📷 Ajouter
        </button>
      )}

      {/* ─── Lightbox (navigue dans tous les médias) ─── */}
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
