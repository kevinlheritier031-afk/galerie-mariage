// Logger centralisé côté client
// Envoie les événements vers /api/log (stockage Supabase, visible dans le panel admin)
// Fire-and-forget : n'interrompt jamais le flux utilisateur en cas d'échec

const ENDPOINT = '/api/log'

function send(level, context, message, metadata) {
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level,
      context,
      message: message instanceof Error ? message.message : String(message),
      metadata: metadata
        ? { ...metadata, stack: message instanceof Error ? message.stack : undefined }
        : message instanceof Error
        ? { stack: message.stack }
        : undefined,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {})
}

export const logger = {
  error: (context, message, metadata) => {
    console.error(`[${context}]`, message, metadata || '')
    send('error', context, message, metadata)
  },
  warn: (context, message, metadata) => {
    console.warn(`[${context}]`, message, metadata || '')
    send('warn', context, message, metadata)
  },
  info: (context, message, metadata) => {
    send('info', context, message, metadata)
  },
}

// Capture globale des erreurs JS non gérées
export function initGlobalErrorHandlers() {
  window.addEventListener('error', (e) => {
    logger.error('client:uncaught', e.message, {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    })
  })

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    logger.error('client:unhandledrejection', msg, {
      stack: e.reason instanceof Error ? e.reason.stack : undefined,
    })
  })
}
