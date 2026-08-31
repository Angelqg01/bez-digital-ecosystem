import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

// https://vitejs.dev/config/
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isWindowsPathWithApostrophe = process.cwd().includes("'")

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
    VitePWA({
      disable: isWindowsPathWithApostrophe,
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'BeZhas - Social Crypto Platform',
        short_name: 'BeZhas',
        description: 'La red social descentralizada para la economía del futuro',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB limit for large chunks
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.coingecko\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // '@sdk': path.resolve(__dirname, '../sdk'), // Removed specific alias to use node_modules package
    }
  },
  define: {
    // 'process.env': {}, // Removed to avoid breaking libraries
    global: 'globalThis'
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    },
    exclude: ['@bezhas/sdk'],
    // include: ['buffer', 'process'] // Handled by plugin
  },
  build: {
    minify: false, // Disabled for debugging
    sourcemap: true, // Enabled for debugging
    rollupOptions: {
      external: (id) => {
        // Externalize SDK node_modules to avoid polyfill issues
        if (id.includes('/sdk/node_modules/')) return true;
        return false;
      },
      // Prevent issues with node polyfills in SDK
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.exporter?.includes('sdk')) return;
        warn(warning);
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      // Optimizar HMR para reducir refrescos innecesarios
      overlay: true,
      timeout: 5000,
    },
    watch: {
      // Reducir la sensibilidad del file watcher
      usePolling: false,
      interval: 1000, // Check every 1 second instead of continuously
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      // Removemos CSP para permitir que WalletConnect funcione sin restricciones
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      }
    },
  },
})
