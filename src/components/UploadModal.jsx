import { useState, useRef, useEffect } from 'react'
import { validatePhoto } from '../lib/mediaValidation.js'

// Étapes : 'choose' → 'camera' → 'review'
export default function UploadModal({ onClose, onStartUpload }) {
  const [pseudo, setPseudo] = useState(() => localStorage.getItem('wedding_pseudo') || '')
  const [mode, setMode] = useState('choose')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [flash, setFlash] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // Démarre la caméra quand on entre en mode 'camera'
  useEffect(() => {
    if (mode !== 'camera') return
    setCameraError('')

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setCameraError("Impossible d'accéder à la caméra. Vérifiez les permissions."))

    return () => stopCamera()
  }, [mode])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    setFlash(true)
    setTimeout(() => setFlash(false), 120)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
      setFiles((prev) => [...prev, { raw: file }])
      setPreviews((prev) => [...prev, URL.createObjectURL(blob)])
    }, 'image/jpeg', 0.92)
  }

  function removeFile(index) {
    URL.revokeObjectURL(previews[index])
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  function clearAll() {
    previews.forEach((p) => URL.revokeObjectURL(p))
    setFiles([])
    setPreviews([])
    setErrorMsg('')
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
        valid.push({ raw: f })
        validPreviews.push(URL.createObjectURL(f))
      } else {
        errors.push(`${f.name} : ${result.error}`)
      }
    }
    setFiles(valid)
    setPreviews(validPreviews)
    if (errors.length) setErrorMsg(errors.join('\n'))
    setMode('review')
  }

  function handleClose() {
    clearAll()
    stopCamera()
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!files.length) return
    onStartUpload(files, pseudo, 'photo')
  }

  const PseudoInput = (
    <input
      type="text"
      value={pseudo}
      onChange={(e) => { setPseudo(e.target.value); localStorage.setItem('wedding_pseudo', e.target.value) }}
      placeholder="Votre prénom (optionnel)"
      maxLength={50}
      className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none"
      style={{ borderColor: '#C9A84C40', color: '#2C2C2C' }}
    />
  )

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Étape 1 : choix de la source ── */}
        {mode === 'choose' && (
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
                Ajouter un souvenir
              </h2>
              <button onClick={handleClose} className="text-2xl text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center">×</button>
            </div>

            {PseudoInput}

            <div className="rounded-xl border-2 p-4" style={{ borderColor: '#C9A84C30', background: '#FFFDF7' }}>
              <p className="text-xs text-center mb-3 font-medium" style={{ color: '#8B7355' }}>
                Comment souhaitez-vous ajouter votre photo ?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input type="file" accept="image/*" multiple onChange={handleGalleryChange} className="hidden" id="gallery-input" />
                <label
                  htmlFor="gallery-input"
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:bg-amber-50 active:scale-95"
                  style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
                >
                  <span className="text-3xl">🖼️</span>
                  <span className="text-xs font-semibold text-center leading-tight" style={{ color: '#2C2C2C' }}>Depuis ma galerie</span>
                  <span className="text-xs text-center leading-tight" style={{ color: '#8B7355' }}>1 ou plusieurs photos</span>
                </label>

                <button
                  type="button"
                  onClick={() => setMode('camera')}
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 cursor-pointer transition-all hover:bg-amber-50 active:scale-95"
                  style={{ borderColor: '#C9A84C', background: '#C9A84C10' }}
                >
                  <span className="text-3xl">📷</span>
                  <span className="text-xs font-semibold text-center leading-tight" style={{ color: '#2C2C2C' }}>Photo en direct</span>
                  <span className="text-xs text-center leading-tight" style={{ color: '#8B7355' }}>Prenez la photo maintenant</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Étape 2 : caméra live ── */}
        {mode === 'camera' && (
          <div className="flex flex-col" style={{ background: '#000' }}>
            {/* Barre du haut */}
            <div
              className="flex items-center justify-between px-4 py-3 z-10"
              style={{ background: 'rgba(0,0,0,0.55)' }}
            >
              <button
                onClick={() => { stopCamera(); clearAll(); setMode('choose') }}
                className="text-white text-sm font-medium px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                ← Retour
              </button>

              {/* Compteur de photos */}
              {files.length > 0 ? (
                <span
                  className="text-white text-sm font-bold px-4 py-1.5 rounded-full"
                  style={{ background: '#C9A84C' }}
                >
                  {files.length} photo{files.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-white/50 text-sm">Aucune photo</span>
              )}

              {/* Valider visible uniquement si au moins 1 photo */}
              {files.length > 0 ? (
                <button
                  onClick={() => { stopCamera(); setMode('review') }}
                  className="text-sm font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: '#C9A84C', color: '#fff' }}
                >
                  Valider →
                </button>
              ) : (
                <div className="w-20" />
              )}
            </div>

            {/* Flash */}
            {flash && (
              <div className="absolute inset-0 z-20 bg-white pointer-events-none" style={{ opacity: 0.75 }} />
            )}

            {/* Viewfinder */}
            {cameraError ? (
              <div className="flex items-center justify-center text-white text-center p-10" style={{ minHeight: '55vw' }}>
                <p className="text-sm">{cameraError}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
                style={{ maxHeight: '58vh', objectFit: 'cover', background: '#111' }}
              />
            )}
            <canvas ref={canvasRef} className="hidden" />

            {/* Barre du bas */}
            <div className="flex items-center justify-between px-8 py-5" style={{ background: '#111' }}>
              {/* Dernière vignette */}
              <div className="w-12 h-12">
                {previews.length > 0 && (
                  <img
                    src={previews[previews.length - 1]}
                    className="w-12 h-12 rounded-lg object-cover border-2"
                    style={{ borderColor: '#C9A84C' }}
                    alt=""
                  />
                )}
              </div>

              {/* Bouton déclencheur */}
              <button
                onClick={capturePhoto}
                disabled={!!cameraError}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-90 disabled:opacity-40"
                style={{ background: 'transparent' }}
                aria-label="Prendre une photo"
              >
                <div className="w-14 h-14 rounded-full bg-white" />
              </button>

              {/* Espace symétrique */}
              <div className="w-12 h-12" />
            </div>
          </div>
        )}

        {/* ── Étape 3 : révision ── */}
        {mode === 'review' && (
          <div className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#2C2C2C' }}>
                  Vos photos
                </h2>
                <button type="button" onClick={handleClose} className="text-2xl text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center">×</button>
              </div>

              {PseudoInput}

              {/* Grille de révision */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: '#8B7355' }}>
                    {previews.length} photo{previews.length > 1 ? 's' : ''} à envoyer
                  </span>
                  <button
                    type="button"
                    onClick={() => setMode('camera')}
                    className="text-xs font-medium underline"
                    style={{ color: '#C9A84C' }}
                  >
                    + En prendre d'autres
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 overflow-y-auto" style={{ maxHeight: '42vh' }}>
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

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 whitespace-pre-line">
                  {errorMsg}
                  <button type="button" onClick={() => setErrorMsg('')} className="ml-2 underline text-red-500">OK</button>
                </div>
              )}

              <button
                type="submit"
                disabled={!files.length}
                className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-40"
                style={{ background: '#C9A84C' }}
              >
                {files.length > 1 ? `Envoyer ${files.length} photos 🎉` : 'Envoyer 🎉'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
