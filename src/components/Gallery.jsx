import { useState, useCallback, useEffect } from 'react'
import MediaCard from './MediaCard.jsx'
import Lightbox from './Lightbox.jsx'
import UploadModal from './UploadModal.jsx'
import SelectionBar from './SelectionBar.jsx'
import DownloadCodeModal from './DownloadCodeModal.jsx'
import UploadQueue from './UploadQueue.jsx'
import { useMedia } from '../hooks/useMedia.js'
import { useSettings } from '../hooks/useSettings.js'
import { supabase } from '../lib/supabase.js'
import { downloadSingle } from '../lib/downloadHelpers.js'
import { logger } from '../lib/logger.js'
import { multipartUpload } from '../lib/multipartUpload.js'

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'photo', label: 'Photos' },
  { key: 'video', label: 'Vidéos' },
]

export default function Gallery() {
  const { media, loading, error } = useMedia()
  const { downloadMode, appTitle } = useSettings()

  useEffect(() => {
    document.title = appTitle
  }, [appTitle])

  const [activeTab, setActiveTab] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [codeModalTarget, setCodeModalTarget] = useState(null)

  // Queue d'upload : tableau de { id, name, type, status, progress, speed, error }
  const [queue, setQueue] = useState([])

  function patchJob(id, patch) {
    setQueue((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }

  const isAnyActive = queue.some((j) => j.status === 'uploading' || j.status === 'waiting')

  // Bloque la fermeture de page pendant un upload actif
  useEffect(() => {
    if (!isAnyActive) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isAnyActive])

  async function handleLightboxDownload(m) {
    if (downloadMode === 'disabled') return
    if (downloadMode === 'protected') {
      setCodeModalTarget([m])
      return
    }
    try {
      await downloadSingle(m)
    } catch (err) {
      alert(`Erreur de téléchargement : ${err.message}`)
    }
  }

  async function uploadSingle(fileObj, pseudo, jobId) {
    const isVideo = fileObj.raw.type.startsWith('video/') || fileObj.type === 'video'
    const contentType = fileObj.raw.type || (isVideo ? 'video/mp4' : 'image/jpeg')

    if (isVideo) {
      // Vidéo → multipart upload vers R2
      const lastRef = { time: Date.now(), loaded: 0 }
      let result
      try {
        result = await multipartUpload(fileObj.raw, contentType, (loaded, total) => {
          const now = Date.now()
          const elapsed = (now - lastRef.time) / 1000
          let speed = 0
          if (elapsed > 0.5) {
            speed = (loaded - lastRef.loaded) / elapsed / (1024 * 1024)
            lastRef.time = now
            lastRef.loaded = loaded
          }
          patchJob(jobId, { progress: Math.min(95, Math.round((loaded / total) * 95)), speed })
        })
      } catch (err) {
        const short = err.message?.split('?')[0].slice(0, 120) || 'Erreur inconnue'
        logger.error('upload:multipart', err.message, { filename: fileObj.raw.name, contentType })
        throw new Error("Échec upload vidéo : " + short)
      }

      const { key, publicUrl } = result
      const { error: dbError } = await supabase.from('media').insert({
        pseudo: pseudo.trim() || 'Invité anonyme',
        storage_path: key,
        public_url: publicUrl,
        type: 'video',
        duration_seconds: fileObj.duration || null,
        source: 'r2',
      })
      if (dbError) {
        logger.error('upload:supabase-insert', dbError.message, { key, type: 'video' })
        throw dbError
      }
      logger.info('upload:success', 'Vidéo uploadée', { key, sizeMB: (fileObj.raw.size / 1048576).toFixed(1), duration: fileObj.duration })

    } else {
      // Photo → Supabase Storage
      const ext = fileObj.raw.name.split('.').pop() || 'jpg'
      const fileName = `${crypto.randomUUID()}.${ext}`
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/wedding-media/${fileName}`)
        xhr.setRequestHeader('apikey', supabaseKey)
        xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.setRequestHeader('cache-control', 'max-age=3600')
        const lastRef = { time: Date.now(), loaded: 0 }
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return
          const now = Date.now()
          const elapsed = (now - lastRef.time) / 1000
          let speed = 0
          if (elapsed > 0.5) {
            speed = (e.loaded - lastRef.loaded) / elapsed / (1024 * 1024)
            lastRef.time = now
            lastRef.loaded = e.loaded
          }
          patchJob(jobId, { progress: Math.min(95, Math.round((e.loaded / e.total) * 95)), speed })
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            logger.error('upload:storage-put', `Storage PUT ${xhr.status}`, { status: xhr.status, response: xhr.responseText.slice(0, 500) })
            reject(new Error(`Erreur serveur ${xhr.status}`))
          }
        }
        xhr.onerror = () => {
          logger.error('upload:storage-network', 'Erreur réseau', { filename: fileObj.raw.name })
          reject(new Error('Erreur réseau.'))
        }
        xhr.send(fileObj.raw)
      })

      const { data: urlData } = supabase.storage.from('wedding-media').getPublicUrl(fileName)
      if (!urlData?.publicUrl) throw new Error("Impossible de récupérer l'URL publique.")

      const { error: dbError } = await supabase.from('media').insert({
        pseudo: pseudo.trim() || 'Invité anonyme',
        storage_path: fileName,
        public_url: urlData.publicUrl,
        type: 'photo',
        duration_seconds: null,
        source: 'supabase',
      })
      if (dbError) {
        logger.error('upload:supabase-insert', dbError.message, { fileName, type: 'photo' })
        throw dbError
      }
      logger.info('upload:success', 'Photo uploadée', { fileName, sizeMB: (fileObj.raw.size / 1048576).toFixed(1) })
    }
  }

  async function startUpload(filesArg, pseudo) {
    setShowUpload(false)
    const fileList = Array.isArray(filesArg) ? filesArg : [filesArg]

    const newJobs = fileList.map((f, i) => ({
      id: `job-${Date.now()}-${i}`,
      name: f.raw.name,
      type: f.raw.type.startsWith('video/') || f.type === 'video' ? 'video' : 'photo',
      status: 'waiting',
      progress: 0,
      speed: 0,
      error: null,
    }))
    setQueue(newJobs)

    let hadError = false
    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i]
      setQueue((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'uploading' } : j)))
      try {
        await uploadSingle(fileList[i], pseudo, job.id)
        setQueue((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'done', progress: 100, speed: 0 } : j)))
      } catch (err) {
        setQueue((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'error', speed: 0, error: err.message || 'Erreur inconnue' } : j)))
        hadError = true
      }
    }

    if (!hadError) {
      setTimeout(() => setQueue([]), 4000)
    }
  }

  const photoCount = media.filter((m) => m.type === 'photo').length
  const videoCount = media.filter((m) => m.type === 'video').length
  const filteredMedia = activeTab === 'all' ? media : media.filter((m) => m.type === activeTab)
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

  function selectAll() { setSelectedIds(new Set(filteredMedia.map((m) => m.id))) }
  function deselectAll() { setSelectedIds(new Set()) }
  function exitSelectionMode() { setSelectionMode(false); setSelectedIds(new Set()) }
  function switchTab(key) { setActiveTab(key); exitSelectionMode() }

  if (!loading && downloadMode === 'disabled') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#FDFAF6' }}>
        <div className="max-w-sm">
          <p className="text-6xl mb-6">💍</p>
          <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
            {appTitle}
          </h1>
          <div className="w-16 h-px mx-auto mb-5" style={{ background: '#C9A84C' }} />
          <p className="text-base font-medium mb-2" style={{ color: '#2C2C2C' }}>La galerie est fermée</p>
          <p className="text-sm" style={{ color: '#8A7F72' }}>Merci d'avoir partagé ces beaux moments avec nous.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#FDFAF6' }}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gold/20 px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
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
                  <button onClick={selectAll} className="text-xs underline" style={{ color: '#C9A84C' }}>Tout</button>
                  <button onClick={deselectAll} className="text-xs underline" style={{ color: '#8A7F72' }}>Aucun</button>
                  <button onClick={exitSelectionMode} className="text-xs px-2 py-1 rounded border" style={{ borderColor: '#8A7F72', color: '#8A7F72' }}>
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>

          {!loading && media.length > 0 && (
            <div className="flex gap-2 mt-3">
              {TABS.map((tab) => {
                const count = tab.key === 'all' ? media.length : tab.key === 'photo' ? photoCount : videoCount
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => switchTab(tab.key)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                    style={{ background: active ? '#C9A84C' : '#C9A84C18', color: active ? '#fff' : '#8A7F72' }}
                  >
                    {tab.label} <span className="opacity-70 text-xs">({count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </header>

      {/* ─── Contenu principal ─── */}
      <main className="max-w-5xl mx-auto px-2 py-3 pb-32">
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

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-card bg-gray-200 animate-pulse aspect-square" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-16 text-red-500">
            <p className="text-4xl mb-3">⚠️</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && media.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📷</p>
            <p className="text-lg font-medium" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
              Aucun souvenir pour l'instant
            </p>
            <p className="text-sm mt-2" style={{ color: '#8A7F72' }}>Soyez le premier à partager un moment !</p>
          </div>
        )}

        {!loading && media.length > 0 && filteredMedia.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{activeTab === 'photo' ? '📷' : '🎥'}</p>
            <p className="text-sm" style={{ color: '#8A7F72' }}>
              Aucune {activeTab === 'photo' ? 'photo' : 'vidéo'} pour l'instant.
            </p>
          </div>
        )}

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
      {!selectionMode && downloadMode === 'open' && (
        <button
          onClick={() => setShowUpload(true)}
          className="fixed bottom-6 right-4 z-30 flex items-center gap-2 px-4 rounded-full shadow-lg font-semibold text-white transition-transform hover:scale-105 active:scale-95"
          style={{ background: '#C9A84C', minHeight: '56px', fontSize: '15px' }}
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

      {/* ─── Queue d'upload ─── */}
      <UploadQueue
        jobs={queue}
        onDismissError={(id) => setQueue((prev) => prev.filter((j) => j.id !== id))}
      />

      {/* ─── Barre de sélection ─── */}
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
