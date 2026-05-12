import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflare } from "@cloudflare/vite-plugin";

const appVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
).version as string

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  plugins: [react({
    babel: {
      plugins: [['babel-plugin-react-compiler']],
    },
  }), tailwindcss(), cloudflare()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react', '@phosphor-icons/react'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-sanitize'],
          'vendor-ocid': ['@opencampus/ocid-connect-js'],
          'vendor-ui': ['@base-ui/react', 'next-themes', 'sonner', 'zustand'],
        },
      },
    },
  },
})
