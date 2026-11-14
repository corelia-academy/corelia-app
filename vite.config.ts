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

function localSpaHistoryFallback() {
  return {
    name: 'corelia-local-spa-history-fallback',
    apply: 'serve' as const,
    enforce: 'pre' as const,
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.headers.accept?.includes('text/html')) return next()

        const requestUrl = req.url ?? '/'
        const pathname = new URL(requestUrl, 'http://vite.local').pathname
        const basePath = server.config.base.replace(/\/+$/, '')
        if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return next()
        if (basePath && pathname.startsWith(`${basePath}/assets/`)) return next()

        try {
          const html = await server.transformIndexHtml(
            requestUrl,
            readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf-8'),
          )
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        } catch (error) {
          next(error as Error)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // The SPA is served at corelia.academy/learn; the Astro landing owns the domain root.
  base: '/learn/',
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
  }), tailwindcss(), localSpaHistoryFallback(), cloudflare()],
  build: {
    rollupOptions: {
      // Cloudflare Workers Builds hits EMFILE with Rollup's default of 1000 parallel file reads.
      maxParallelFileOps: 100,
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
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) {
            return 'vendor-query'
          }
          if (id.includes('@base-ui/react') || id.includes('next-themes') || id.includes('sonner') || id.includes('zustand')) {
            return 'vendor-ui'
          }
        },
      },
    },
  },
})
