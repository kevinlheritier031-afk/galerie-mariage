// Barre fixe en bas d'écran qui apparaît dès qu'un média est sélectionné
// Animation slide-up à l'apparition, slide-down à la disparition
// Gère les trois modes de téléchargement : open, protected, disabled
import { useState } from 'react'
import { downloadMedia } from '../lib/downloadHelpers.js'

export default function SelectionBar({ selectedMedia, downloadMode, onRequestCode, onClear }) {
  const count = selectedMedia.length
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'

  async function handleDownload() {
    if (downloadMode === 'disabled') {
      alert('Le téléchargement est actuellement désactivé.')
      return
    }

    if (downloadMode === 'protected') {
      onRequestCode()
      return
    }

    setStatus('loading')
    try {
      await downloadMedia(selectedMedia)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
      alert(`Erreur lors du téléchargement : ${err.message}`)
    }
  }

  if (count === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slideUp">
      <div
        className="bg-primary text-white px-4 py-4 flex items-center justify-between gap-3 rounded-t-2xl shadow-2xl"
        style={{ background: '#2C2C2C' }}
      >
        {/* Compteur et bouton annuler */}
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">
            {count} média{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
          </span>
          <button
            onClick={onClear}
            className="text-white/50 text-xs hover:text-white/80 transition-colors underline"
          >
            Annuler
          </button>
        </div>

        {/* Bouton télécharger */}
        <button
          onClick={handleDownload}
          disabled={status === 'loading'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: status === 'done' ? '#16a34a' : status === 'error' ? '#dc2626' : '#C9A84C',
            color: '#fff',
          }}
        >
          {status === 'loading' && '⏳ Préparation…'}
          {status === 'done' && '✓ Téléchargement lancé !'}
          {status === 'error' && '✗ Erreur'}
          {status === 'idle' && '💾 Télécharger ma sélection'}
        </button>
      </div>
    </div>
  )
}
