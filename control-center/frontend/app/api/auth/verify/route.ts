import { NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import jwt from 'jsonwebtoken';

// Simulador de base de datos de roles
const getUserRole = (address: string) => {
    const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();
    if (address.toLowerCase() === ADMIN_WALLET) return 'ADMIN';
    // Aquí consultarías a tu DB o Smart Contract para ver si es RETAIL, WHALE, DEVELOPER, INSTITUTION, etc.
    return 'RETAIL';
};

// Secreto y TTL comunes a todo el ecosistema — ver lib/auth-secrets.ts.
import { JWT_SECRET, JWT_ACCESS_TTL, JWT_ACCESS_TTL_SECONDS } from '@/lib/auth-secrets';

export async function POST(req: Request) {
    const { message, signature, address } = await req.json();

    try {
        // 1. Verificar criptográficamente que la firma pertenece a la dirección
        const valid = await verifyMessage({ address, message, signature });

        if (!valid) {
            return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
        }

        // 2. Asignar el rol
        const role = getUserRole(address);

        // 3. Crear JWT seguro. El TTL es el común del ecosistema: antes eran 1h
        //    aquí y 24h en el login por email, así que la sesión duraba una cosa
        //    u otra según con qué pestaña hubieras entrado.
        const token = jwt.sign({ address, role }, JWT_SECRET, {
            expiresIn: JWT_ACCESS_TTL,
            issuer: 'bezhas-control-center',
        });

        // 4. Enviar JWT en cookie HttpOnly (protegida contra JS y XSS)
        // Nota: NextResponse permite setear cookies seguras
        const user = {
            id: 1,
            wallet_address: address,
            username: address.substring(0, 6) + '...' + address.substring(address.length - 4),
            role: role,
            avatar_url: null
        };
        const response = NextResponse.json({ success: true, role, token, user });
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
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

/**
 * Seguridad: El JWT se entrega como cookie HttpOnly, lo que impide que el frontend acceda al token directamente.
 * Esto protege contra ataques XSS y asegura que solo el backend pueda leer la cookie en requests autenticados.
 * Para endpoints protegidos, deberás leer y verificar la cookie 'bezhas_auth' en el backend.
 */
