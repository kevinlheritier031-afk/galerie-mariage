// Lecteur vidéo HTML5 natif utilisé dans le Lightbox
// Contrôles natifs du navigateur pour compatibilité maximale
// Pas de bibliothèque externe, lecture directe depuis l'URL Supabase Storage
export default function VideoPlayer({ src, className = '' }) {
  return (
    <video
      src={src}
      controls
      autoPlay
      playsInline
      className={`max-h-[80vh] max-w-full rounded-lg ${className}`}
      style={{ background: '#000' }}
    >
      Votre navigateur ne supporte pas la lecture vidéo HTML5.
    </video>
  )
}
