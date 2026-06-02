/**
 * Centralized secrets configuration.
 * All modules MUST import JWT_SECRET from here — never read it independently.
 * Crashes on startup if required secrets are missing in production.
 */

// Production is determined ONLY by an explicit NODE_ENV === 'production'.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// DEV_MODE governs non-security developer conveniences (verbose logs, default
// secrets in dev). It must NEVER, by itself, disable authentication.
const DEV_MODE = !IS_PRODUCTION;

// ── Auth bypass: OFF by default, opt-in only, impossible in production ──
// Security-critical: the auth bypass (inject a dev admin user) requires an
// EXPLICIT opt-in via AUTH_BYPASS=true AND a non-production NODE_ENV. Because it
// is gated on an affirmative flag rather than the *absence* of NODE_ENV, a
// missing/misconfigured NODE_ENV can no longer silently disable auth.
const AUTH_BYPASS = !IS_PRODUCTION && process.env.AUTH_BYPASS === 'true';

const JWT_SECRET = process.env.JWT_SECRET || (DEV_MODE ? 'dev-only-secret' : null);
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production. Set it before starting the server.');
}

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || (DEV_MODE ? 'dev-internal-key' : null);
if (!INTERNAL_API_KEY) {
    throw new Error('FATAL: INTERNAL_API_KEY environment variable is required in production.');
}

// Defense in depth: refuse to boot in production with well-known dev secrets.
if (IS_PRODUCTION && (JWT_SECRET === 'dev-only-secret' || INTERNAL_API_KEY === 'dev-internal-key')) {
    throw new Error('FATAL: refusing to start in production with development secrets. Set strong JWT_SECRET and INTERNAL_API_KEY.');
}

// Loud, unmissable warning when auth is bypassed.
if (AUTH_BYPASS) {
    // eslint-disable-next-line no-console
    console.warn('[41m[37m  AUTH_BYPASS ENABLED — all requests run as an admin dev user. NEVER use in production.  [0m');
}

module.exports = { JWT_SECRET, INTERNAL_API_KEY, DEV_MODE, IS_PRODUCTION, AUTH_BYPASS };
