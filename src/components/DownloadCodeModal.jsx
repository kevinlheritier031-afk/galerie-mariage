// Modale de saisie du code secret pour le mode protected
// 5 tentatives max, blocage 10 minutes via localStorage si dépassé
// Animation shake sur code incorrect
import { useState, useEffect, useRef } from 'react'
import { downloadAsZip } from '../lib/downloadHelpers.js'

const MAX_ATTEMPTS = 5
const BLOCK_DURATION_MS = 10 * 60 * 1000 // 10 minutes
const STORAGE_KEY = 'download_block_until'
const ATTEMPTS_KEY = 'download_attempts'

export default function DownloadCodeModal({ selectedMedia, onClose }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [attempts, setAttempts] = useState(() => parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10))
  const [blocked, setBlocked] = useState(false)
  const [blockRemaining, setBlockRemaining] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const inputRef = useRef(null)

  // Vérifie si l'utilisateur est actuellement bloqué
  useEffect(() => {
    const blockUntil = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
    if (blockUntil > Date.now()) {
      setBlocked(true)
      const timer = setInterval(() => {
        const remaining = blockUntil - Date.now()
        if (remaining <= 0) {
          setBlocked(false)
          localStorage.removeItem(STORAGE_KEY)
          localStorage.setItem(ATTEMPTS_KEY, '0')
          setAttempts(0)
          clearInterval(timer)
        } else {
          setBlockRemaining(Math.ceil(remaining / 1000))
        }
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [])

  // Focus automatique sur le champ à l'ouverture
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Déclenche l'animation shake puis la retire
  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (blocked) return

    const correctCode = import.meta.env.VITE_DOWNLOAD_CODE
    if (code.trim() === correctCode) {
      // Code correct : réinitialise les tentatives et lance le ZIP
      localStorage.setItem(ATTEMPTS_KEY, '0')
      setDownloading(true)
      try {
        await downloadAsZip(selectedMedia)
        onClose()
      } catch (err) {
        setError(`Erreur : ${err.message}`)
        setDownloading(false)
      }
      return
    }

    // Code incorrect
    const newAttempts = attempts + 1
    setAttempts(newAttempts)
    localStorage.setItem(ATTEMPTS_KEY, String(newAttempts))
    triggerShake()
    setCode('')

    if (newAttempts >= MAX_ATTEMPTS) {
      // Blocage 10 minutes
      const blockUntil = Date.now() + BLOCK_DURATION_MS
      localStorage.setItem(STORAGE_KEY, String(blockUntil))
      setBlocked(true)
      setBlockRemaining(BLOCK_DURATION_MS / 1000)
      setError('Trop de tentatives. Réessayez dans 10 minutes.')
    } else {
      setError(`Code incorrect. ${MAX_ATTEMPTS - newAttempts} tentative${MAX_ATTEMPTS - newAttempts > 1 ? 's' : ''} restante${MAX_ATTEMPTS - newAttempts > 1 ? 's' : ''}.`)
    }
  }

  return (
    // Overlay modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {/* Titre */}
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
          Code de téléchargement
        </h2>
        <p className="text-sm mb-5" style={{ color: '#8A7F72' }}>
          Entrez le code reçu pour télécharger votre sélection de {selectedMedia.length} média{selectedMedia.length > 1 ? 's' : ''}.
        </p>

        {blocked ? (
          // Message de blocage avec décompte
          <div className="text-center py-4">
            <p className="text-red-500 font-medium">Accès temporairement bloqué</p>
            <p className="text-sm mt-1" style={{ color: '#8A7F72' }}>
              Réessayez dans {Math.floor(blockRemaining / 60)}:{String(blockRemaining % 60).padStart(2, '0')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Champ de saisie avec animation shake */}
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError('') }}
              placeholder="Code secret"
              className={`w-full border-2 rounded-lg px-4 py-3 text-center text-lg font-mono outline-none transition-all mb-1 ${
                shake ? 'animate-shake' : ''
              }`}
              style={{
                borderColor: error ? '#ef4444' : '#C9A84C',
                letterSpacing: '0.15em',
              }}
              autoComplete="off"
              disabled={downloading}
            />

            {/* Message d'erreur */}
            {error && (
              <p className="text-red-500 text-sm text-center mb-3">{error}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors"
                style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!code.trim() || downloading}
                className="flex-1 py-3 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: '#C9A84C' }}
              >
                {downloading ? 'Préparation…' : 'Télécharger'}
              </button>
            </div>
          </form>
        )}

        {/* Bouton fermer en haut */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-2xl text-gray-400 hover:text-gray-600"
          style={{ position: 'absolute', top: '12px', right: '16px' }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
