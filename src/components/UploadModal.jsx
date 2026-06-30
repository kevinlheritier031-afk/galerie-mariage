import { useState, useRef } from 'react'
import { validatePhoto } from '../lib/mediaValidation.js'

export default function UploadModal({ onClose, onStartUpload }) {
  const [pseudo, setPseudo] = useState(() => localStorage.getItem('wedding_pseudo') || '')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [errorMsg, setErrorMsg] = useState('')

  function clearAll() {
    previews.forEach((p) => URL.revokeObjectURL(p))
    setPreviews([])
    setFiles([])
    setErrorMsg('')
  }

  function removeFile(index) {
    URL.revokeObjectURL(previews[index])
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleGalleryChange(e) {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    clearAll()

    const valid = []
    const validPreviews = []
    const errors = []

    for (const f of selected) {
      const result = validatePhoto(f)
      if (result.valid) {
        valid.push({ raw: f, type: 'photo' })
        validPreviews.push(URL.createObjectURL(f))
      } else {
        errors.push(`${f.name} : ${result.error}`)
      }
    }

    setFiles(valid)
    setPreviews(validPreviews)
    if (errors.length) setErrorMsg(errors.join('\n'))
  }

  async function handleCameraChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return

    const result = validatePhoto(selected)
    if (!result.valid) {
      setErrorMsg(result.error)
      e.target.value = ''
      return
    }
    setFiles((prev) => [...prev, { raw: selected, duration: result.duration }])
    setPreviews((prev) => [...prev, URL.createObjectURL(selected)])
    // Reset pour pouvoir relancer l'appareil photo immédiatement
    e.target.value = ''
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!files.length) return
    // Le type réel est stocké dans chaque fileObj.type — 'photo' sert de fallback
    onStartUpload(files, pseudo, 'photo')
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={() => { clearAll(); onClose() }}
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
            onClick={() => { clearAll(); onClose() }}
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

          {/* Input caméra — toujours dans le DOM pour rester utilisable après la 1ère prise */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraChange}
            className="hidden"
            id="camera-input"
          />

          {/* Encadré choix source photo — affiché uniquement si aucune photo sélectionnée */}
          {!previews.length && (
            <div
              className="rounded-xl border-2 p-4"
              style={{ borderColor: '#C9A84C30', background: '#FFFDF7' }}
            >
              <p className="text-xs text-center mb-3 font-medium" style={{ color: '#8B7355' }}>
                Comment souhaitez-vous ajouter votre photo ?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Option Galerie — sélection multiple */}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryChange}
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
                    Photos
                  </span>
                </label>

                {/* Option Appareil photo */}
                <label
                  htmlFor="camera-input"
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 cursor-pointer transition-all hover:bg-amber-50 active:scale-95"
                  style={{ borderColor: '#C9A84C', background: '#C9A84C10', color: '#C9A84C' }}
                >
                  <span className="text-3xl">📷</span>
                  <span className="text-xs font-semibold text-center leading-tight" style={{ color: '#2C2C2C' }}>
                    Photo en direct
                  </span>
                  <span className="text-xs text-center leading-tight" style={{ color: '#8B7355' }}>
                    Prenez la photo maintenant avec votre appareil
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Bouton "Prendre une autre" — visible dès qu'une photo a été prise */}
          {previews.length > 0 && (
            <label
              htmlFor="camera-input"
              className="flex items-center justify-center gap-2 py-2.5 w-full rounded-xl border-2 cursor-pointer transition-all hover:bg-amber-50 active:scale-95"
              style={{ borderColor: '#C9A84C', background: '#C9A84C08' }}
            >
              <span className="text-lg">📷</span>
              <span className="text-sm font-semibold" style={{ color: '#2C2C2C' }}>
                Prendre une autre photo
              </span>
            </label>
          )}

          {/* Prévisualisations */}
          {previews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: '#8B7355' }}>
                  {previews.length} fichier{previews.length > 1 ? 's' : ''} sélectionné{previews.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs underline"
                  style={{ color: '#C9A84C' }}
                >
                  Tout effacer
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden aspect-square bg-gray-100">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center text-gray-500 shadow text-xs hover:text-red-500 transition-colors leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message d'erreur de validation */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 whitespace-pre-line">
              {errorMsg}
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="ml-2 underline text-red-500"
              >
                OK
              </button>
            </div>
          )}

          {/* Bouton envoyer */}
          <button
            type="submit"
            disabled={!files.length}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-40"
            style={{ background: '#C9A84C' }}
          >
            {files.length > 1 ? `Envoyer ${files.length} souvenirs 🎉` : 'Envoyer 🎉'}
          </button>
        </form>
      </div>
    </div>
  )
}
