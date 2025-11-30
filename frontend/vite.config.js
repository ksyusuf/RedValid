import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', // Ana sayfada iseniz
  // base: '/redvalid/', // GitHub repo adınız redvalid ise
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined,
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
    sourcemap: false,
    minify: 'terser',
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 3000
  },
  define: {
    global: 'globalThis',
  },
})
