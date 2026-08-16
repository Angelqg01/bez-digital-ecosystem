/**
 * PermissionEngine.js — RBAC + sector-scoped policy checker.
 * Uses policies.json for role definitions and tool overrides.
 * Integrates with existing security.js JWT/role middleware.
 */
const fs = require('fs');
const path = require('path');

const POLICIES_PATH = path.join(__dirname, '..', 'permissions', 'policies.json');

class PermissionEngine {
    #policies = null;

    constructor(policiesPath = POLICIES_PATH) {
        this.#loadPolicies(policiesPath);
    }

    #loadPolicies(policiesPath) {
        try {
            const raw = fs.readFileSync(policiesPath, 'utf-8');
            this.#policies = JSON.parse(raw);
        } catch {
            // Fallback: permissive in dev, restrictive otherwise
            this.#policies = {
                version: 1,
                roles: {
                    admin: { allow: ['*'], deny: [] },
                    viewer: { allow: ['runtime:read'], deny: [] },
                },
                toolOverrides: {},
            };
        }
    }

    /**
     * Check if a user with the given role can use permissions required by a tool.
     * @param {string} userRole      — e.g. "operator"
     * @param {string[]} required    — e.g. ["runtime:read", "bridge:status"]
     * @param {string|null} [sector] — target sector for sector-scoped roles
     * @returns {{ allowed: boolean, denied: string[] }}
     */
    check(userRole, required, sector = null) {
        const roleDef = this.#policies.roles[userRole];
        if (!roleDef) {
            return { allowed: false, denied: required, reason: `Unknown role: ${userRole}` };
        }

        const denied = [];

        for (const perm of required) {
            if (!this.#isAllowed(perm, roleDef, sector)) {
                denied.push(perm);
            }
        }

        return { allowed: denied.length === 0, denied: denied.length > 0 ? denied : undefined };
    }

    /**
     * Check tool-level overrides (min role, rate limit flag, audit flag).
     * @param {string} toolName
     * @returns {object|null}
     */
    getToolOverride(toolName) {
        return this.#policies.toolOverrides?.[toolName] || null;
    }

    /**
     * @private
     */
    #isAllowed(perm, roleDef, sector) {
        // Check explicit deny first
        if (this.#matchesAny(perm, roleDef.deny || [])) {
            return false;
        }

        // Check allow patterns
        if (this.#matchesAny(perm, roleDef.allow || [])) {
            return true;
        }

        // Check sector-scoped permissions
        if (roleDef.sectorScoped && sector && roleDef.sectorPermissions) {
            const expanded = roleDef.sectorPermissions.map(p => p.replace('{sector}', sector));
            if (this.#matchesAny(perm, expanded)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a permission matches any pattern in the list.
     * Supports wildcards: "*" matches everything, "deploy:*" matches "deploy:verify".
     * @private
     */
    #matchesAny(perm, patterns) {
        for (const pattern of patterns) {
            if (pattern === '*') return true;
            if (pattern === perm) return true;
            // Trailing wildcard: "deploy:*" matches "deploy:verify"
            if (pattern.endsWith(':*')) {
                const prefix = pattern.slice(0, -1); // "deploy:" from "deploy:*"
                if (perm.startsWith(prefix)) return true;
            }
            // Middle wildcard: "mcp:*:invoke" matches "mcp:analyze_gas:invoke"
            if (pattern.includes(':*:')) {
                const [head, , tail] = pattern.split(':');
                const parts = perm.split(':');
                if (parts.length >= 3 && parts[0] === head && parts[parts.length - 1] === tail) return true;
            }
        }
        return false;
    }

    // ── Rate Limiting (per-tool, in-memory) ──────────────────

    /** @type {Map<string, { count: number, windowStart: number }>} */
    #rateBuckets = new Map();

    /**
     * Check and consume a rate-limit token for a tool invocation.
     * Returns { allowed: true } or { allowed: false, retryAfter: <seconds> }.
     * @param {string} toolName
     * @param {string} userKey  — unique identifier (wallet address or session id)
     * @returns {{ allowed: boolean, retryAfter?: number }}
     */
    checkRateLimit(toolName, userKey) {
        const override = this.getToolOverride(toolName);
        if (!override?.maxRatePerMinute) return { allowed: true };

        const limit = override.maxRatePerMinute;
        const key = `${toolName}:${userKey}`;
        const now = Date.now();
        const windowMs = 60_000;

        let bucket = this.#rateBuckets.get(key);
        if (!bucket || (now - bucket.windowStart) >= windowMs) {
            bucket = { count: 0, windowStart: now };
            this.#rateBuckets.set(key, bucket);
        }

        if (bucket.count >= limit) {
            const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
            return { allowed: false, retryAfter };
        }

        bucket.count++;
        return { allowed: true };
    }

    /** Reload policies from disk (e.g. after plugin update). */
    reload(policiesPath = POLICIES_PATH) {
        this.#loadPolicies(policiesPath);
    }

    /** Clear all rate limit buckets (for testing). */
    resetRateLimits() {
        this.#rateBuckets.clear();
    }
}

module.exports = PermissionEngine;
