import { useState, useCallback, useEffect, useRef } from 'react'
import * as tus from 'tus-js-client'
import MediaCard from './MediaCard.jsx'
import Lightbox from './Lightbox.jsx'
import UploadModal from './UploadModal.jsx'
import SelectionBar from './SelectionBar.jsx'
import DownloadCodeModal from './DownloadCodeModal.jsx'
import { useMedia } from '../hooks/useMedia.js'
import { useSettings } from '../hooks/useSettings.js'
import { supabase } from '../lib/supabase.js'
import { downloadSingle } from '../lib/downloadHelpers.js'

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'photo', label: 'Photos' },
  { key: 'video', label: 'Vidéos' },
]

export default function Gallery() {
  const { media, loading, error } = useMedia()
  const { downloadMode, appTitle } = useSettings()

  // Met à jour le titre de l'onglet navigateur en temps réel
  useEffect(() => {
    document.title = appTitle
  }, [appTitle])
  const [activeTab, setActiveTab] = useState('all')

  const [lightboxIndex, setLightboxIndex] = useState(null)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const [showUpload, setShowUpload] = useState(false)
  // codeModalTarget = tableau de médias à télécharger après saisie du code
  // null = modal fermée, [media, ...] = modal ouverte pour cette liste
  const [codeModalTarget, setCodeModalTarget] = useState(null)

  // Upload en arrière-plan : persiste même si la modal est fermée
  const [uploadJob, setUploadJob] = useState({ active: false, progress: 0, speed: 0, done: false, error: null, current: 0, total: 0 })
  const tusUploadRef = useRef(null)

  // Bloque la fermeture de page pendant un upload actif
  useEffect(() => {
    if (!uploadJob.active) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploadJob.active])

  // Téléchargement depuis le lightbox (un seul média)
  async function handleLightboxDownload(media) {
    if (downloadMode === 'disabled') return
    if (downloadMode === 'protected') {
      setCodeModalTarget([media])
      return
    }
    try {
      await downloadSingle(media)
    } catch (err) {
      alert(`Erreur de téléchargement : ${err.message}`)
    }
  }

  async function uploadSingle(fileObj, pseudo, type, current, total) {
    const actualType = fileObj.type || type
    const ext = fileObj.raw.name.split('.').pop() || (actualType === 'video' ? 'mp4' : 'jpg')
    const fileName = `${crypto.randomUUID()}.${ext}`
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const contentType = fileObj.raw.type || (actualType === 'video' ? 'video/mp4' : 'image/jpeg')

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/wedding-media/${fileName}`)
      xhr.setRequestHeader('apikey', supabaseKey)
      xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.setRequestHeader('cache-control', 'max-age=3600')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const now = Date.now()
          const pct = Math.round((e.loaded / e.total) * 95)
          setUploadJob((prev) => {
            const elapsed = (now - (prev._lastTime || now)) / 1000
            const speedMBs = elapsed > 0.5
              ? (e.loaded - (prev._lastLoaded || 0)) / elapsed / (1024 * 1024)
              : (prev.speed || 0)
            return { ...prev, progress: pct, speed: speedMBs, _lastLoaded: e.loaded, _lastTime: now, current, total }
          })
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Erreur serveur ${xhr.status} : ${xhr.responseText}`))
      }
      xhr.onerror = () => reject(new Error('Erreur réseau.'))
      xhr.send(fileObj.raw)
    })

    setUploadJob((prev) => ({ ...prev, progress: 95, speed: 0 }))

    const { data: urlData } = supabase.storage.from('wedding-media').getPublicUrl(fileName)
    if (!urlData?.publicUrl) throw new Error("Impossible de récupérer l'URL publique.")

    const { error: dbError } = await supabase.from('media').insert({
      pseudo: pseudo.trim() || 'Invité anonyme',
      storage_path: fileName,
      public_url: urlData.publicUrl,
      type: actualType,
      duration_seconds: fileObj.duration || null,
    })

    if (dbError) throw dbError
  }

  async function startUpload(filesArg, pseudo, type) {
    setShowUpload(false)
    const fileList = Array.isArray(filesArg) ? filesArg : [filesArg]
    const total = fileList.length
    setUploadJob({ active: true, progress: 0, speed: 0, done: false, error: null, current: 1, total })

    try {
      for (let i = 0; i < fileList.length; i++) {
        setUploadJob((prev) => ({ ...prev, current: i + 1, total, progress: 0, speed: 0 }))
        await uploadSingle(fileList[i], pseudo, type, i + 1, total)
      }

      setUploadJob({ active: false, progress: 100, done: true, error: null, current: total, total })
      setTimeout(() => setUploadJob({ active: false, progress: 0, done: false, error: null, current: 0, total: 0 }), 3000)
    } catch (err) {
      setUploadJob({ active: false, progress: 0, done: false, error: err.message || 'Une erreur est survenue.', current: 0, total: 0 })
    }
  }

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

  // Mode désactivé : site entièrement bloqué
  if (!loading && downloadMode === 'disabled') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#FDFAF6' }}>
        <div className="max-w-sm">
          <p className="text-6xl mb-6">💍</p>
          <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
            {appTitle}
          </h1>
          <div className="w-16 h-px mx-auto mb-5" style={{ background: '#C9A84C' }} />
          <p className="text-base font-medium mb-2" style={{ color: '#2C2C2C' }}>
            La galerie est fermée
          </p>
          <p className="text-sm" style={{ color: '#8A7F72' }}>
            Merci d'avoir partagé ces beaux moments avec nous.
          </p>
        </div>
      </div>
    )
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
              {appTitle}
            </h1>

            <div className="flex items-center gap-3">
              {!selectionMode && media.length > 0 && (
                <>
                  <span className="text-sm hidden sm:block" style={{ color: '#8A7F72' }}>
                    {media.length} souvenir{media.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="text-sm px-3 py-1.5 rounded-lg border font-medium"
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
        {/* Intro : explication rapide pour les invités */}
        {!loading && downloadMode === 'open' && (
          <div className="text-center px-4 pt-3 pb-4 mb-1">
            <p className="text-sm leading-relaxed" style={{ color: '#8A7F72' }}>
              Appuyez sur{' '}
              <span className="font-semibold" style={{ color: '#C9A84C' }}>📷 Ajouter</span>{' '}
              pour prendre une photo en direct via votre appareil photo{' '}
              <span className="font-medium" style={{ color: '#C9A84C' }}>ou</span>{' '}
              importer vos propres clichés depuis votre galerie —{' '}
              chaque souvenir partagé sera visible par tous les invités.
            </p>
          </div>
        )}

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

      {/* ─── Bouton flottant Ajouter (masqué en mode protégé et désactivé) ─── */}
      {!selectionMode && downloadMode === 'open' && (
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
          downloadMode={downloadMode}
          onDownload={handleLightboxDownload}
        />
      )}

      {/* ─── Modal upload ─── */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onStartUpload={startUpload}
        />
      )}

      {/* ─── Toast upload arrière-plan ─── */}
      {(uploadJob.active || uploadJob.done || uploadJob.error) && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-xl px-4 py-3 w-72 border"
          style={{ borderColor: '#C9A84C40' }}
        >
          {uploadJob.active && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold" style={{ color: '#2C2C2C' }}>
                  ⬆️ Envoi en cours…{uploadJob.total > 1 ? ` (${uploadJob.current}/${uploadJob.total})` : ''} {uploadJob.progress}%
                </p>
                {uploadJob.speed > 0 && (
                  <p className="text-xs" style={{ color: '#8A7F72' }}>
                    {uploadJob.speed < 1
                      ? `${(uploadJob.speed * 1024).toFixed(0)} Ko/s`
                      : `${uploadJob.speed.toFixed(1)} Mo/s`}
                  </p>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${uploadJob.progress}%`, background: '#C9A84C' }}
                />
              </div>
            </>
          )}
          {uploadJob.done && (
            <p className="text-sm font-semibold text-green-700">
              ✅ {uploadJob.total > 1 ? `${uploadJob.total} souvenirs partagés` : 'Souvenir partagé'} avec tous 🎉
            </p>
          )}
          {uploadJob.error && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-red-600">❌ {uploadJob.error}</p>
              <button
                onClick={() => setUploadJob({ active: false, progress: 0, done: false, error: null })}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Barre de sélection fixe ─── */}
      <SelectionBar
        selectedMedia={selectedMedia}
        downloadMode={downloadMode}
        onRequestCode={() => setCodeModalTarget(selectedMedia)}
        onClear={exitSelectionMode}
      />

      {/* ─── Modal code téléchargement ─── */}
      {codeModalTarget !== null && (
        <DownloadCodeModal
          selectedMedia={codeModalTarget}
          onClose={() => setCodeModalTarget(null)}
        />
      )}
    </div>
  )
}
