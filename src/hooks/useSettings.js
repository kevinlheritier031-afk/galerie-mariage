import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const DEFAULT_TITLE = 'Notre Mariage 💍'

export function useSettings() {
  const [downloadMode, setDownloadMode] = useState('open')
  const [appTitle, setAppTitle] = useState(DEFAULT_TITLE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['download_mode', 'app_title'])

      if (data) {
        data.forEach(({ key, value }) => {
          if (key === 'download_mode') setDownloadMode(value)
          if (key === 'app_title') setAppTitle(value)
        })
      }
      setLoading(false)
    }

    fetchSettings()

    // Realtime : mise à jour instantanée chez tous les clients
    const channel = supabase
      .channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        if (payload.new?.key === 'download_mode') setDownloadMode(payload.new.value)
        if (payload.new?.key === 'app_title') setAppTitle(payload.new.value)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return { downloadMode, appTitle, loading }
}
