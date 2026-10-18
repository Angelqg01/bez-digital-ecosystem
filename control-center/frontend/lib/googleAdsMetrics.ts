/**
 * lib/googleAdsMetrics.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lee el rendimiento de las campañas de Google Ads (últimos 30 días) con la
 * API REST de Google Ads. Sólo se ejecuta en el servidor: las credenciales
 * nunca llegan al navegador.
 *
 * Variables de entorno necesarias (sin ellas el resultado es `configured: false`):
 *   GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
 *   GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID
 *   (opcional) GOOGLE_ADS_LOGIN_CUSTOMER_ID, si se accede a través de un MCC.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ADS_API_VERSION = 'v20';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ADS_BASE = `https://googleads.googleapis.com/${ADS_API_VERSION}`;

const REQUIRED_ENV = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_CUSTOMER_ID',
] as const;

export interface AdsSummary {
    configured: boolean;
    missing?: string[];
    window?: 'LAST_30_DAYS';
    impressions?: number;
    clicks?: number;
    costEur?: number;
    conversions?: number;
    ctrPct?: number | null;
    cpcEur?: number | null;
    error?: string;
}

type FetchLike = typeof fetch;

/** Lista las variables que faltan. Vacía = configuración completa. */
export function missingAdsEnv(env: NodeJS.ProcessEnv = process.env): string[] {
    return REQUIRED_ENV.filter((k) => !env[k]?.trim());
}

/** Quita guiones y espacios del ID de cliente (se muestra como 123-456-7890). */
export function normalizeCustomerId(raw: string): string {
    return raw.replace(/[^0-9]/g, '');
}

/**
 * Agrega las filas de `googleAds:searchStream`. La API devuelve un array de
 * lotes, cada uno con `results`; las métricas int64 llegan como string.
 */
export function aggregateSearchStream(batches: unknown): Omit<AdsSummary, 'configured'> {
    let impressions = 0;
    let clicks = 0;
    let costMicros = 0;
    let conversions = 0;

    for (const batch of Array.isArray(batches) ? batches : []) {
        for (const row of (batch as { results?: unknown[] })?.results ?? []) {
            const m = (row as { metrics?: Record<string, unknown> })?.metrics ?? {};
            impressions += Number(m.impressions ?? 0);
            clicks += Number(m.clicks ?? 0);
            costMicros += Number(m.costMicros ?? 0);
            conversions += Number(m.conversions ?? 0);
        }
    }

    const costEur = costMicros / 1_000_000;
    return {
        window: 'LAST_30_DAYS',
        impressions,
        clicks,
        costEur: Math.round(costEur * 100) / 100,
        conversions: Math.round(conversions * 100) / 100,
        ctrPct: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : null,
        cpcEur: clicks > 0 ? Math.round((costEur / clicks) * 100) / 100 : null,
    };
}

async function accessToken(env: NodeJS.ProcessEnv, doFetch: FetchLike): Promise<string> {
    const body = new URLSearchParams({
        client_id: env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: env.GOOGLE_ADS_CLIENT_SECRET!,
        refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
    });
    const res = await doFetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.access_token) throw new Error(`OAuth de Google Ads rechazado (HTTP ${res.status})`);
    return data.access_token as string;
}

const GAQL =
    'SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
    'FROM customer WHERE segments.date DURING LAST_30_DAYS';

/** Devuelve el resumen de 30 días, o `configured: false` si faltan credenciales. Nunca lanza. */
export async function fetchAdsSummary(
    env: NodeJS.ProcessEnv = process.env,
    doFetch: FetchLike = fetch,
): Promise<AdsSummary> {
    const missing = missingAdsEnv(env);
    if (missing.length) return { configured: false, missing };

    try {
        const token = await accessToken(env, doFetch);
        const customerId = normalizeCustomerId(env.GOOGLE_ADS_CUSTOMER_ID!);
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN!,
            'Content-Type': 'application/json',
        };
        const login = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID && normalizeCustomerId(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
        if (login) headers['login-customer-id'] = login;

        const res = await doFetch(`${ADS_BASE}/customers/${customerId}/googleAds:searchStream`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: GAQL }),
            cache: 'no-store',
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
            return { configured: true, error: `Google Ads respondió HTTP ${res.status}` };
        }
        const data = await res.json();
        return { configured: true, ...aggregateSearchStream(data) };
    } catch (err) {
        return { configured: true, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
}
