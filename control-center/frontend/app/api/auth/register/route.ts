import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createUser, userExists } from '@/lib/demo-users';

import { JWT_SECRET, JWT_ACCESS_TTL, JWT_ACCESS_TTL_SECONDS } from '@/lib/auth-secrets';

export async function POST(req: Request) {
    try {
        const { username, email, password } = await req.json();

        // ── Validation ───────────────────────────────────────────────────
        if (!username || !email || !password) {
            return NextResponse.json(
                { error: 'Todos los campos son obligatorios.' },
                { status: 400 },
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 6 caracteres.' },
                { status: 400 },
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'El email no es válido.' },
                { status: 400 },
            );
        }

        if (userExists(email)) {
            return NextResponse.json(
                { error: 'Ya existe una cuenta con este email.' },
                { status: 409 },
            );
        }

        // ── Create user ──────────────────────────────────────────────────
        const newUser = createUser(username, email, password);

        // ── JWT ──────────────────────────────────────────────────────────
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: JWT_ACCESS_TTL, issuer: 'bezhas-control-center' },
        );

        const user = {
            id: newUser.id,
            wallet_address: null,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            avatar_url: null,
        };

        const response = NextResponse.json({ success: true, token, user });

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
        console.error('Register error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor.' },
            { status: 500 },
        );
    }
}
