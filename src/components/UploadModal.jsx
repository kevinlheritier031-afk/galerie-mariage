// Modale d'upload pour photos et vidéos
// Deux onglets : Photo (appareil photo natif mobile) / Vidéo (caméra native mobile)
// Validation côté client avant upload (durée, taille, type MIME)
// Qualité originale préservée, aucune compression
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { validatePhoto, validateVideo } from '../lib/mediaValidation.js'

export default function UploadModal({ onClose }) {
  const [tab, setTab] = useState('photo') // 'photo' | 'video'
  const [pseudo, setPseudo] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null) // URL objet pour la prévisualisation
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)

  // Nettoie la prévisualisation précédente avant d'en créer une nouvelle
  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFile(null)
    setErrorMsg('')
  }

  function switchTab(newTab) {
    clearPreview()
    setTab(newTab)
    setSuccessMsg('')
  }

  async function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    clearPreview()

    let validationResult
    if (tab === 'photo') {
      validationResult = validatePhoto(selected)
    } else {
      // validateVideo est asynchrone car elle lit les métadonnées du fichier
      validationResult = await validateVideo(selected)
    }

    if (!validationResult.valid) {
      setErrorMsg(validationResult.error)
      return
    }

    setFile({ raw: selected, duration: validationResult.duration })
    setPreview(URL.createObjectURL(selected))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setProgress(0)
    setErrorMsg('')

    try {
      // Nom unique basé sur UUID pour éviter les collisions en cas d'upload simultané
      const ext = file.raw.name.split('.').pop() || (tab === 'video' ? 'mp4' : 'jpg')
      const fileName = `${crypto.randomUUID()}.${ext}`

      // Upload dans le bucket Supabase Storage
      // Supabase JS SDK ne supporte pas le suivi de progression natif,
      // on simule un progrès linéaire jusqu'à 90% puis 100% à la fin
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 5, 90))
      }, 200)

      const { error: uploadError } = await supabase.storage
        .from('wedding-media')
        .upload(fileName, file.raw, {
          cacheControl: '3600',
          upsert: false,
        })

      clearInterval(progressInterval)

      if (uploadError) throw uploadError

      setProgress(95)

      // Récupération de l'URL publique permanente
      const { data: urlData } = supabase.storage
        .from('wedding-media')
        .getPublicUrl(fileName)

      if (!urlData?.publicUrl) throw new Error('Impossible de récupérer l\'URL publique.')

      // Insertion en base de données — déclenche l'événement Realtime pour tous les clients
      const { error: dbError } = await supabase.from('media').insert({
        pseudo: pseudo.trim() || 'Invité anonyme',
        storage_path: fileName,
        public_url: urlData.publicUrl,
        type: tab,
        duration_seconds: file.duration || null,
      })

      if (dbError) throw dbError

      setProgress(100)
      setSuccessMsg('Votre média est visible par tous 🎉')

      // Réinitialise le formulaire après succès
      setTimeout(() => {
        clearPreview()
        setPseudo('')
        setSuccessMsg('')
        setProgress(0)
        // Reset les inputs file
        if (photoInputRef.current) photoInputRef.current.value = ''
        if (videoInputRef.current) videoInputRef.current.value = ''
      }, 2500)
    } catch (err) {
      setErrorMsg(err.message || 'Une erreur est survenue. Réessayez.')
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
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
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Onglets Photo / Vidéo */}
        <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
          {['photo', 'video'].map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className="flex-1 py-2 rounded-md text-sm font-semibold transition-all"
              style={{
                background: tab === t ? '#C9A84C' : 'transparent',
                color: tab === t ? '#fff' : '#8A7F72',
              }}
            >
              {t === 'photo' ? '📷 Photo' : '🎥 Vidéo'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Champ pseudo optionnel */}
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Votre prénom (optionnel)"
            maxLength={50}
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold transition-colors"
            style={{ borderColor: '#C9A84C40', color: '#2C2C2C' }}
          />

          {/* Bouton choisir fichier */}
          {tab === 'photo' ? (
            <>
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
            </>
          ) : (
            <>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="video-input"
              />
              <label
                htmlFor="video-input"
                className="block w-full text-center py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-sm font-medium"
                style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
              >
                🎥 Choisir une vidéo
              </label>
            </>
          )}

          {/* Prévisualisation */}
          {preview && (
            <div className="rounded-lg overflow-hidden bg-gray-50 border" style={{ borderColor: '#C9A84C20' }}>
              {tab === 'photo' ? (
                <img src={preview} alt="Prévisualisation" className="w-full h-40 object-cover" />
              ) : (
                <video src={preview} controls className="w-full h-40 object-cover" />
              )}
            </div>
          )}

          {/* Message d'erreur */}
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

          {/* Barre de progression */}
          {uploading && (
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-200"
                style={{ width: `${progress}%`, background: '#C9A84C' }}
              />
            </div>
          )}

          {/* Message succès */}
          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 text-center font-medium">
              {successMsg}
            </div>
          )}

          {/* Bouton envoyer */}
          {!successMsg && (
            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-40"
              style={{ background: '#C9A84C' }}
            >
              {uploading ? `Envoi en cours… ${progress}%` : 'Envoyer 🎉'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
