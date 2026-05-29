#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoreDirs = new Set(['node_modules', '.git', 'coverage', 'dist', 'build', '.next', 'uploads']);
const riskyExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.yaml', '.yml', '.env', '.example']);
const patterns = [
    { name: 'Private key', regex: /\b0x[a-fA-F0-9]{64}\b/ },
    { name: 'Stripe secret', regex: /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/ },
    { name: 'Webhook secret', regex: /\bwhsec_[A-Za-z0-9_]{16,}\b/ },
    { name: 'BeZhas generated API key', regex: /\bbzh_(3p|cli)_[A-Za-z0-9_]{16,}\b/ },
    { name: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{20,}\b/ }
];

const findings = [];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ignoreDirs.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full);
            continue;
        }

        const ext = path.extname(entry.name);
        if (!riskyExtensions.has(ext) && !entry.name.startsWith('.env')) continue;

        let text = '';
        try {
            text = fs.readFileSync(full, 'utf8');
        } catch {
            continue;
        }

        for (const pattern of patterns) {
            if (pattern.regex.test(text)) {
                findings.push({ file: path.relative(root, full), type: pattern.name });
            }
        }
    }
}

walk(root);

if (findings.length) {
    console.error('Potential secrets found. Rotate anything real before deploying:');
    for (const finding of findings) {
        console.error(`- ${finding.type}: ${finding.file}`);
    }
    process.exit(1);
}

console.log('No obvious secrets found by scan-secrets.js');
