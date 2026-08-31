import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// `_shared/` vive fuera de la raiz de la app y no tiene node_modules propio, asi
// que sus .jsx no pueden resolver `react` por si mismos: dedupe fuerza a que
// `react`/`react-dom` salgan SIEMPRE del node_modules de esta app, y fs.allow
// deja que el dev server sirva ficheros de ese directorio hermano.
const SHARED = path.resolve(__dirname, '..', '_shared')

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3020,
    fs: { allow: ['..', SHARED] },
  },
})
