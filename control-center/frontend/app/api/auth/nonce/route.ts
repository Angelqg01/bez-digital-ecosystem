import { NextResponse } from 'next/server';

// Simple nonce generator (en producción, usar almacenamiento persistente)
let lastNonce = 0;
function generateNonce() {
    // Nonce incremental simple (mejor usar UUID o crypto.randomUUID en prod)
    lastNonce += 1;
    return `${Date.now()}-${lastNonce}`;
}

export async function GET() {
    // Genera un nonce único para el usuario
    const nonce = generateNonce();
    return NextResponse.json({ nonce });
}

/**
 * Seguridad: El nonce previene ataques de repetición (replay attacks).
 * En producción, deberías asociar el nonce a la sesión del usuario y marcarlo como usado tras la firma.
 */
