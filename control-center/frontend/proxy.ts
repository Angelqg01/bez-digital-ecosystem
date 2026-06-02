import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ADMIN_ROUTES = new Set(['/admin/login', '/admin/recover']);

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (PUBLIC_ADMIN_ROUTES.has(pathname)) {
        return NextResponse.next();
    }

    if (pathname.startsWith('/admin')) {
        const adminSession = request.cookies.get('bezhas_admin_session')?.value;
        if (!adminSession) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
        return NextResponse.next();
    }

    if (pathname.startsWith('/client-dashboard')) {
        const userToken = request.cookies.get('bezhas_token')?.value;
        if (!userToken) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
    }

    if (pathname.startsWith('/dashboard')) {
        const userToken = request.cookies.get('bezhas_token')?.value;
        const adminSession = request.cookies.get('bezhas_admin_session')?.value;
        if (!userToken && !adminSession) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/admin/:path*', '/client-dashboard/:path*'],
};
