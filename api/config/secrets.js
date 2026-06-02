/**
 * Centralized secrets configuration.
 * All modules MUST import JWT_SECRET from here — never read it independently.
 * Crashes on startup if required secrets are missing in production.
 */
const DEV_MODE = process.env.NODE_ENV !== 'production';

const JWT_SECRET = process.env.JWT_SECRET || (DEV_MODE ? 'dev-only-secret' : null);
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production. Set it before starting the server.');
}

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || (DEV_MODE ? 'dev-internal-key' : null);
if (!INTERNAL_API_KEY) {
    throw new Error('FATAL: INTERNAL_API_KEY environment variable is required in production.');
}

module.exports = { JWT_SECRET, INTERNAL_API_KEY, DEV_MODE };
