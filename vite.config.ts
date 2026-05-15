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
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react'
          }
          if (id.includes('@supabase/supabase-js')) {
            return 'vendor-supabase'
          }
          if (id.includes('lucide-react') || id.includes('@phosphor-icons/react')) {
            return 'vendor-icons'
          }
          if (id.includes('i18next') || id.includes('react-i18next') || id.includes('i18next-browser-languagedetector')) {
            return 'vendor-i18n'
          }
          if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('rehype-sanitize')) {
            return 'vendor-markdown'
          }
          if (id.includes('@opencampus/ocid-connect-js')) {
            return 'vendor-ocid'
          }
          if (id.includes('@base-ui/react') || id.includes('next-themes') || id.includes('sonner') || id.includes('zustand')) {
            return 'vendor-ui'
          }

          if (
            id.includes('/src/components/layouts/MainLayout') ||
            id.includes('/src/components/course-ai/') ||
            id.includes('/src/hooks/useCoraAI.ts') ||
            id.includes('/src/pages/home/')
          ) {
            return 'feature-learner-core'
          }
        },
      },
    },
  },
})
