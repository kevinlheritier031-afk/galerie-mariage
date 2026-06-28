import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuration Vite pour Galerie Mariage
// Optimisée pour la production : pas de sourcemap, chunks anonymisés
export default defineConfig({
  plugins: [
    react(),
    // Supprime le meta tag generator <meta name="generator" content="Vite"> de l'HTML
    {
      name: 'remove-generator-meta',
      transformIndexHtml(html) {
        return html.replace(/<meta name="generator"[^>]*>/gi, '')
      },
    },
  ],
  build: {
    // Pas de sourcemap en production pour réduire la taille et protéger le code
    sourcemap: false,
    rollupOptions: {
      output: {
        // Noms de chunks anonymisés par hash pour éviter la reverse-engineering
        chunkFileNames: '[hash].js',
        assetFileNames: '[hash][extname]',
        entryFileNames: '[hash].js',
      },
    },
  },
})
