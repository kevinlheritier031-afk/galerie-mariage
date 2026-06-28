// Hook de lecture et synchronisation en temps réel des paramètres globaux
// Lit download_mode depuis la table settings au montage
// Ecoute les UPDATE Realtime : quand l'admin change le mode depuis le panel,
// tous les clients reçoivent le nouveau mode instantanément
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useSettings() {
  const [downloadMode, setDownloadMode] = useState('open')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Lecture initiale du mode de téléchargement
    async function fetchSettings() {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'download_mode')
        .single()

      if (data) setDownloadMode(data.value)
      setLoading(false)
    }

    fetchSettings()

    // Abonnement aux changements de la table settings en temps réel
    const channel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'key=eq.download_mode' },
        (payload) => {
          // Met à jour le mode chez tous les clients sans refresh
          setDownloadMode(payload.new.value)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { downloadMode, loading }
}
