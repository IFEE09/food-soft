import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true
  },
  preview: {
    allowedHosts: true
  },
  build: {
    // Code splitting + chunks estables: la cache del navegador sobrevive
    // a deploys que solo cambien páginas individuales.
    rollupOptions: {
      output: {
        manualChunks: {
          // React core: cambia raras veces, chunk dedicado.
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // Aviso si un chunk crece demasiado (no falla el build).
    chunkSizeWarningLimit: 600,
  },
})
