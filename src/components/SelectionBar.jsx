// Barre fixe en bas d'écran qui apparaît dès qu'un média est sélectionné
// Animation slide-up à l'apparition, slide-down à la disparition
// Gère les trois modes de téléchargement : open, protected, disabled
import { downloadAsZip } from '../lib/downloadHelpers.js'

export default function SelectionBar({ selectedMedia, downloadMode, onRequestCode, onClear }) {
  const count = selectedMedia.length

  async function handleDownload() {
    if (downloadMode === 'disabled') {
      alert('Le téléchargement est actuellement désactivé.')
      return
    }

    if (downloadMode === 'protected') {
      // Ouvre la modale de code secret avant de lancer le ZIP
      onRequestCode()
      return
    }

    // Mode open : téléchargement immédiat sans code
    try {
      await downloadAsZip(selectedMedia)
    } catch (err) {
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          style={{
            background: '#C9A84C',
            color: '#fff',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#A8873C')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#C9A84C')}
        >
          💾 Télécharger ma sélection
        </button>
      </div>
    </div>
  )
}
