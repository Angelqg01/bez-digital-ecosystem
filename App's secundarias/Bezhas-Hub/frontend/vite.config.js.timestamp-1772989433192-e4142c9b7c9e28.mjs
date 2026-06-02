// vite.config.js
import { defineConfig } from "file:///D:/Documentos%20D/Documentos%20Yoe/BeZhas/BeZhas%20Web/bezhas-web3/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Documentos%20D/Documentos%20Yoe/BeZhas/BeZhas%20Web/bezhas-web3/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { nodePolyfills } from "file:///D:/Documentos%20D/Documentos%20Yoe/BeZhas/BeZhas%20Web/bezhas-web3/frontend/node_modules/vite-plugin-node-polyfills/dist/index.js";
import { VitePWA } from "file:///D:/Documentos%20D/Documentos%20Yoe/BeZhas/BeZhas%20Web/bezhas-web3/frontend/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "D:\\Documentos D\\Documentos Yoe\\BeZhas\\BeZhas Web\\bezhas-web3\\frontend";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png", "apple-touch-icon.png"],
      manifest: {
        name: "BeZhas - Social Crypto Platform",
        short_name: "BeZhas",
        description: "La red social descentralizada para la econom\xEDa del futuro",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // 10 MB limit for large chunks
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
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
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
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
      "@": path.resolve(__vite_injected_original_dirname, "./src")
      // '@sdk': path.resolve(__dirname, '../sdk'), // Removed specific alias to use node_modules package
    }
  },
  define: {
    // 'process.env': {}, // Removed to avoid breaking libraries
    global: "globalThis"
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis"
      }
    },
    exclude: ["@bezhas/sdk"]
    // include: ['buffer', 'process'] // Handled by plugin
  },
  build: {
    minify: false,
    // Disabled for debugging
    sourcemap: true,
    // Enabled for debugging
    rollupOptions: {
      external: (id) => {
        if (id.includes("/sdk/node_modules/")) return true;
        return false;
      },
      // Prevent issues with node polyfills in SDK
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        if (warning.code === "UNRESOLVED_IMPORT" && warning.exporter?.includes("sdk")) return;
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
      timeout: 5e3
    },
    watch: {
      // Reducir la sensibilidad del file watcher
      usePolling: false,
      interval: 1e3,
      // Check every 1 second instead of continuously
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"]
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none"
      // Removemos CSP para permitir que WalletConnect funcione sin restricciones
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        rewrite: (path2) => path2
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxEb2N1bWVudG9zIERcXFxcRG9jdW1lbnRvcyBZb2VcXFxcQmVaaGFzXFxcXEJlWmhhcyBXZWJcXFxcYmV6aGFzLXdlYjNcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXERvY3VtZW50b3MgRFxcXFxEb2N1bWVudG9zIFlvZVxcXFxCZVpoYXNcXFxcQmVaaGFzIFdlYlxcXFxiZXpoYXMtd2ViM1xcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovRG9jdW1lbnRvcyUyMEQvRG9jdW1lbnRvcyUyMFlvZS9CZVpoYXMvQmVaaGFzJTIwV2ViL2Jlemhhcy13ZWIzL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tICd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscydcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgbm9kZVBvbHlmaWxscyh7XG4gICAgICAvLyBXaGV0aGVyIHRvIHBvbHlmaWxsIGBub2RlOmAgcHJvdG9jb2wgaW1wb3J0cy5cbiAgICAgIHByb3RvY29sSW1wb3J0czogdHJ1ZSxcbiAgICB9KSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgaW5jbHVkZUFzc2V0czogWydsb2dvLnBuZycsICdhcHBsZS10b3VjaC1pY29uLnBuZyddLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ0JlWmhhcyAtIFNvY2lhbCBDcnlwdG8gUGxhdGZvcm0nLFxuICAgICAgICBzaG9ydF9uYW1lOiAnQmVaaGFzJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdMYSByZWQgc29jaWFsIGRlc2NlbnRyYWxpemFkYSBwYXJhIGxhIGVjb25vbVx1MDBFRGEgZGVsIGZ1dHVybycsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzBmMTcyYScsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMGYxNzJhJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBvcmllbnRhdGlvbjogJ3BvcnRyYWl0JyxcbiAgICAgICAgc2NvcGU6ICcvJyxcbiAgICAgICAgc3RhcnRfdXJsOiAnLycsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnL3B3YS0xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnL3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgY2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxuICAgICAgICBza2lwV2FpdGluZzogdHJ1ZSxcbiAgICAgICAgY2xpZW50c0NsYWltOiB0cnVlLFxuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogMTAgKiAxMDI0ICogMTAyNCwgLy8gMTAgTUIgbGltaXQgZm9yIGxhcmdlIGNodW5rc1xuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9J10sXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdvb2dsZWFwaXNcXC5jb21cXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnb29nbGUtZm9udHMtY2FjaGUnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAsXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XG4gICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvYXBpXFwuY29pbmdlY2tvXFwuY29tXFwvLiovaSxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdOZXR3b3JrRmlyc3QnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdhcGktY2FjaGUnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogNTAsXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA1XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XG4gICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH1cbiAgICB9KVxuICBdLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAvLyAnQHNkayc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9zZGsnKSwgLy8gUmVtb3ZlZCBzcGVjaWZpYyBhbGlhcyB0byB1c2Ugbm9kZV9tb2R1bGVzIHBhY2thZ2VcbiAgICB9XG4gIH0sXG4gIGRlZmluZToge1xuICAgIC8vICdwcm9jZXNzLmVudic6IHt9LCAvLyBSZW1vdmVkIHRvIGF2b2lkIGJyZWFraW5nIGxpYnJhcmllc1xuICAgIGdsb2JhbDogJ2dsb2JhbFRoaXMnXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGVzYnVpbGRPcHRpb25zOiB7XG4gICAgICBkZWZpbmU6IHtcbiAgICAgICAgZ2xvYmFsOiAnZ2xvYmFsVGhpcydcbiAgICAgIH1cbiAgICB9LFxuICAgIGV4Y2x1ZGU6IFsnQGJlemhhcy9zZGsnXSxcbiAgICAvLyBpbmNsdWRlOiBbJ2J1ZmZlcicsICdwcm9jZXNzJ10gLy8gSGFuZGxlZCBieSBwbHVnaW5cbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBtaW5pZnk6IGZhbHNlLCAvLyBEaXNhYmxlZCBmb3IgZGVidWdnaW5nXG4gICAgc291cmNlbWFwOiB0cnVlLCAvLyBFbmFibGVkIGZvciBkZWJ1Z2dpbmdcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBleHRlcm5hbDogKGlkKSA9PiB7XG4gICAgICAgIC8vIEV4dGVybmFsaXplIFNESyBub2RlX21vZHVsZXMgdG8gYXZvaWQgcG9seWZpbGwgaXNzdWVzXG4gICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3Nkay9ub2RlX21vZHVsZXMvJykpIHJldHVybiB0cnVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgLy8gUHJldmVudCBpc3N1ZXMgd2l0aCBub2RlIHBvbHlmaWxscyBpbiBTREtcbiAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdNT0RVTEVfTEVWRUxfRElSRUNUSVZFJykgcmV0dXJuO1xuICAgICAgICBpZiAod2FybmluZy5jb2RlID09PSAnVU5SRVNPTFZFRF9JTVBPUlQnICYmIHdhcm5pbmcuZXhwb3J0ZXI/LmluY2x1ZGVzKCdzZGsnKSkgcmV0dXJuO1xuICAgICAgICB3YXJuKHdhcm5pbmcpO1xuICAgICAgfVxuICAgIH0sXG4gICAgY29tbW9uanNPcHRpb25zOiB7XG4gICAgICB0cmFuc2Zvcm1NaXhlZEVzTW9kdWxlczogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogdHJ1ZSxcbiAgICBwb3J0OiA1MTczLFxuICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgaG1yOiB7XG4gICAgICAvLyBPcHRpbWl6YXIgSE1SIHBhcmEgcmVkdWNpciByZWZyZXNjb3MgaW5uZWNlc2FyaW9zXG4gICAgICBvdmVybGF5OiB0cnVlLFxuICAgICAgdGltZW91dDogNTAwMCxcbiAgICB9LFxuICAgIHdhdGNoOiB7XG4gICAgICAvLyBSZWR1Y2lyIGxhIHNlbnNpYmlsaWRhZCBkZWwgZmlsZSB3YXRjaGVyXG4gICAgICB1c2VQb2xsaW5nOiBmYWxzZSxcbiAgICAgIGludGVydmFsOiAxMDAwLCAvLyBDaGVjayBldmVyeSAxIHNlY29uZCBpbnN0ZWFkIG9mIGNvbnRpbnVvdXNseVxuICAgICAgaWdub3JlZDogWycqKi9ub2RlX21vZHVsZXMvKionLCAnKiovLmdpdC8qKicsICcqKi9kaXN0LyoqJ11cbiAgICB9LFxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDcm9zcy1PcmlnaW4tT3BlbmVyLVBvbGljeSc6ICdzYW1lLW9yaWdpbi1hbGxvdy1wb3B1cHMnLFxuICAgICAgJ0Nyb3NzLU9yaWdpbi1FbWJlZGRlci1Qb2xpY3knOiAndW5zYWZlLW5vbmUnLFxuICAgICAgLy8gUmVtb3ZlbW9zIENTUCBwYXJhIHBlcm1pdGlyIHF1ZSBXYWxsZXRDb25uZWN0IGZ1bmNpb25lIHNpbiByZXN0cmljY2lvbmVzXG4gICAgfSxcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgsXG4gICAgICB9XG4gICAgfSxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFaLFNBQVMsb0JBQW9CO0FBQ2xiLE9BQU8sV0FBVztBQUNsQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGVBQWU7QUFDeEIsT0FBTyxVQUFVO0FBSmpCLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQTtBQUFBLE1BRVosaUJBQWlCO0FBQUEsSUFDbkIsQ0FBQztBQUFBLElBQ0QsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLFlBQVksc0JBQXNCO0FBQUEsTUFDbEQsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1QsYUFB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
