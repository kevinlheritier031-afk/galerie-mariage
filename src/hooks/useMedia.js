// Hook de chargement et synchronisation en temps réel des médias
// Charge tous les médias triés par created_at DESC au montage
// Ecoute les événements Realtime Supabase :
//   INSERT → ajoute le nouveau média en tête de liste (apparaît instantanément)
//   DELETE → retire le média supprimé de la liste
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useMedia() {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Chargement initial de tous les médias
    async function fetchMedia() {
      const { data, error: fetchError } = await supabase
        .from('media')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setMedia(data || [])
      }
      setLoading(false)
    }

    fetchMedia()

    // Abonnement Realtime pour recevoir les nouvelles insertions et suppressions
    // Cela permet à tous les invités de voir les uploads en direct
    const channel = supabase
      .channel('media-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'media' },
        (payload) => {
          // Ajoute le nouveau média en tête de liste sans rechargement
          setMedia((prev) => [payload.new, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'media' },
        (payload) => {
          // Retire le média supprimé de la liste
          setMedia((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .subscribe()

    // Nettoyage : désabonnement quand le composant est démonté
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { media, loading, error }
}
