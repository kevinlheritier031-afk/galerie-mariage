import { useState, useRef } from 'react'
import { validatePhoto } from '../lib/mediaValidation.js'

export default function UploadModal({ onClose, onStartUpload }) {
  const [pseudo, setPseudo] = useState(() => localStorage.getItem('wedding_pseudo') || '')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const photoInputRef = useRef(null)

  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFile(null)
    setErrorMsg('')
  }

  async function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    clearPreview()

    const validationResult = validatePhoto(selected)

    if (!validationResult.valid) {
      setErrorMsg(validationResult.error)
      return
    }

    setFile({ raw: selected, duration: validationResult.duration })
    setPreview(URL.createObjectURL(selected))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    // Délègue l'upload à Gallery : la modal se ferme immédiatement,
    // un toast dans la galerie suit la progression en arrière-plan
    onStartUpload(file, pseudo, 'photo')
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={() => { clearPreview(); onClose() }}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {/* En-tête */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
            Ajouter un souvenir
          </h2>
          <button
            onClick={() => { clearPreview(); onClose() }}
            className="text-2xl text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Champ pseudo optionnel */}
          <input
            type="text"
            value={pseudo}
            onChange={(e) => {
              setPseudo(e.target.value)
              localStorage.setItem('wedding_pseudo', e.target.value)
            }}
            placeholder="Votre prénom (optionnel)"
            maxLength={50}
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold transition-colors"
            style={{ borderColor: '#C9A84C40', color: '#2C2C2C' }}
          />

          {/* Bouton choisir fichier */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            id="photo-input"
          />
          <label
            htmlFor="photo-input"
            className="block w-full text-center py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-sm font-medium"
            style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
          >
            📷 Choisir une photo
          </label>

          {/* Prévisualisation */}
          {preview && (
            <div className="rounded-lg overflow-hidden bg-gray-50 border" style={{ borderColor: '#C9A84C20' }}>
              <img src={preview} alt="Prévisualisation" className="w-full h-40 object-cover" />
            </div>
          )}

          {/* Message d'erreur de validation */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {errorMsg}
              <button
                type="button"
                onClick={() => { setErrorMsg(''); clearPreview() }}
                className="ml-2 underline text-red-500"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Bouton envoyer */}
          <button
            type="submit"
            disabled={!file}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-40"
            style={{ background: '#C9A84C' }}
          >
            Envoyer 🎉
          </button>
        </form>
      </div>
    </div>
  )
}
