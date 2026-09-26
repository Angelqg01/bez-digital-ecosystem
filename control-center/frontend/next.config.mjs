import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ["@bezhas/sdk"],
  poweredByHeader: false,
  // Cabeceras de seguridad en todas las respuestas: sin ellas el panel se
  // podía incrustar en un iframe ajeno (clickjacking) y el navegador adivinaba
  // tipos MIME. HSTS solo en producción (en local se sirve por http).
  async headers() {
    const cabeceras = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];
    if (process.env.NODE_ENV === 'production') {
      cabeceras.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    }
    return [
      { source: '/:path*', headers: cabeceras },
      // Que ninguna caché intermedia retenga el desactivador del service
      // worker antiguo (public/sw.js).
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
  webpack(config) {
    config.resolve.alias["@agents"] = path.resolve(__dirname, "modules/agents-ui");
    return config;
  },
};

export default nextConfig;
