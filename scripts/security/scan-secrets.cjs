#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
    console.log(`Usage: node scripts/security/scan-secrets.cjs [--json]

Scans the repository for high-risk secrets committed in plain text.
Exits with code 1 when findings are detected.`);
    process.exit(0);
}

const EXCLUDED_DIRS = new Set([
    '.git',
    '.next',
    '.osmium',
    '.pytest_cache',
    '.turbo',
    '.venv',
    '__pycache__',
    'artifacts',
    'artifacts-admin',
    'backup_docs_20260114_071707',
    'broadcast',
    'cache',
    'deployed-backend',
    'venv',
    'node_modules',
    'coverage',
    'dist',
    'build',
    'logs',
    'mnt',
    'out',
    'pg-data',
    'geth-data',
    'smart-contracts.worktrees',
    'target',
    'tmp',
    'vendor'
]);

const EXCLUDED_FILES = new Set([
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock'
]);

const ALLOWED_SUFFIXES = new Set([
    '.cjs',
    '.env',
    '.example',
    '.js',
    '.json',
    '.jsx',
    '.md',
    '.mjs',
    '.ps1',
    '.py',
    '.sh',
    '.ts',
    '.tsx',
    '.txt',
    '.yaml',
    '.yml'
]);

const REDACT = value => {
    if (!value || value.length <= 12) return '<redacted>';
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const PATTERNS = [
    {
        name: 'private-key-block',
        regex: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/i
    },
    {
        name: 'openai-api-key',
        regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g
    },
    {
        name: 'jwt-like-secret-assignment',
        // Los paréntesis quedan fuera del valor capturado a propósito. Ningún
        // formato de secreto real los usa —hex, base64 y JWT se limitan a
        // [A-Za-z0-9+/=._-]—, mientras que el código sí: esta regla marcaba como
        // secreto el SQL de api/services/cargoLinkPosConnector.js
        //
        //     api_key = COALESCE(EXCLUDED.api_key, cargolink_pos_links.api_key)
        //
        // capturando "COALESCE(EXCLUDED.api_key," como si fuera una credencial.
        // Al excluir `(` y `)` el candidato se queda en "COALESCE", 8 caracteres,
        // por debajo del mínimo de 16, y deja de saltar. La detección de secretos
        // de verdad no se ve afectada.
        regex: /\b(?:JWT_SECRET|ADMIN_TOKEN|INTERNAL_API_KEY|API_KEY|WEBHOOK_SECRET|TELEGRAM_WEBHOOK_SECRET)\s*[:=]\s*['"]?([^'"\s#()]{16,})/gi
    },
    {
        name: 'wallet-private-key',
        regex: /\b(?:PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|BATCHER_PRIVATE_KEY|EDGE_NODE_PRIVATE_KEY|WALLET_PRIVATE_KEY)\b\s*[:=]\s*['"]?(0x[a-fA-F0-9]{64})/gi
    },
    {
        name: 'aws-access-key',
        regex: /\bAKIA[0-9A-Z]{16}\b/g
    },
    {
        name: 'github-token',
        regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g
    }
];

const PLACEHOLDER_HINTS = [
    'abcdef',
    'aqui',
    'cambia',
    'change',
    'configure_in_secret_manager',
    'example',
    'os.getenv',
    'placeholder',
    'process.argv',
    'process.env',
    'random',
    'redacted',
    'seguro',
    'test',
    'this_is_a',
    'tu_',
    'tu-',
    'your_',
    'your-',
    'xxxx',
    'z.string',
    '<',
    '${'
];

function shouldSkipFile(filePath) {
    const base = path.basename(filePath);
    if (EXCLUDED_FILES.has(base)) return true;
    if (base === 'scan-secrets.cjs') return true;

    // Test/fixture/mock files legitimately contain dummy credentials.
    const norm = filePath.replace(/\\/g, '/');
    if (/(?:^|\/)(?:__tests__|__mocks__|tests?)\//i.test(norm)) return true;
    if (/\.(?:test|spec|e2e|mock|stories)\.[a-z]+$/i.test(base)) return true;

    const ext = path.extname(filePath).toLowerCase();
    if (base.includes('.env')) return false;
    if (base.endsWith('.example')) return false;
    return !ALLOWED_SUFFIXES.has(ext);
}

function isPlaceholder(value) {
    const lower = value.toLowerCase();
    if (/^0x0+$/.test(lower)) return true;
    if (/^0x0{63}[12]$/.test(lower)) return true;
    if (lower === '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') return true;
    return PLACEHOLDER_HINTS.some(hint => lower.includes(hint));
}

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) continue;
            yield* walk(path.join(dir, entry.name));
        } else if (entry.isFile()) {
            const filePath = path.join(dir, entry.name);
            if (!shouldSkipFile(filePath)) yield filePath;
        }
    }
}

const findings = [];

scan:
for (const filePath of walk(root)) {
    let text;
    try {
        const stat = fs.statSync(filePath);
        if (stat.size > 1024 * 1024) continue;
        text = fs.readFileSync(filePath, 'utf8');
    } catch {
        continue;
    }

    const lines = text.split(/\r?\n/);
    for (const pattern of PATTERNS) {
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
            const line = lines[lineIndex];
            pattern.regex.lastIndex = 0;
            let match;
            while ((match = pattern.regex.exec(line)) !== null) {
                const value = match[1] || match[0];
                if (isPlaceholder(value)) continue;
                findings.push({
                    file: path.relative(root, filePath),
                    line: lineIndex + 1,
                    type: pattern.name,
                    value: REDACT(value)
                });
                if (findings.length >= 200) break scan;
            }
        }
    }
}

if (args.has('--json')) {
    console.log(JSON.stringify({ findings }, null, 2));
} else if (findings.length) {
    console.error(`Secret scan found ${findings.length} potential issue(s):`);
    for (const finding of findings.slice(0, 50)) {
        console.error(`- ${finding.file}:${finding.line} ${finding.type} ${finding.value}`);
    }
    if (findings.length > 50) {
        console.error(`...and ${findings.length - 50} more`);
    }
}

process.exit(findings.length ? 1 : 0);
