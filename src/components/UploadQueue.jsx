// Barre de progression de la queue d'upload
// Affiche chaque fichier avec son statut : en attente / progression / succès / erreur

export default function UploadQueue({ jobs, onDismissError }) {
  if (!jobs.length) return null

  const allDone = jobs.every((j) => j.status === 'done')
  const doneCount = jobs.filter((j) => j.status === 'done').length

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-xl border w-80 overflow-hidden"
      style={{ borderColor: '#C9A84C40' }}
    >
      {/* En-tête */}
      <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: '#C9A84C20', background: '#FFFDF7' }}>
        <p className="text-sm font-semibold" style={{ color: allDone ? '#16a34a' : '#2C2C2C' }}>
          {allDone ? `Partagé ! 🎉` : 'Envoi en cours…'}
        </p>
        <p className="text-xs" style={{ color: '#8A7F72' }}>
          {doneCount}/{jobs.length} terminé{jobs.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Liste */}
      <div className="max-h-48 overflow-y-auto divide-y" style={{ borderColor: '#C9A84C10' }}>
        {jobs.map((job) => (
          <div key={job.id} className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-1 gap-2">
              <p className="text-xs truncate font-medium flex-1" style={{ color: '#2C2C2C' }}>
                {job.type === 'video' ? '🎥' : '📷'}
              </p>
              <StatusBadge job={job} onDismiss={() => onDismissError(job.id)} />
            </div>

            {job.status === 'uploading' && job.phase === 'presign' && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                  <div className="h-1 rounded-full animate-pulse" style={{ width: '100%', background: '#C9A84C40' }} />
                </div>
                <span className="text-xs shrink-0" style={{ color: '#8A7F72' }}>Préparation…</span>
              </div>
            )}

            {job.status === 'uploading' && job.phase !== 'presign' && (
              <div>
                <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-1 rounded-full transition-all duration-300"
                    style={{ width: `${job.progress}%`, background: '#C9A84C' }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-xs" style={{ color: '#8A7F72' }}>{job.progress}%</span>
                  {job.speed > 0 && (
                    <span className="text-xs" style={{ color: '#8A7F72' }}>
                      {job.speed < 1 ? `${(job.speed * 1024).toFixed(0)} Ko/s` : `${job.speed.toFixed(1)} Mo/s`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {job.status === 'error' && (
              <p className="text-xs text-red-500 mt-0.5 leading-snug">{job.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ job, onDismiss }) {
  if (job.status === 'waiting') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">En attente</span>
  }
  if (job.status === 'uploading') {
    return <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: '#C9A84C20', color: '#C9A84C' }}>⬆️ Envoi</span>
  }
  if (job.status === 'done') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">✓ Partagé</span>
  }
  if (job.status === 'error') {
    return (
      <button onClick={onDismiss} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">
        ✕ Erreur
      </button>
    )
  }
  return null
}
