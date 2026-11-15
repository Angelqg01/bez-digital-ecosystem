#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
    console.log(`Usage: node scripts/security/scan-secrets.cjs [--json]

Scans the repository for high-risk secrets committed in plain text.
Exits with code 1 when findings are detected in files Git tracks or would track.
Findings in git-ignored local files (.env, .env.amoy...) are reported as "locales"
and never fail the scan: they are not in the repository, but they are real keys on
this disk and must be rotated if they ever leaked.`);
    process.exit(0);
}

const EXCLUDED_DIRS = new Set([
    '.git',
    '.claude', // worktrees de agentes: copias del repo, no contenido propio
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
    // Claves públicas de desarrollo de Hardhat/Anvil (cuentas 0, 1 y 2): conocidas por todos, sin fondos reales.
    if (['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'].includes(lower)) return true;
    // No es un secreto: una ruta, una expansión de shell o la llamada a una función que lo resuelve.
    if (lower.startsWith('~') || lower.startsWith('/') || lower.includes('$')) return true;
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
                // `JWT_SECRET = resolveChatJwtSecret();` captura el nombre de la función, no un valor.
                if (match[1] && line[match.index + match[0].length] === '(') continue;
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

// Un hallazgo en un fichero ignorado por git no está en el repositorio: se separa de los versionables.
function ignorados(ficheros) {
    if (!ficheros.length) return new Set();
    const r = spawnSync('git', ['check-ignore', '--stdin', '-z'], { cwd: root, input: ficheros.join('\0'), encoding: 'utf8' });
    return new Set((r.stdout || '').split('\0').filter(Boolean));
}
const sinVersionar = ignorados([...new Set(findings.map((f) => f.file))]);
const versionables = findings.filter((f) => !sinVersionar.has(f.file));
const locales = findings.filter((f) => sinVersionar.has(f.file));

if (args.has('--json')) {
    console.log(JSON.stringify({ findings: versionables, locales }, null, 2));
} else {
    if (versionables.length) {
        console.error(`Secret scan found ${versionables.length} potential issue(s):`);
        for (const finding of versionables.slice(0, 50)) {
            console.error(`- ${finding.file}:${finding.line} ${finding.type} ${finding.value}`);
        }
        if (versionables.length > 50) console.error(`...and ${versionables.length - 50} more`);
    }
    if (locales.length) {
        console.error(`\nAVISO: ${locales.length} credencial(es) en ficheros locales ignorados por git (no fallan el escaneo; rotar si se filtraron):`);
        for (const finding of locales.slice(0, 50)) console.error(`- ${finding.file}:${finding.line} ${finding.type} ${finding.value}`);
    }
}

process.exit(versionables.length ? 1 : 0);
