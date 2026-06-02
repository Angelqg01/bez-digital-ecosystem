/**
 * Demo User Store — In-memory storage for the investor demo.
 *
 * Uses Node.js built-in `crypto.scrypt` for password hashing (no external deps).
 * Users registered here persist while the server process is running.
 * In production, this would be replaced by PostgreSQL + bcrypt.
 */

import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

export interface DemoUser {
    id: number;
    username: string;
    email: string;
    passwordHash: string;   // format: "salt:hash"
    role: string;
    avatar_url: string | null;
    createdAt: Date;
}

// ── Password utilities ───────────────────────────────────────────────────

/** Hash a plaintext password using scrypt + random salt */
export function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/** Verify a plaintext password against a stored "salt:hash" string */
export function verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    const derivedKey = scryptSync(password, salt, 64);
    const storedKey = Buffer.from(hash, 'hex');
    return timingSafeEqual(derivedKey, storedKey);
}

// ── In-memory user store ─────────────────────────────────────────────────

const users = new Map<string, DemoUser>();
let nextId = 100;

// Pre-seed a demo account so investors can try immediately
// Login: demo@bez.digital / demo1234
const seedHash = hashPassword('demo1234');
users.set('demo@bez.digital', {
    id: 1,
    username: 'Demo Investor',
    email: 'demo@bez.digital',
    passwordHash: seedHash,
    role: 'INVESTOR',
    avatar_url: null,
    createdAt: new Date(),
});

export function findUserByEmail(email: string): DemoUser | undefined {
    return users.get(email.toLowerCase().trim());
}

export function createUser(username: string, email: string, password: string): DemoUser {
    const normalizedEmail = email.toLowerCase().trim();
    const user: DemoUser = {
        id: nextId++,
        username: username.trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        role: 'RETAIL',
        avatar_url: null,
        createdAt: new Date(),
    };
    users.set(normalizedEmail, user);
    return user;
}

export function userExists(email: string): boolean {
    return users.has(email.toLowerCase().trim());
}
