import { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase.js'
import { adminVideoUpload } from '../lib/adminVideoUpload.js'

const TOKEN_KEY = 'superadmin_token'

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) || ''}`,
  }
}

export default function SuperAdminPanel() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loginInput, setLoginInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (token) setAuthenticated(true)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/superadmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginInput }),
      })
      if (res.ok) {
        const { token } = await res.json()
        sessionStorage.setItem(TOKEN_KEY, token)
        setAuthenticated(true)
      } else {
        setLoginError('Mot de passe incorrect.')
        setLoginInput('')
      }
    } catch {
      setLoginError('Erreur réseau. Réessayez.')
    } finally {
      setLoginLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f0f0f' }}>
        <div className="bg-zinc-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-zinc-700">
          <div className="text-center mb-6">
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">Super Admin</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
              Accès restreint 🔐
            </h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={loginInput}
              onChange={(e) => { setLoginInput(e.target.value); setLoginError('') }}
              placeholder="Mot de passe super admin"
              className="w-full border-2 rounded-lg px-4 py-3 outline-none bg-zinc-800 text-white placeholder-zinc-500"
              style={{ borderColor: '#3f3f46' }}
              autoFocus
              disabled={loginLoading}
            />
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-lg font-semibold disabled:opacity-50 text-black"
              style={{ background: '#C9A84C' }}
            >
              {loginLoading ? 'Vérification…' : 'Connexion'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <SuperDashboard
      onLogout={() => {
        sessionStorage.removeItem(TOKEN_KEY)
        setAuthenticated(false)
      }}
    />
  )
}

function SuperDashboard({ onLogout }) {
  const [media, setMedia] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [downloadMode, setDownloadMode] = useState('open')
  const [savingMode, setSavingMode] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [appTitle, setAppTitle] = useState('Notre Mariage 💍')
  const [savingTitle, setSavingTitle] = useState(false)
  const [titleSuccess, setTitleSuccess] = useState(false)
  const [diskData, setDiskData] = useState(null)
  const [diskError, setDiskError] = useState(false)
  const [downloadCode, setDownloadCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [savingCode, setSavingCode] = useState(false)
  const [codeSuccess, setCodeSuccess] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [activeTab, setActiveTab] = useState('medias')
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsFilter, setLogsFilter] = useState('all')
  const [clearingLogs, setClearingLogs] = useState(false)

  // Upload vidéo
  const [videoFile, setVideoFile] = useState(null)
  const [videoPseudo, setVideoPseudo] = useState('Admin')
  const [videoPhase, setVideoPhase] = useState(null)
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoSpeed, setVideoSpeed] = useState(0)
  const [videoEta, setVideoEta] = useState(null)
  const [videoError, setVideoError] = useState('')
  const videoSpeedRef = useRef({ time: Date.now(), loaded: 0 })

  const photoCount = media.filter((m) => m.type === 'photo').length
  const videoCount = media.filter((m) => m.type === 'video').length
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false })
      setMedia(data || [])
      setLoadingMedia(false)
    }
    load()

    const channel = supabase.channel('superadmin-media')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'media' }, (payload) => {
        setMedia((prev) => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'media' }, (payload) => {
        setMedia((prev) => prev.filter((m) => m.id !== payload.old.id))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    async function loadSettings() {
      const [modeRes, titleRes, codeRes] = await Promise.all([
        fetch('/api/admin/settings', { headers: authHeaders() }),
        fetch('/api/admin/title', { headers: authHeaders() }),
        fetch('/api/admin/download-code', { headers: authHeaders() }),
      ])
      if (modeRes.ok) setDownloadMode((await modeRes.json()).value)
      if (titleRes.ok) setAppTitle((await titleRes.json()).value)
      if (codeRes.ok) { const d = await codeRes.json(); setDownloadCode(d.value); setNewCode(d.value) }
    }
    loadSettings()
  }, [])

  useEffect(() => {
    async function fetchDisk() {
      try {
        const res = await fetch('/api/disk-usage')
        if (!res.ok) throw new Error()
        setDiskData(await res.json())
        setDiskError(false)
      } catch {
        setDiskError(true)
      }
    }
    fetchDisk()
    const interval = setInterval(fetchDisk, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function deleteMedia(m) {
    if (!window.confirm(`Supprimer ce média de ${m.pseudo} ?`)) return
    const res = await fetch('/api/admin/delete-media', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ id: m.id, storage_path: m.storage_path, source: m.source || 'supabase' }),
    })
    if (res.ok) setMedia((prev) => prev.filter((item) => item.id !== m.id))
  }

  async function deleteSelected() {
    if (!window.confirm(`Supprimer ${selectedIds.size} média${selectedIds.size > 1 ? 's' : ''} ?`)) return
    setDeletingBulk(true)
    const targets = media.filter((m) => selectedIds.has(m.id))
    await Promise.all(
      targets.map((m) =>
        fetch('/api/admin/delete-media', {
          method: 'DELETE',
          headers: authHeaders(),
          body: JSON.stringify({ id: m.id, storage_path: m.storage_path, source: m.source || 'supabase' }),
        })
      )
    )
    setMedia((prev) => prev.filter((m) => !selectedIds.has(m.id)))
    setSelectedIds(new Set())
    setSelectionMode(false)
    setDeletingBulk(false)
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function saveTitle() {
    setSavingTitle(true)
    const res = await fetch('/api/admin/title', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ value: appTitle }) })
    setSavingTitle(false)
    if (res.ok) { setTitleSuccess(true); setTimeout(() => setTitleSuccess(false), 3000) }
  }

  async function saveDownloadCode() {
    if (!newCode.trim()) return
    setSavingCode(true)
    const res = await fetch('/api/admin/download-code', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ value: newCode }) })
    setSavingCode(false)
    if (res.ok) { setDownloadCode(newCode); setCodeSuccess(true); setTimeout(() => setCodeSuccess(false), 3000) }
  }

  async function saveDownloadMode() {
    setSavingMode(true)
    const res = await fetch('/api/admin/settings', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ value: downloadMode }) })
    setSavingMode(false)
    if (res.ok) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000) }
  }

  async function fetchLogs() {
    setLogsLoading(true)
    const res = await fetch('/api/admin/logs', { headers: authHeaders() })
    if (res.ok) setLogs(await res.json())
    setLogsLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs()
  }, [activeTab])

  async function clearAllLogs() {
    if (!window.confirm('Supprimer tous les logs ?')) return
    setClearingLogs(true)
    await fetch('/api/admin/logs', { method: 'DELETE', headers: authHeaders() })
    setLogs([])
    setClearingLogs(false)
  }

  async function handleAdminVideoUpload() {
    if (!videoFile) return
    setVideoPhase('presign')
    setVideoProgress(0)
    setVideoSpeed(0)
    setVideoEta(null)
    setVideoError('')
    videoSpeedRef.current = { time: Date.now(), loaded: 0 }

    try {
      const { key, publicUrl } = await adminVideoUpload(
        videoFile,
        videoFile.type || 'video/mp4',
        {
          onProgress: (loaded, total) => {
            const now = Date.now()
            const ref = videoSpeedRef.current
            const elapsed = (now - ref.time) / 1000
            if (elapsed > 0.5) {
              setVideoSpeed((loaded - ref.loaded) / elapsed / (1024 * 1024))
              videoSpeedRef.current = { time: now, loaded }
            }
            setVideoProgress(Math.min(95, Math.round((loaded / total) * 95)))
          },
          onPhase: (phase) => setVideoPhase(phase),
          onEta: (seconds) => setVideoEta(seconds),
        },
      )

      setVideoPhase('saving')
      const { error: dbError } = await supabase.from('media').insert({
        pseudo: videoPseudo.trim() || 'Admin',
        storage_path: key,
        public_url: publicUrl,
        type: 'video',
        source: 'r2',
      })
      if (dbError) throw dbError

      setVideoPhase('done')
      setVideoProgress(100)
      setVideoFile(null)
    } catch (err) {
      setVideoError(err.message || 'Erreur inconnue')
      setVideoPhase('error')
    }
  }

  function downloadQrCode() {
    const canvas = document.querySelector('#sa-qr-canvas canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = 'qr-galerie-mariage.png'
    link.click()
  }

  const tabs = [
    { key: 'medias', label: `📸 Médias`, badge: media.length },
    { key: 'videos', label: '🎥 Upload vidéo' },
    { key: 'parametres', label: '⚙️ Paramètres' },
    { key: 'avances', label: '🛠 Avancé' },
    { key: 'logs', label: '🪵 Logs', badge: logs.filter(l => l.level === 'error').length || undefined },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
      <header className="border-b border-zinc-800 px-4 py-3 sticky top-0 z-20" style={{ background: '#141414' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Super Admin</p>
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                Administration 👑
              </h1>
            </div>
            <button
              onClick={onLogout}
              className="text-sm px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              Déconnexion
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-3 py-1.5 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-1.5"
                style={{
                  background: activeTab === tab.key ? '#1f1f1f' : 'transparent',
                  color: activeTab === tab.key ? '#C9A84C' : '#71717a',
                  borderBottom: activeTab === tab.key ? '2px solid #C9A84C' : '2px solid transparent',
                }}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#C9A84C25', color: '#C9A84C' }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ── Médias ── */}
        {activeTab === 'medias' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                📸 Médias
                <span className="text-sm font-normal px-2 py-0.5 rounded-full" style={{ background: '#C9A84C20', color: '#C9A84C' }}>
                  {photoCount} photo{photoCount !== 1 ? 's' : ''} · {videoCount} vidéo{videoCount !== 1 ? 's' : ''} · {media.length} total
                </span>
              </h2>
              {!loadingMedia && media.length > 0 && (
                <div className="flex items-center gap-2">
                  {selectionMode && (
                    <>
                      <button onClick={() => setSelectedIds(new Set(media.map((m) => m.id)))} className="text-xs underline text-zinc-400">Tout</button>
                      <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()) }} className="text-xs underline text-zinc-500">Annuler</button>
                      {selectedIds.size > 0 && (
                        <button onClick={deleteSelected} disabled={deletingBulk} className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: '#ef4444' }}>
                          {deletingBulk ? 'Suppression…' : `🗑 Supprimer (${selectedIds.size})`}
                        </button>
                      )}
                    </>
                  )}
                  {!selectionMode && (
                    <button onClick={() => setSelectionMode(true)} className="text-xs px-3 py-1.5 rounded-lg border font-medium" style={{ borderColor: '#C9A84C', color: '#C9A84C' }}>
                      Sélectionner
                    </button>
                  )}
                </div>
              )}
            </div>

            {loadingMedia ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-lg bg-zinc-800 animate-pulse" />)}
              </div>
            ) : media.length === 0 ? (
              <p className="text-sm py-4 text-zinc-500">Aucun média pour l'instant.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {media.map((m) => {
                  const isSelected = selectedIds.has(m.id)
                  return (
                    <div
                      key={m.id}
                      className="relative rounded-lg overflow-hidden shadow-sm border-2 transition-colors"
                      style={{ borderColor: isSelected ? '#ef4444' : '#27272a', background: '#1c1c1e' }}
                      onClick={() => selectionMode && toggleSelect(m.id)}
                    >
                      <div className="aspect-square relative overflow-hidden bg-zinc-900">
                        {m.type === 'video' ? (
                          <video src={m.public_url} className="w-full h-full object-cover" preload="metadata" muted />
                        ) : (
                          <img src={m.public_url} alt={m.pseudo} className="w-full h-full object-cover" loading="lazy" />
                        )}
                        <span className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: m.type === 'video' ? '#000' : '#C9A84C', color: '#fff' }}>
                          {m.type === 'video' ? `▶ ${m.duration_seconds || '?'}s` : '📷'}
                        </span>
                        {selectionMode ? (
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ background: isSelected ? '#ef4444' : '#fff', borderColor: isSelected ? '#ef4444' : '#ccc' }}>
                            {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); deleteMedia(m) }} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500 text-white text-sm flex items-center justify-center shadow-md">×</button>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium truncate text-zinc-200">{m.pseudo || 'Anonyme'}</p>
                        <p className="text-xs text-zinc-500">{new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Upload vidéo ── */}
        {activeTab === 'videos' && (
          <section className="rounded-2xl p-5 border space-y-4" style={{ background: '#1c1c1e', borderColor: '#27272a' }}>
            <div>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>🎥 Upload vidéo</h2>
              <p className="text-xs mt-1 text-zinc-500">Upload direct vers R2, invisible des invités jusqu'à publication.</p>
            </div>

            <input type="text" value={videoPseudo} onChange={(e) => setVideoPseudo(e.target.value)} placeholder="Pseudo" maxLength={50}
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none bg-zinc-900 text-white"
              style={{ borderColor: '#3f3f46' }}
            />

            <div className="rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors"
              style={{ borderColor: '#C9A84C60' }}
              onClick={() => document.getElementById('sa-video-input').click()}
            >
              <span className="text-4xl">🎬</span>
              <span className="text-sm font-semibold text-white">{videoFile ? videoFile.name : 'Choisir une vidéo'}</span>
              {videoFile && <span className="text-xs text-zinc-400">{(videoFile.size / 1024 / 1024).toFixed(1)} Mo · {videoFile.type}</span>}
              <input id="sa-video-input" type="file" accept="video/*" className="hidden"
                onChange={(e) => { setVideoFile(e.target.files?.[0] || null); setVideoPhase(null); setVideoProgress(0); setVideoError(''); e.target.value = '' }}
              />
            </div>

            {videoFile && !videoPhase && (
              <p className="text-xs text-zinc-500">
                Taille : <span className="text-zinc-300 font-mono">{(videoFile.size / 1024 / 1024).toFixed(0)} Mo</span>
                <span className="mx-2 text-zinc-600">·</span>
                Mode : <span className="text-zinc-300 font-mono">{import.meta.env.VITE_WORKER_URL ? '⚡ CF Worker (rapide)' : 'PUT direct'}</span>
              </p>
            )}

            {videoPhase && videoPhase !== 'error' && videoPhase !== 'done' && (
              <div>
                <div className="flex justify-between text-xs mb-1 text-zinc-400">
                  <span>
                    {videoPhase === 'presign' && 'Préparation…'}
                    {videoPhase === 'uploading' && `Envoi… ${videoProgress}%`}
                    {videoPhase === 'saving' && 'Enregistrement…'}
                  </span>
                  <span className="flex gap-2">
                    {videoSpeed > 0 && <span>{videoSpeed < 1 ? `${(videoSpeed * 1024).toFixed(0)} Ko/s` : `${videoSpeed.toFixed(1)} Mo/s`}</span>}
                    {videoEta > 0 && <span>~{videoEta >= 60 ? `${Math.floor(videoEta / 60)}m${videoEta % 60}s` : `${videoEta}s`}</span>}
                  </span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full transition-all ${videoPhase === 'presign' ? 'animate-pulse' : ''}`}
                    style={{ width: videoPhase === 'presign' ? '100%' : `${videoProgress}%`, background: videoPhase === 'presign' ? '#C9A84C40' : '#C9A84C' }}
                  />
                </div>
              </div>
            )}
            {videoPhase === 'done' && <p className="text-green-400 text-sm font-medium">✓ Vidéo uploadée !</p>}
            {videoPhase === 'error' && <p className="text-red-400 text-sm">{videoError}</p>}

            <button onClick={handleAdminVideoUpload}
              disabled={!videoFile || (videoPhase && videoPhase !== 'done' && videoPhase !== 'error')}
              className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-40 text-black"
              style={{ background: '#C9A84C' }}
            >
              {videoPhase === 'uploading' ? `Envoi… ${videoProgress}%` : videoPhase === 'presign' ? 'Préparation…' : videoPhase === 'saving' ? 'Finalisation…' : 'Uploader la vidéo'}
            </button>
          </section>
        )}

        {/* ── Paramètres ── */}
        {activeTab === 'parametres' && (
          <div className="space-y-6">
            {/* Téléchargement */}
            <section className="rounded-2xl p-5 border" style={{ background: '#1c1c1e', borderColor: '#27272a' }}>
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>⬇️ Téléchargement</h2>
              <div className="space-y-3">
                {[
                  { value: 'open', icon: '🟢', label: 'Mode soirée', desc: 'Téléchargement libre' },
                  { value: 'protected', icon: '🔒', label: 'Mode post-soirée', desc: 'Code requis' },
                  { value: 'disabled', icon: '⛔', label: 'Désactivé', desc: 'Téléchargement impossible' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-start gap-3 p-3 rounded-xl cursor-pointer border-2 transition-colors"
                    style={{ borderColor: downloadMode === opt.value ? '#C9A84C' : '#3f3f46', background: downloadMode === opt.value ? '#C9A84C08' : 'transparent' }}
                  >
                    <input type="radio" name="download_mode" value={opt.value} checked={downloadMode === opt.value}
                      onChange={(e) => setDownloadMode(e.target.value)} className="mt-0.5" style={{ accentColor: '#C9A84C' }}
                    />
                    <div>
                      <p className="font-medium text-sm text-white">{opt.icon} {opt.label}</p>
                      <p className="text-xs mt-0.5 text-zinc-400">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={saveDownloadMode} disabled={savingMode}
                className="mt-4 px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 text-black"
                style={{ background: '#C9A84C' }}
              >
                {savingMode ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
              {saveSuccess && <p className="mt-2 text-green-400 text-sm">✓ Sauvegardé.</p>}
            </section>

            {/* Code */}
            <section className="rounded-2xl p-5 border" style={{ background: '#1c1c1e', borderColor: '#27272a' }}>
              <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>🔒 Code post-soirée</h2>
              <p className="text-sm mb-4 text-zinc-400">Code demandé pour télécharger en mode protégé.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Nouveau code…" maxLength={50}
                  className="flex-1 border-2 rounded-lg px-4 py-2.5 text-sm outline-none bg-zinc-900 text-white font-mono"
                  style={{ borderColor: '#C9A84C60' }}
                />
                <button onClick={saveDownloadCode} disabled={savingCode || !newCode.trim() || newCode === downloadCode}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 text-black"
                  style={{ background: '#C9A84C' }}
                >
                  {savingCode ? '…' : 'Sauvegarder'}
                </button>
              </div>
              {downloadCode && <p className="mt-2 text-xs text-zinc-400">Actuel : <span className="font-mono font-semibold text-white">{downloadCode}</span></p>}
              {codeSuccess && <p className="mt-2 text-green-400 text-sm">✓ Code mis à jour.</p>}
            </section>

            {/* Titre */}
            <section className="rounded-2xl p-5 border" style={{ background: '#1c1c1e', borderColor: '#27272a' }}>
              <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>✏️ Titre galerie</h2>
              <p className="text-sm mb-4 text-zinc-400">Titre affiché en haut de la galerie publique.</p>
              <input type="text" value={appTitle} onChange={(e) => setAppTitle(e.target.value)} maxLength={100}
                className="w-full border-2 rounded-lg px-4 py-2.5 text-sm outline-none mb-3 bg-zinc-900 text-white"
                style={{ borderColor: '#C9A84C60', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem' }}
              />
              <button onClick={saveTitle} disabled={savingTitle || !appTitle.trim()}
                className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 text-black"
                style={{ background: '#C9A84C' }}
              >
                {savingTitle ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
              {titleSuccess && <p className="mt-2 text-green-400 text-sm">✓ Titre mis à jour.</p>}
            </section>

            {/* QR */}
            <section className="rounded-2xl p-5 border" style={{ background: '#1c1c1e', borderColor: '#27272a' }}>
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>📱 QR Code</h2>
              <p className="text-sm mb-4 text-zinc-400">{appUrl}</p>
              <div id="sa-qr-canvas" className="flex justify-center mb-4">
                <div className="p-4 bg-white rounded-2xl">
                  <QRCodeCanvas value={appUrl} size={240} bgColor="#FFFFFF" fgColor="#2C2C2C" level="H" />
                </div>
              </div>
              <button onClick={downloadQrCode} className="w-full py-3 rounded-lg border-2 font-semibold text-sm" style={{ borderColor: '#C9A84C', color: '#C9A84C' }}>
                ⬇️ Télécharger PNG
              </button>
            </section>
          </div>
        )}

        {/* ── Avancé ── */}
        {activeTab === 'avances' && (
          <div className="space-y-6">
            {/* Stockage disque */}
            <section className="rounded-2xl p-5 border" style={{ background: '#1c1c1e', borderColor: '#27272a' }}>
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>💾 Stockage disque</h2>
              {diskError ? (
                <div className="bg-orange-950 border border-orange-800 rounded-xl p-4 text-orange-400 text-sm">⚠️ API disque inaccessible — VPS hors ligne ?</div>
              ) : !diskData ? (
                <div className="text-sm text-zinc-500">Chargement…</div>
              ) : (
                <div className="space-y-5">
                  <DiskWidget label="Disque additionnel /mnt/media-storage" disk={diskData.additional} thresholdWarn={80} thresholdCrit={90} />
                  <DiskWidget label="Disque principal /dev/sda1" disk={diskData.main} thresholdWarn={80} thresholdCrit={85} />
                </div>
              )}
            </section>

            {/* Limites vidéo */}
            <section className="rounded-2xl p-5 border" style={{ background: '#1c1c1e', borderColor: '#27272a' }}>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>🎥 Config vidéo</h2>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Durée max" value={`${import.meta.env.VITE_MAX_VIDEO_DURATION || 60}s`} />
                <InfoCard label="Taille max" value={`${import.meta.env.VITE_MAX_VIDEO_SIZE_MB || 100} Mo`} />
              </div>
            </section>

            {/* Infos système */}
            <section className="rounded-2xl p-5 border" style={{ background: '#1c1c1e', borderColor: '#27272a' }}>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>ℹ️ Infos système</h2>
              <div className="space-y-2 font-mono text-xs text-zinc-400">
                <p>App URL : <span className="text-zinc-200">{appUrl}</span></p>
                <p>Supabase : <span className="text-zinc-200">{import.meta.env.VITE_SUPABASE_URL}</span></p>
                <p>Médias total : <span className="text-zinc-200">{media.length} ({photoCount} photos, {videoCount} vidéos)</span></p>
              </div>
            </section>
          </div>
        )}

        {/* ── Logs ── */}
        {activeTab === 'logs' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>🪵 Logs applicatifs</h2>
                <p className="text-xs mt-0.5 text-zinc-500">Erreurs et événements en temps réel</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={fetchLogs} className="text-xs px-3 py-1.5 rounded-lg border font-medium" style={{ borderColor: '#C9A84C', color: '#C9A84C' }}>↻ Rafraîchir</button>
                <button onClick={clearAllLogs} disabled={clearingLogs || logs.length === 0} className="text-xs px-3 py-1.5 rounded-lg border font-medium disabled:opacity-40" style={{ borderColor: '#dc2626', color: '#dc2626' }}>🗑 Effacer</button>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              {['all', 'error', 'warn', 'info'].map((f) => {
                const counts = { all: logs.length, error: logs.filter(l=>l.level==='error').length, warn: logs.filter(l=>l.level==='warn').length, info: logs.filter(l=>l.level==='info').length }
                return (
                  <button key={f} onClick={() => setLogsFilter(f)}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{ background: logsFilter === f ? (f==='error'?'#dc2626':f==='warn'?'#f59e0b':f==='info'?'#3b82f6':'#C9A84C') : '#ffffff15', color: logsFilter === f ? '#fff' : '#71717a' }}
                  >
                    {f === 'all' ? 'Tous' : f} ({counts[f]})
                  </button>
                )
              })}
            </div>

            {logsLoading ? (
              <div className="text-center py-8 text-sm text-zinc-500">Chargement…</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12"><p className="text-4xl mb-3">✅</p><p className="text-sm text-zinc-500">Aucun log.</p></div>
            ) : (
              <div className="space-y-2">
                {logs.filter(l => logsFilter === 'all' || l.level === logsFilter).map((log) => (
                  <div key={log.id} className="rounded-xl p-3 border text-xs font-mono"
                    style={{ borderColor: log.level==='error'?'#7f1d1d':log.level==='warn'?'#78350f':'#1e3a5f', background: log.level==='error'?'#1c0a0a':log.level==='warn'?'#1c1000':'#050f1f' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase" style={{ color: log.level==='error'?'#f87171':log.level==='warn'?'#fbbf24':'#60a5fa' }}>{log.level}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs bg-white/5 text-zinc-300">{log.context}</span>
                      </div>
                      <span className="text-zinc-500 shrink-0">{new Date(log.created_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
                    </div>
                    <p className="text-sm mb-1 text-zinc-200" style={{ wordBreak: 'break-word' }}>{log.message}</p>
                    {log.metadata && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-zinc-500">Détails</summary>
                        <pre className="mt-1 text-xs overflow-x-auto p-2 rounded bg-white/5 text-zinc-300">{JSON.stringify(log.metadata, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  )
}

function DiskWidget({ label, disk, thresholdWarn, thresholdCrit }) {
  if (!disk) return null
  const isWarn = disk.percent_used >= thresholdWarn && disk.percent_used < thresholdCrit
  const isCrit = disk.percent_used >= thresholdCrit
  const barColor = isCrit ? '#ef4444' : isWarn ? '#f97316' : '#C9A84C'
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: disk.active ? '#16a34a20' : '#71717a20', color: disk.active ? '#4ade80' : '#71717a' }}>
          {disk.active ? '● Actif' : '● Standby'}
        </span>
      </div>
      <div className="w-full bg-zinc-700 rounded-full h-3 overflow-hidden">
        <div className="h-3 rounded-full transition-all" style={{ width: `${disk.percent_used}%`, background: barColor }} />
      </div>
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{disk.used_gb.toFixed(1)} Go utilisés</span>
        <span>{disk.available_gb.toFixed(1)} Go dispo / {disk.total_gb.toFixed(1)} Go</span>
      </div>
      {isCrit && <div className="bg-red-950 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-xs">🔴 Espace critique</div>}
      {isWarn && !isCrit && <div className="bg-orange-950 border border-orange-800 rounded-lg px-3 py-2 text-orange-400 text-xs">🟠 Bientôt plein ({disk.percent_used}%)</div>}
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: '#C9A84C30', background: '#C9A84C08' }}>
      <p className="text-xs font-medium mb-1 text-zinc-400">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  )
}
