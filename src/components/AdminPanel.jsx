import { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase.js'

const TOKEN_KEY = 'admin_token'

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) || ''}`,
  }
}

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loginInput, setLoginInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Vérifie si un token valide est déjà en session
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (token) setAuthenticated(true)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/admin/login', {
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#FDFAF6' }}>
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-6 text-center" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
            Administration 🔐
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={loginInput}
              onChange={(e) => { setLoginInput(e.target.value); setLoginError('') }}
              placeholder="Mot de passe admin"
              className="w-full border-2 rounded-lg px-4 py-3 outline-none"
              style={{ borderColor: '#C9A84C40' }}
              autoFocus
              disabled={loginLoading}
            />
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-50"
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
    <AdminDashboard
      onLogout={() => {
        sessionStorage.removeItem(TOKEN_KEY)
        setAuthenticated(false)
      }}
    />
  )
}

function AdminDashboard({ onLogout }) {
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

  const photoCount = media.filter((m) => m.type === 'photo').length
  const videoCount = media.filter((m) => m.type === 'video').length
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  // Chargement médias via client anon (lecture publique autorisée par RLS)
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false })
      setMedia(data || [])
      setLoadingMedia(false)
    }
    load()

    const channel = supabase.channel('admin-media')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'media' }, (payload) => {
        setMedia((prev) => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'media' }, (payload) => {
        setMedia((prev) => prev.filter((m) => m.id !== payload.old.id))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // Chargement paramètres via API sécurisée
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

  // Polling disque toutes les 30 secondes
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
      body: JSON.stringify({ id: m.id, storage_path: m.storage_path }),
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
          body: JSON.stringify({ id: m.id, storage_path: m.storage_path }),
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
    const res = await fetch('/api/admin/title', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ value: appTitle }),
    })
    setSavingTitle(false)
    if (res.ok) {
      setTitleSuccess(true)
      setTimeout(() => setTitleSuccess(false), 3000)
    }
  }

  async function saveDownloadCode() {
    if (!newCode.trim()) return
    setSavingCode(true)
    const res = await fetch('/api/admin/download-code', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ value: newCode }),
    })
    setSavingCode(false)
    if (res.ok) {
      setDownloadCode(newCode)
      setCodeSuccess(true)
      setTimeout(() => setCodeSuccess(false), 3000)
    }
  }

  async function saveDownloadMode() {
    setSavingMode(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ value: downloadMode }),
    })
    setSavingMode(false)
    if (res.ok) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  function downloadQrCode() {
    const canvas = document.querySelector('#qr-canvas canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = 'qr-galerie-mariage.png'
    link.click()
  }

  return (
    <div className="min-h-screen" style={{ background: '#FDFAF6' }}>
      <header className="bg-white border-b border-gold/20 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
            Administration 💍
          </h1>
          <button
            onClick={onLogout}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: '#8A7F72', color: '#8A7F72' }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* Médias */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              📸 Médias
              <span className="text-sm font-normal px-2 py-0.5 rounded-full" style={{ background: '#C9A84C20', color: '#C9A84C' }}>
                {photoCount} photo{photoCount !== 1 ? 's' : ''} · {videoCount} vidéo{videoCount !== 1 ? 's' : ''} · {media.length} total
              </span>
            </h2>
            {!loadingMedia && media.length > 0 && (
              <div className="flex items-center gap-2">
                {selectionMode && (
                  <>
                    <button
                      onClick={() => setSelectedIds(new Set(media.map((m) => m.id)))}
                      className="text-xs underline"
                      style={{ color: '#C9A84C' }}
                    >
                      Tout
                    </button>
                    <button
                      onClick={() => { setSelectionMode(false); setSelectedIds(new Set()) }}
                      className="text-xs underline"
                      style={{ color: '#8A7F72' }}
                    >
                      Annuler
                    </button>
                    {selectedIds.size > 0 && (
                      <button
                        onClick={deleteSelected}
                        disabled={deletingBulk}
                        className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold disabled:opacity-50"
                        style={{ background: '#ef4444' }}
                      >
                        {deletingBulk ? 'Suppression…' : `🗑 Supprimer (${selectedIds.size})`}
                      </button>
                    )}
                  </>
                )}
                {!selectionMode && (
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium"
                    style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
                  >
                    Sélectionner
                  </button>
                )}
              </div>
            )}
          </div>

          {loadingMedia ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-gray-200 animate-pulse" />
              ))}
            </div>
          ) : media.length === 0 ? (
            <p className="text-sm py-4" style={{ color: '#8A7F72' }}>Aucun média pour l'instant.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {media.map((m) => {
                const isSelected = selectedIds.has(m.id)
                return (
                  <div
                    key={m.id}
                    className="relative rounded-lg overflow-hidden bg-white shadow-sm border-2 transition-colors"
                    style={{ borderColor: isSelected ? '#ef4444' : '#f3f4f6' }}
                    onClick={() => selectionMode && toggleSelect(m.id)}
                  >
                    <div className="aspect-square relative overflow-hidden bg-gray-100">
                      {m.type === 'video' ? (
                        <video src={m.public_url} className="w-full h-full object-cover" preload="metadata" muted />
                      ) : (
                        <img src={m.public_url} alt={m.pseudo} className="w-full h-full object-cover" loading="lazy" />
                      )}
                      <span
                        className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: m.type === 'video' ? '#2C2C2C' : '#C9A84C', color: '#fff' }}
                      >
                        {m.type === 'video' ? `▶ ${m.duration_seconds || '?'}s` : '📷'}
                      </span>
                      {selectionMode ? (
                        <div
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                          style={{ background: isSelected ? '#ef4444' : '#fff', borderColor: isSelected ? '#ef4444' : '#ccc' }}
                        >
                          {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMedia(m) }}
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500 text-white text-sm flex items-center justify-center shadow-md"
                          title="Supprimer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-medium truncate" style={{ color: '#2C2C2C' }}>{m.pseudo || 'Anonyme'}</p>
                      <p className="text-xs" style={{ color: '#8A7F72' }}>
                        {new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Paramètres téléchargement */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            ⬇️ Paramètres téléchargement
          </h2>
          <div className="space-y-3">
            {[
              { value: 'open', icon: '🟢', label: 'Mode soirée', desc: 'Téléchargement libre, sans code' },
              { value: 'protected', icon: '🔒', label: 'Mode post-soirée', desc: 'Code requis pour télécharger' },
              { value: 'disabled', icon: '⛔', label: 'Désactivé', desc: 'Téléchargement impossible' },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-3 p-3 rounded-xl cursor-pointer border-2 transition-colors"
                style={{
                  borderColor: downloadMode === opt.value ? '#C9A84C' : '#f0ece6',
                  background: downloadMode === opt.value ? '#C9A84C08' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="download_mode"
                  value={opt.value}
                  checked={downloadMode === opt.value}
                  onChange={(e) => setDownloadMode(e.target.value)}
                  className="mt-0.5"
                  style={{ accentColor: '#C9A84C' }}
                />
                <div>
                  <p className="font-medium text-sm" style={{ color: '#2C2C2C' }}>{opt.icon} {opt.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A7F72' }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={saveDownloadMode}
            disabled={savingMode}
            className="mt-4 px-6 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: '#C9A84C' }}
          >
            {savingMode ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          {saveSuccess && (
            <p className="mt-2 text-green-600 text-sm font-medium">✓ Paramètre sauvegardé.</p>
          )}
        </section>

        {/* Code post-soirée */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
            🔒 Code post-soirée
          </h2>
          <p className="text-sm mb-4" style={{ color: '#8A7F72' }}>
            Code demandé aux invités pour télécharger en mode protégé.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Nouveau code…"
              maxLength={50}
              className="flex-1 border-2 rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: '#C9A84C60', color: '#2C2C2C', fontFamily: 'monospace', fontSize: '1rem' }}
            />
            <button
              onClick={saveDownloadCode}
              disabled={savingCode || !newCode.trim() || newCode === downloadCode}
              className="px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ background: '#C9A84C' }}
            >
              {savingCode ? '…' : 'Sauvegarder'}
            </button>
          </div>
          {downloadCode && (
            <p className="mt-2 text-xs" style={{ color: '#8A7F72' }}>
              Code actuel : <span className="font-mono font-semibold" style={{ color: '#2C2C2C' }}>{downloadCode}</span>
            </p>
          )}
          {codeSuccess && <p className="mt-2 text-green-600 text-sm font-medium">✓ Code mis à jour.</p>}
        </section>

        {/* Stockage disque */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>💾 Stockage disque</h2>
          {diskError ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-700 text-sm">
              ⚠️ API disque inaccessible — VPS hors ligne ?
            </div>
          ) : !diskData ? (
            <div className="text-sm" style={{ color: '#8A7F72' }}>Chargement…</div>
          ) : (
            <div className="space-y-5">
              <DiskWidget label="Disque additionnel /mnt/media-storage" disk={diskData.additional} thresholdWarn={80} thresholdCrit={90} critLabel="Bascule sur disque principal imminente" />
              <DiskWidget label="Disque principal /dev/sda1" disk={diskData.main} thresholdWarn={80} thresholdCrit={85} critLabel="Espace critique" />
            </div>
          )}
        </section>

        {/* Limites vidéo */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>🎥 Limites vidéo</h2>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Durée max" value={`${import.meta.env.VITE_MAX_VIDEO_DURATION || 60} secondes`} />
            <InfoCard label="Taille max" value={`${import.meta.env.VITE_MAX_VIDEO_SIZE_MB || 100} Mo`} />
          </div>
        </section>

        {/* Personnalisation */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
            ✏️ Personnalisation
          </h2>
          <p className="text-sm mb-4" style={{ color: '#8A7F72' }}>
            Titre affiché en haut de la galerie. Emoji acceptés 🎉💍
          </p>
          <input
            type="text"
            value={appTitle}
            onChange={(e) => setAppTitle(e.target.value)}
            maxLength={100}
            placeholder="Notre Mariage 💍"
            className="w-full border-2 rounded-lg px-4 py-2.5 text-sm outline-none mb-3"
            style={{ borderColor: '#C9A84C60', color: '#2C2C2C', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem' }}
          />
          <p className="text-xs mb-3" style={{ color: '#8A7F72' }}>
            Aperçu : <span style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>{appTitle || '…'}</span>
          </p>
          <button
            onClick={saveTitle}
            disabled={savingTitle || !appTitle.trim()}
            className="px-6 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: '#C9A84C' }}
          >
            {savingTitle ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          {titleSuccess && <p className="mt-2 text-green-600 text-sm font-medium">✓ Titre mis à jour pour tous les invités.</p>}
        </section>

        {/* QR Code */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>📱 QR Code galerie</h2>
          <p className="text-sm mb-4" style={{ color: '#8A7F72' }}>Scannez pour accéder à la galerie — {appUrl}</p>
          <div id="qr-canvas" className="flex justify-center mb-4">
            <div className="p-4 bg-white border-2 rounded-2xl" style={{ borderColor: '#C9A84C40' }}>
              <QRCodeCanvas value={appUrl} size={300} bgColor="#FFFFFF" fgColor="#2C2C2C" level="H" />
            </div>
          </div>
          <button
            onClick={downloadQrCode}
            className="w-full py-3 rounded-lg border-2 font-semibold text-sm"
            style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
          >
            ⬇️ Télécharger PNG
          </button>
        </section>

      </div>
    </div>
  )
}

function DiskWidget({ label, disk, thresholdWarn, thresholdCrit, critLabel }) {
  if (!disk) return null
  const isWarn = disk.percent_used >= thresholdWarn && disk.percent_used < thresholdCrit
  const isCrit = disk.percent_used >= thresholdCrit
  const barColor = isCrit ? '#ef4444' : isWarn ? '#f97316' : '#C9A84C'

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium" style={{ color: '#2C2C2C' }}>{label}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: disk.active ? '#22c55e20' : '#8A7F7220', color: disk.active ? '#16a34a' : '#8A7F72' }}>
          {disk.active ? '● Actif' : '● Standby'}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div className="h-3 rounded-full transition-all" style={{ width: `${disk.percent_used}%`, background: barColor }} />
      </div>
      <div className="flex justify-between text-xs" style={{ color: '#8A7F72' }}>
        <span>{disk.used_gb.toFixed(1)} Go utilisés</span>
        <span>{disk.available_gb.toFixed(1)} Go disponibles / {disk.total_gb.toFixed(1)} Go</span>
      </div>
      {isCrit && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-600 text-xs font-medium">🔴 {critLabel}</div>}
      {isWarn && !isCrit && <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-600 text-xs font-medium">🟠 Espace bientôt insuffisant ({disk.percent_used}% utilisé)</div>}
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: '#C9A84C30', background: '#C9A84C08' }}>
      <p className="text-xs font-medium mb-1" style={{ color: '#8A7F72' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: '#2C2C2C' }}>{value}</p>
    </div>
  )
}
