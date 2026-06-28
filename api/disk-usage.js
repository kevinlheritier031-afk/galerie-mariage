// Vercel Edge Function — relais entre le panel admin (HTTPS) et l'API disque sur le VPS (HTTP)
//
// Cette Edge Function tourne côté serveur Vercel
// Elle fait le relais entre le panel admin (HTTPS)
// et l'API disque sur le VPS (HTTP)
// Cela évite les erreurs mixed content du navigateur
// qui bloque les appels HTTP depuis une page HTTPS
//
// Le panel admin appelle /api/disk-usage (relatif HTTPS)
// La Edge Function appelle DISK_API_URL (HTTP côté serveur)
// et retourne le résultat au panel admin

export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  // Récupère l'URL de l'API disque depuis les variables d'environnement Vercel
  const diskApiUrl = process.env.DISK_API_URL

  if (!diskApiUrl) {
    return new Response(
      JSON.stringify({ error: 'DISK_API_URL non configuré dans les variables Vercel.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }

  try {
    // Appel HTTP vers le VPS (autorisé côté serveur, interdit côté navigateur)
    const response = await fetch(`${diskApiUrl}/api/disk-usage`, {
      // Timeout de 5 secondes pour ne pas bloquer le panel admin si le VPS est lent
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`Le VPS a répondu avec le statut ${response.status}`)
    }

    const data = await response.json()

    // Retourne le JSON du VPS tel quel avec les headers CORS
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    // Retourne une erreur 503 si le VPS est inaccessible
    return new Response(
      JSON.stringify({
        error: 'API disque inaccessible',
        detail: err.message,
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}
