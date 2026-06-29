import { useState, useEffect, useRef } from 'react'
import { downloadMedia } from '../lib/downloadHelpers.js'

export default function DownloadCodeModal({ selectedMedia, onClose }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blockRemaining, setBlockRemaining] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearInterval(timerRef.current)
  }, [])

  function startBlockCountdown(blockedUntil) {
    setBlocked(true)
    timerRef.current = setInterval(() => {
      const remaining = blockedUntil - Date.now()
      if (remaining <= 0) {
        setBlocked(false)
        setBlockRemaining(0)
        clearInterval(timerRef.current)
      } else {
        setBlockRemaining(Math.ceil(remaining / 1000))
      }
    }, 1000)
  }

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (blocked || loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/verify-download-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      if (res.status === 429) {
        const data = await res.json()
        startBlockCountdown(data.blockedUntil)
        setError('Trop de tentatives. Réessayez plus tard.')
        setCode('')
        return
      }

      const data = await res.json()

      if (data.valid) {
        setDownloading(true)
        try {
          await downloadMedia(selectedMedia)
          onClose()
        } catch (err) {
          setError(`Erreur : ${err.message}`)
          setDownloading(false)
        }
        return
      }

      triggerShake()
      setCode('')

      if (data.blocked) {
        startBlockCountdown(Date.now() + 10 * 60 * 1000)
        setError('Trop de tentatives. Réessayez dans 10 minutes.')
      } else {
        const r = data.remaining ?? 0
        setError(`Code incorrect.${r > 0 ? ` ${r} tentative${r > 1 ? 's' : ''} restante${r > 1 ? 's' : ''}.` : ''}`)
      }
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-4 text-2xl text-gray-400 hover:text-gray-600">×</button>
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
          Code de téléchargement
        </h2>
        <p className="text-sm mb-5" style={{ color: '#8A7F72' }}>
          Entrez le code reçu pour télécharger votre sélection de {selectedMedia.length} média{selectedMedia.length > 1 ? 's' : ''}.
        </p>

        {blocked ? (
          <div className="text-center py-4">
            <p className="text-red-500 font-medium">Accès temporairement bloqué</p>
            <p className="text-sm mt-1" style={{ color: '#8A7F72' }}>
              Réessayez dans {Math.floor(blockRemaining / 60)}:{String(blockRemaining % 60).padStart(2, '0')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError('') }}
              placeholder="Code secret"
              className={`w-full border-2 rounded-lg px-4 py-3 text-center text-lg font-mono outline-none transition-all mb-1 ${shake ? 'animate-shake' : ''}`}
              style={{ borderColor: error ? '#ef4444' : '#C9A84C', letterSpacing: '0.15em' }}
              autoComplete="off"
              disabled={downloading || loading}
            />
            {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-lg border-2 text-sm font-medium"
                style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!code.trim() || downloading || loading}
                className="flex-1 py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: '#C9A84C' }}
              >
                {downloading ? 'Préparation…' : loading ? 'Vérification…' : 'Télécharger'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
