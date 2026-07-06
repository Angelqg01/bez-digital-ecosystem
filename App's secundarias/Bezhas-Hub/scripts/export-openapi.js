#!/usr/bin/env node

/**
 * export-openapi.js
 * -----------------
 * Exports the live OpenAPI/Swagger spec from backend/swagger.config.js
 * to a static JSON file at docs/openapi.json for consumption by SubApps and devs.
 *
 * Usage:  node scripts/export-openapi.js
 *         pnpm export:openapi          (from root)
 *
 * Must be run from the Bezhas-Hub root (or backend/) so that swagger-jsdoc
 * can resolve the route glob patterns declared in swagger.config.js.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '..', 'backend');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'openapi.json');

// Change CWD to backend/ so swagger-jsdoc resolves ./routes/*.routes.js globs correctly
const originalCwd = process.cwd();
process.chdir(BACKEND_DIR);

let spec;
try {
    spec = require(path.join(BACKEND_DIR, 'swagger.config'));
} catch (err) {
    console.error('❌ Failed to load swagger.config.js:', err.message);
    console.error('   Tip: run `pnpm install` inside backend/ first.');
    process.exit(1);
} finally {
    process.chdir(originalCwd);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Write the spec
const json = JSON.stringify(spec, null, 2);
fs.writeFileSync(OUTPUT_FILE, json, 'utf8');

const pathCount = spec.paths ? Object.keys(spec.paths).length : 0;
console.log(`✅ OpenAPI spec exported to ${path.relative(path.resolve(__dirname, '..'), OUTPUT_FILE)}`);
console.log(`   Version: ${spec.info?.version || '?'}  |  Paths: ${pathCount}`);
