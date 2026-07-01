// Cloudflare Worker — upload vidéo direct vers R2
// Le Worker s'exécute au PoP CF le plus proche de l'utilisateur (Paris/Frankfurt).
// Le body est streamé directement dans R2 via binding interne (pas d'HTTP entre Worker et R2).
// Résultat : browser → CF PoP local → R2 (réseau interne CF) = vitesse max.

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowedOrigin = env.ALLOWED_ORIGIN || '*'

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Filename, X-Upload-Secret',
      'Access-Control-Max-Age': '86400',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
    }

    // Auth par secret partagé
    if (request.headers.get('X-Upload-Secret') !== env.UPLOAD_SECRET) {
      return new Response(JSON.stringify({ error: 'Non autorisé.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contentType = request.headers.get('Content-Type') || 'video/mp4'
    if (!contentType.startsWith('video/')) {
      return new Response(JSON.stringify({ error: 'Type non autorisé.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const filename = request.headers.get('X-Filename') || 'video.mp4'
    const ext = (filename.split('.').pop() || 'mp4').toLowerCase()
    const key = `${crypto.randomUUID()}.${ext}`

    // Stream direct vers R2 — pas de buffer en mémoire, pas de HTTP
    await env.R2_BUCKET.put(key, request.body, {
      httpMetadata: { contentType },
    })

    const publicUrl = `${env.R2_PUBLIC_URL}/${key}`

    return new Response(JSON.stringify({ key, publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  },
}
