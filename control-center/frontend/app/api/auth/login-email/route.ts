import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findUserByEmail, verifyPassword } from '@/lib/demo-users';

import { JWT_SECRET, JWT_ACCESS_TTL, JWT_ACCESS_TTL_SECONDS } from '@/lib/auth-secrets';

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        // ── Validation ───────────────────────────────────────────────────
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email y contraseña son obligatorios.' },
                { status: 400 },
            );
        }

        // ── Find user ────────────────────────────────────────────────────
        const user = findUserByEmail(email);

        if (!user) {
            return NextResponse.json(
                { error: 'Credenciales inválidas.' },
                { status: 401 },
            );
        }

        // ── Verify password ──────────────────────────────────────────────
        const isValid = verifyPassword(password, user.passwordHash);

        if (!isValid) {
            return NextResponse.json(
                { error: 'Credenciales inválidas.' },
                { status: 401 },
            );
        }

        // ── JWT ──────────────────────────────────────────────────────────
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_ACCESS_TTL, issuer: 'bezhas-control-center' },
        );

        const userPayload = {
            id: user.id,
            wallet_address: null,
            username: user.username,
            email: user.email,
            role: user.role,
            avatar_url: null,
        };

        const response = NextResponse.json({ success: true, token, user: userPayload });

        response.cookies.set('bezhas_auth', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: JWT_ACCESS_TTL_SECONDS,
        });

        response.cookies.set('bezhas_token', token, {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: JWT_ACCESS_TTL_SECONDS,
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor.' },
            { status: 500 },
        );
    }
}
