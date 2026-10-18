import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { fetchAdsSummary } from '@/lib/googleAdsMetrics';

export const dynamic = 'force-dynamic';

// Métricas de Google Ads para la pestaña Publicidad del panel SuperAdmin.
// Sin credenciales devuelve { configured: false, missing: [...] } y no llama a Google.
export async function GET() {
    const denied = await requireSuperAdmin();
    if (denied) return denied;

    const summary = await fetchAdsSummary();
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
}
