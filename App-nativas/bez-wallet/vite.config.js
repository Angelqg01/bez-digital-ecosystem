import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// `_shared/` vive fuera de la raiz de la app y no tiene node_modules propio, asi
// que sus .jsx no pueden resolver `react` por si mismos: dedupe fuerza a que
// `react`/`react-dom` salgan SIEMPRE del node_modules de esta app, y fs.allow
// deja que el dev server sirva ficheros de ese directorio hermano.
const SHARED = path.resolve(__dirname, '..', '_shared');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3010,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    fs: { allow: ['..', SHARED] },
  },
  build: {
    rollupOptions: {
      output: {
        // Las librerías pesadas casi no cambian entre despliegues: en chunks propios el navegador las
        // mantiene en caché y cada release solo descarga el código de la app.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](ethers|@noble[\\/](curves|hashes)|@adraffy)[\\/]/.test(id)) return 'vendor-ethers';
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'vendor-motion';
          return undefined;
        },
      },
    },
  },
  resolve: {
    // lucide-react: lo importa _shared/ai-chat (el chat de la plataforma) y _shared no tiene node_modules propio.
    dedupe: ['react', 'react-dom', 'lucide-react'],
    alias: {
      '@': '/src',
    },
  },
});
