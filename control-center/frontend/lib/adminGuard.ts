import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Guarda de sesión SuperAdmin para las route handlers de Next.
 *
 * Hacía falta porque proxy.ts sólo casa `/admin/:path*`, no `/api/admin/...`:
 * las rutas de servidor bajo /api quedaban fuera del matcher y se podían
 * llamar sin sesión ninguna. En el caso de /api/admin/watchdog eso significaba
 * poder ejecutar `gcloud run services update --max-instances=0` —apagar
 * servicios de producción— con un curl sin autenticar.
 *
 * No verifica el JWT aquí a propósito: JWT_SECRET vive en el proceso de la API
 * y no debe duplicarse en el del frontend. Se delega en /api/admin-auth/verify,
 * que es el único sitio que conoce el secreto y el issuer.
 *
 * Ojo: la cookie `bezhas_admin_session` que pone el login por JS NO sirve como
 * prueba — es legible y escribible desde el navegador (`document.cookie = ...`).
 * La única credencial real es `bezhas_admin_token`, HttpOnly.
 */
const API_INTERNAL_URL =
    process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function isSuperAdmin(): Promise<boolean> {
    const token = (await cookies()).get('bezhas_admin_token')?.value;
    if (!token) return false;

    try {
        const res = await fetch(`${API_INTERNAL_URL}/admin-auth/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        return data?.valid === true && data?.role === 'SUPER_ADMIN';
    } catch {
        // API caída = no se puede probar la sesión = no se pasa.
        return false;
    }
}

/** Devuelve un 401 listo para `return` si no hay sesión; null si la hay. */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
    if (await isSuperAdmin()) return null;
    return NextResponse.json(
        { status: 'error', error: 'Sesión SuperAdmin requerida', code: 'ADMIN_AUTH_REQUIRED' },
        { status: 401 },
    );
}
