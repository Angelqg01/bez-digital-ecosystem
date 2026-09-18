/**
 * BeZhas Watchdog — superficie pública
 */
export {
    auditLog,
    AuditLog,
    normalizeIp,
    subjectFromApiKey,
    subjectFromRequest,
    subjectId,
    type AuditEntry,
    type Verdict,
} from './auditLog.js';
export { guardian, Guardian, WatchdogError, type Decision, type GuardContext } from './guardian.js';
export { hardenServer, type HardenOptions } from './harden.js';
export {
    FORBIDDEN_ENV_KEYS,
    INJECTION_PATTERNS,
    SECRET_PATTERNS,
    SEVERITY_RANK,
    type Pattern,
    type Severity,
} from './patterns.js';
export { extractAmountUSD, policy, riskOf, TOOL_RISK, type RiskTier } from './policy.js';
export { rateLimiter, RateLimiter } from './rateLimiter.js';
export { redact, scan, type Finding, type ScanResult } from './scanner.js';
export { GLOBAL_LIMIT_PER_MINUTE, watchdogLimiter, type ThrottleOptions } from './throttle.js';
