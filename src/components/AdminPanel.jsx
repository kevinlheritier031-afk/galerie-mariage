// Panel d'administration — route /admin
// Protégé par VITE_ADMIN_PASSWORD, session dans sessionStorage
// Sections : Médias, Paramètres téléchargement, Stockage, Limites vidéo, QR Code
import { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { createServiceClient, supabase } from '../lib/supabase.js'

// Client avec droits service_role pour les suppressions
const serviceClient = createServiceClient()

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem('admin_auth') === 'true'
  )
  const [loginInput, setLoginInput] = useState('')
  const [loginError, setLoginError] = useState('')

  function handleLogin(e) {
    e.preventDefault()
    if (loginInput === import.meta.env.VITE_ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true')
      setAuthenticated(true)
    } else {
      setLoginError('Mot de passe incorrect.')
      setLoginInput('')
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
            />
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-lg text-white font-semibold"
              style={{ background: '#C9A84C' }}
            >
              Connexion
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <AdminDashboard onLogout={() => { sessionStorage.removeItem('admin_auth'); setAuthenticated(false) }} />
}

// ─── Dashboard principal après authentification ───────────────────────────────

function AdminDashboard({ onLogout }) {
  const [media, setMedia] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [downloadMode, setDownloadMode] = useState('open')
  const [savingMode, setSavingMode] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [diskData, setDiskData] = useState(null)
  const [diskError, setDiskError] = useState(false)
  const qrRef = useRef(null)

  const photoCount = media.filter((m) => m.type === 'photo').length
  const videoCount = media.filter((m) => m.type === 'video').length
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  // ─── Chargement médias ───
  useEffect(() => {
    async function load() {
      const { data } = await serviceClient.from('media').select('*').order('created_at', { ascending: false })
      setMedia(data || [])
      setLoadingMedia(false)
    }
    load()

    // Realtime pour voir les nouveaux uploads en temps réel dans le panel admin
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

  // ─── Chargement paramètres ───
  useEffect(() => {
    async function loadSettings() {
      const { data } = await serviceClient.from('settings').select('value').eq('key', 'download_mode').single()
      if (data) setDownloadMode(data.value)
    }
    loadSettings()
  }, [])

  // ─── Polling disque toutes les 30 secondes ───
  useEffect(() => {
    async function fetchDisk() {
      try {
        const res = await fetch('/api/disk-usage')
        if (!res.ok) throw new Error('503')
        const json = await res.json()
        setDiskData(json)
        setDiskError(false)
      } catch {
        setDiskError(true)
      }
    }
    fetchDisk()
    const interval = setInterval(fetchDisk, 30_000)
    return () => clearInterval(interval)
  }, [])

  // ─── Suppression d'un média ───
  async function deleteMedia(m) {
    if (!window.confirm(`Supprimer ce média de ${m.pseudo} ?`)) return

    // Supprime le fichier du Storage Supabase
    await serviceClient.storage.from('wedding-media').remove([m.storage_path])
    // Supprime la ligne en base (déclenche l'événement Realtime DELETE)
    await serviceClient.from('media').delete().eq('id', m.id)
  }

  // ─── Sauvegarde mode téléchargement ───
  async function saveDownloadMode() {
    setSavingMode(true)
    await serviceClient.from('settings').update({ value: downloadMode }).eq('key', 'download_mode')
    setSavingMode(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  // ─── Téléchargement QR code PNG ───
  function downloadQrCode() {
    const canvas = document.querySelector('#qr-canvas canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = 'qr-galerie-mariage.png'
    link.click()
  }

  const codePreview = import.meta.env.VITE_DOWNLOAD_CODE
    ? `${import.meta.env.VITE_DOWNLOAD_CODE.slice(0, 3)}***`
    : '(non défini)'

  return (
    <div className="min-h-screen" style={{ background: '#FDFAF6' }}>
      {/* ─── Header ─── */}
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

        {/* ══════════════════════════════════════════════════
            SECTION MÉDIAS
        ══════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            📸 Médias
            <span className="text-sm font-normal px-2 py-0.5 rounded-full" style={{ background: '#C9A84C20', color: '#C9A84C' }}>
              {photoCount} photo{photoCount > 1 ? 's' : ''} · {videoCount} vidéo{videoCount > 1 ? 's' : ''} · {media.length} total
            </span>
          </h2>

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
              {media.map((m) => (
                <div key={m.id} className="relative group rounded-lg overflow-hidden bg-white shadow-sm border border-gray-100">
                  {/* Miniature */}
                  <div className="aspect-square relative overflow-hidden bg-gray-100">
                    {m.type === 'video' ? (
                      <video src={m.public_url} className="w-full h-full object-cover" preload="metadata" muted />
                    ) : (
                      <img src={m.public_url} alt={m.pseudo} className="w-full h-full object-cover" loading="lazy" />
                    )}
                    {/* Badge type */}
                    <span
                      className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: m.type === 'video' ? '#2C2C2C' : '#C9A84C', color: '#fff' }}
                    >
                      {m.type === 'video' ? `▶ ${m.duration_seconds || '?'}s` : '📷'}
                    </span>
                    {/* Bouton supprimer */}
                    <button
                      onClick={() => deleteMedia(m)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500 text-white text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                  {/* Infos */}
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium truncate" style={{ color: '#2C2C2C' }}>{m.pseudo || 'Anonyme'}</p>
                    <p className="text-xs" style={{ color: '#8A7F72' }}>
                      {new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════
            SECTION PARAMÈTRES TÉLÉCHARGEMENT
        ══════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            ⬇️ Paramètres téléchargement
          </h2>

          <div className="space-y-3">
            {[
              { value: 'open', icon: '🟢', label: 'Mode soirée', desc: 'Téléchargement libre, sans code' },
              { value: 'protected', icon: '🔒', label: 'Mode post-soirée', desc: `Code requis — Code actuel : ${codePreview}` },
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
                  className="mt-0.5 accent-gold"
                  style={{ accentColor: '#C9A84C' }}
                />
                <div>
                  <p className="font-medium text-sm" style={{ color: '#2C2C2C' }}>
                    {opt.icon} {opt.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A7F72' }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={saveDownloadMode}
            disabled={savingMode}
            className="mt-4 px-6 py-2.5 rounded-lg text-white font-semibold text-sm transition-colors"
            style={{ background: '#C9A84C' }}
          >
            {savingMode ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>

          {saveSuccess && (
            <p className="mt-2 text-green-600 text-sm font-medium">✓ Paramètre sauvegardé et appliqué à tous les clients.</p>
          )}
        </section>

        {/* ══════════════════════════════════════════════════
            SECTION STOCKAGE
        ══════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            💾 Stockage disque
          </h2>

          {diskError ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-700 text-sm">
              ⚠️ API disque inaccessible — VPS hors ligne ?
            </div>
          ) : !diskData ? (
            <div className="text-sm" style={{ color: '#8A7F72' }}>Chargement…</div>
          ) : (
            <div className="space-y-5">
              {/* Disque additionnel */}
              <DiskWidget
                label="Disque additionnel /mnt/media-storage"
                disk={diskData.additional}
                thresholdWarn={80}
                thresholdCrit={90}
                critLabel="Bascule sur disque principal imminente"
              />
              {/* Disque principal */}
              <DiskWidget
                label="Disque principal /dev/sda1"
                disk={diskData.main}
                thresholdWarn={80}
                thresholdCrit={85}
                critLabel="Espace critique"
              />
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════
            SECTION LIMITES VIDÉO
        ══════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
            🎥 Limites vidéo
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard
              label="Durée max"
              value={`${import.meta.env.VITE_MAX_VIDEO_DURATION || 60} secondes`}
            />
            <InfoCard
              label="Taille max"
              value={`${import.meta.env.VITE_MAX_VIDEO_SIZE_MB || 100} Mo`}
            />
          </div>
          <p className="text-xs mt-3" style={{ color: '#8A7F72' }}>
            Ces limites sont vérifiées côté client avant l'upload. Modifiez VITE_MAX_VIDEO_DURATION et VITE_MAX_VIDEO_SIZE_MB dans .env pour les changer.
          </p>
        </section>

        {/* ══════════════════════════════════════════════════
            SECTION QR CODE
        ══════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            📱 QR Code galerie
          </h2>
          <p className="text-sm mb-4" style={{ color: '#8A7F72' }}>
            Scannez pour accéder à la galerie — {appUrl}
          </p>

          <div id="qr-canvas" className="flex justify-center mb-4">
            <div className="p-4 bg-white border-2 rounded-2xl" style={{ borderColor: '#C9A84C40' }}>
              <QRCodeCanvas
                value={appUrl}
                size={300}
                bgColor="#FFFFFF"
                fgColor="#2C2C2C"
                level="H"
              />
            </div>
          </div>

          <button
            onClick={downloadQrCode}
            className="w-full py-3 rounded-lg border-2 font-semibold text-sm transition-colors"
            style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
          >
            ⬇️ Télécharger PNG
          </button>
        </section>

      </div>
    </div>
  )
}

// ─── Composant barre de disque ────────────────────────────────────────────────
function DiskWidget({ label, disk, thresholdWarn, thresholdCrit, critLabel }) {
  const isWarn = disk.percent_used >= thresholdWarn && disk.percent_used < thresholdCrit
  const isCrit = disk.percent_used >= thresholdCrit
  const barColor = isCrit ? '#ef4444' : isWarn ? '#f97316' : '#C9A84C'

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium" style={{ color: '#2C2C2C' }}>{label}</span>
        {/* Badge statut */}
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: disk.active ? '#22c55e20' : '#8A7F7220',
            color: disk.active ? '#16a34a' : '#8A7F72',
          }}
        >
          {disk.active ? '● Actif' : '● Standby'}
        </span>
      </div>

      {/* Barre de progression */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full transition-all"
          style={{ width: `${disk.percent_used}%`, background: barColor }}
        />
      </div>

      <div className="flex justify-between text-xs" style={{ color: '#8A7F72' }}>
        <span>{disk.used_gb.toFixed(1)} Go utilisés</span>
        <span>{disk.available_gb.toFixed(1)} Go disponibles / {disk.total_gb.toFixed(1)} Go</span>
      </div>

      {/* Alertes */}
      {isCrit && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-600 text-xs font-medium">
          🔴 {critLabel}
        </div>
      )}
      {isWarn && !isCrit && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-600 text-xs font-medium">
          🟠 Espace bientôt insuffisant ({disk.percent_used}% utilisé)
        </div>
      )}
    </div>
  )
}

// ─── Carte info ────────────────────────────────────────────────────────────────
function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: '#C9A84C30', background: '#C9A84C08' }}>
      <p className="text-xs font-medium mb-1" style={{ color: '#8A7F72' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: '#2C2C2C' }}>{value}</p>
    </div>
  )
}
