// Client Supabase partagé dans toute l'application
// Utilise les variables d'environnement Vite (préfixe VITE_)
// VITE_SUPABASE_URL : URL du Supabase self-hosted (ex: http://141.94.121.159:8000)
// VITE_SUPABASE_ANON_KEY : clé publique pour les opérations de lecture/écriture
// VITE_SUPABASE_SERVICE_KEY : clé service pour les suppressions admin
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes dans .env')
}

// Client public — utilisé pour les lectures, inserts et Realtime
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    // Reconnexion automatique si la connexion WebSocket se coupe
    params: { eventsPerSecond: 10 },
  },
})

// Client service role — utilisé uniquement dans le panel admin pour les suppressions
// Bypasse les Row Level Security policies
export function createServiceClient() {
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    throw new Error('Variable VITE_SUPABASE_SERVICE_KEY manquante dans .env')
  }
  return createClient(supabaseUrl, serviceKey)
}
