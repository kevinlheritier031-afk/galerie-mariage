import { useState, useRef } from 'react'
import { validatePhoto } from '../lib/mediaValidation.js'

export default function UploadModal({ onClose, onStartUpload }) {
  const [pseudo, setPseudo] = useState(() => localStorage.getItem('wedding_pseudo') || '')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const galleryInputRef = useRef(null)
  const cameraInputRef = useRef(null)

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

          {/* Encadré choix source photo */}
          {!preview && (
            <div
              className="rounded-xl border-2 p-4"
              style={{ borderColor: '#C9A84C30', background: '#FFFDF7' }}
            >
              <p className="text-xs text-center mb-3 font-medium" style={{ color: '#8B7355' }}>
                Comment souhaitez-vous ajouter votre photo ?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Option Galerie */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="gallery-input"
                />
                <label
                  htmlFor="gallery-input"
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:bg-amber-50 active:scale-95"
                  style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
                >
                  <span className="text-3xl">🖼️</span>
                  <span className="text-xs font-semibold text-center leading-tight" style={{ color: '#2C2C2C' }}>
                    Depuis ma galerie
                  </span>
                  <span className="text-xs text-center leading-tight" style={{ color: '#8B7355' }}>
                    Choisir une photo existante
                  </span>
                </label>

                {/* Option Appareil photo */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                  id="camera-input"
                />
                <label
                  htmlFor="camera-input"
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 cursor-pointer transition-all hover:bg-amber-50 active:scale-95"
                  style={{ borderColor: '#C9A84C', background: '#C9A84C10', color: '#C9A84C' }}
                >
                  <span className="text-3xl">📷</span>
                  <span className="text-xs font-semibold text-center leading-tight" style={{ color: '#2C2C2C' }}>
                    Prendre une photo
                  </span>
                  <span className="text-xs text-center leading-tight" style={{ color: '#8B7355' }}>
                    Ouvrir l'appareil photo
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Prévisualisation */}
          {preview && (
            <div className="rounded-lg overflow-hidden bg-gray-50 border relative" style={{ borderColor: '#C9A84C20' }}>
              <img src={preview} alt="Prévisualisation" className="w-full h-40 object-cover" />
              <button
                type="button"
                onClick={clearPreview}
                className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center text-gray-500 shadow text-sm hover:text-red-500 transition-colors"
              >
                ×
              </button>
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
