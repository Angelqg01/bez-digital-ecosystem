import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Same-origin proxy for the War Room monitor data.
 *
 * The browser calls THIS route (same host/port it's already loaded from),
 * never the Express API directly. That sidesteps CORS entirely — no origin
 * regex needs to know about the Raspberry Pi's LAN IP, hostname, or
 * whatever else a kiosk display gets pointed at.
 *
 * It also keeps MONITOR_ACCESS_TOKEN server-side only: the token lives in
 * this process's env, never in a URL or a value the browser can read.
 */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const MONITOR_ACCESS_TOKEN = process.env.MONITOR_ACCESS_TOKEN || null;

export async function GET() {
  try {
    const headers: Record<string, string> = {};
    if (MONITOR_ACCESS_TOKEN) headers['x-monitor-token'] = MONITOR_ACCESS_TOKEN;

    const res = await fetch(`${API_INTERNAL_URL}/monitor/overview`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Backend respondió ${res.status}` }, { status: 502 });
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'API no disponible' },
      { status: 502 }
    );
  }
}
