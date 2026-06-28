import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const POLL_INTERVAL = 8000 // ms

export function useMedia() {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchAll() {
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

    fetchAll()

    // Polling toutes les 8 secondes — fiable même sans WebSocket
    const interval = setInterval(fetchAll, POLL_INTERVAL)

    // Realtime en bonus si le WebSocket passe (proxy Vercel → VPS)
    const channel = supabase
      .channel('media-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'media' }, (payload) => {
        setMedia((prev) =>
          prev.some((m) => m.id === payload.new.id) ? prev : [payload.new, ...prev]
        )
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'media' }, (payload) => {
        setMedia((prev) => prev.filter((m) => m.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  return { media, loading, error }
}
