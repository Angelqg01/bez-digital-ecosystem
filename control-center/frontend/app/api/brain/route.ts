import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

// Proxy de sólo lectura hacia el Brain (obsidian-mcp) para la pestaña Brain
// Live. El navegador nunca habla con el Brain: la clave (BRAIN_API_KEY) y el
// ID token de Cloud Run se quedan en el servidor, y sólo entra un SuperAdmin.
//
// BRAIN_URL es una variable de SERVIDOR (no NEXT_PUBLIC_): la URL privada del
// servicio no se incrusta en el JavaScript público.
const BRAIN_URL = (process.env.BRAIN_URL
  || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4007')).replace(/\/+$/, '');

const VIEWS: Record<string, (req: NextRequest) => string> = {
  summary: (req) => {
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 10, 1), 50);
    return `/telemetry/summary?limit=${limit}`;
  },
  health: () => '/health',
};

let idTokenCache: { audience: string; token: string; exp: number } | null = null;

// En Cloud Run el Brain va con --no-allow-unauthenticated: hace falta un ID
// token con su URL como audience. Lo da el servidor de metadatos de la propia
// instancia; fuera de GCP (local, docker compose) no aplica.
async function idTokenHeader(): Promise<Record<string, string>> {
  let origin: URL;
  try { origin = new URL(BRAIN_URL); } catch { return {}; }
  if (origin.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(origin.hostname)) return {};
  const audience = origin.origin;
  if (idTokenCache && idTokenCache.audience === audience && idTokenCache.exp > Date.now()) {
    return { 'x-serverless-authorization': `Bearer ${idTokenCache.token}` };
  }
  try {
    const res = await fetch(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
      { headers: { 'Metadata-Flavor': 'Google' }, cache: 'no-store', signal: AbortSignal.timeout(2000) },
    );
    if (!res.ok) return {};
    const token = (await res.text()).trim();
    if (!token) return {};
    idTokenCache = { audience, token, exp: Date.now() + 45 * 60 * 1000 };
    return { 'x-serverless-authorization': `Bearer ${token}` };
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  if (!BRAIN_URL) {
    return NextResponse.json({ status: 'unconfigured', error: 'BRAIN_URL no está definida en este despliegue' }, { status: 503 });
  }
  const view = req.nextUrl.searchParams.get('view') || 'summary';
  const build = VIEWS[view];
  if (!build) return NextResponse.json({ error: 'Vista desconocida' }, { status: 400 });

  try {
    const key = process.env.BRAIN_API_KEY || '';
    const res = await fetch(`${BRAIN_URL}${build(req)}`, {
      headers: { ...(key ? { 'x-brain-key': key } : {}), ...(await idTokenHeader()) },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return NextResponse.json({ status: 'offline', error: `El Brain respondió ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    if (view === 'health') {
      // Sólo lo que pinta la pestaña: ni rutas del contenedor ni el host de Ollama.
      return NextResponse.json({
        status: data.status,
        notes: data.notes ?? null,
        semantic: { reachable: Boolean(data.semantic?.reachable), cached: data.semantic?.cached ?? 0 },
        uptime: data.uptime ?? null,
      });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'offline', error: 'El Brain no responde' }, { status: 502 });
  }
}
