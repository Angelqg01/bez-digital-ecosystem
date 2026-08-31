/**
 * downloads.routes.js
 * Sirve los paquetes SDK y MCP como archivos descargables.
 *
 * Endpoints:
 *   GET /api/downloads/bezhas-sdk.tgz   → BeZhas SDK npm tarball
 *   GET /api/downloads/bezhas-mcp.tgz   → BEZHAS-MCP npm tarball
 *   GET /api/downloads/info              → Info de versiones disponibles
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// ── Rutas de los archivos en el contenedor Docker ────────────────────────────
// Los archivos se copian al imagen durante el build (ver backend/Dockerfile)
// Si no existen en disco, se generan on-the-fly con npm pack.

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR
    || path.join(__dirname, '..', '..', 'sdk', 'dist');

const SDK_PACKAGE_DIR = path.join(__dirname, '..', '..', 'sdk');
const MCP_PACKAGE_DIR = path.join(__dirname, '..', '..', 'packages', 'mcp-server');
const WP_PLUGIN_DIR = path.join(__dirname, '..', '..', 'packages', 'wp-plugin');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Busca el archivo .tgz en el directorio dado
 */
function findTgz(dir) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    return files.find(f => f.endsWith('.tgz')) || null;
}

/**
 * Busca el ZIP del plugin WP con mayor versión (orden semver simple por nombre).
 */
function findZip(dir) {
    if (!fs.existsSync(dir)) return null;
    const zips = fs.readdirSync(dir).filter(f => /^bezhas-hub-.*\.zip$/.test(f));
    return zips.sort().reverse()[0] || null;
}

/**
 * Lee la versión del package.json de un directorio
 */
function readVersion(pkgDir) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
        return pkg.version || '2.0.0';
    } catch {
        return '2.0.0';
    }
}

// ── GET /api/downloads/info ───────────────────────────────────────────────────
router.get('/info', (req, res) => {
    const sdkVersion = readVersion(SDK_PACKAGE_DIR);
    const mcpVersion = readVersion(MCP_PACKAGE_DIR);

    res.json({
        success: true,
        packages: {
            sdk: {
                name: '@bezhas/sdk',
                version: sdkVersion,
                downloadUrl: '/api/downloads/bezhas-sdk.tgz',
                npm: `https://www.npmjs.com/package/@bezhas/sdk`,
                install: {
                    npm: `npm install @bezhas/sdk@${sdkVersion}`,
                    pnpm: `pnpm add @bezhas/sdk@${sdkVersion}`,
                    yarn: `yarn add @bezhas/sdk@${sdkVersion}`,
                },
            },
            mcp: {
                name: '@bezhas/mcp-server',
                version: mcpVersion,
                downloadUrl: '/api/downloads/bezhas-mcp.tgz',
                npm: `https://www.npmjs.com/package/@bezhas/mcp-server`,
                install: {
                    npm: `npm install @bezhas/mcp-server@${mcpVersion}`,
                    pnpm: `pnpm add @bezhas/mcp-server@${mcpVersion}`,
                    yarn: `yarn add @bezhas/mcp-server@${mcpVersion}`,
                },
            },
        },
        alternativeInstall: 'If download fails, install directly from npm registry.',
    });
});

// ── GET /api/downloads/bezhas-sdk.tgz ────────────────────────────────────────
router.get('/bezhas-sdk.tgz', (req, res) => {
    servePackage(req, res, SDK_PACKAGE_DIR, 'bezhas-sdk');
});

// ── GET /api/downloads/bezhas-mcp.tgz ────────────────────────────────────────
router.get('/bezhas-mcp.tgz', (req, res) => {
    servePackage(req, res, MCP_PACKAGE_DIR, 'bezhas-mcp');
});

// ── GET /api/downloads/bezhas-hub-wp.zip ─────────────────────────────────────
router.get('/bezhas-hub-wp.zip', (req, res) => {
    // Sirve el ZIP más reciente del plugin (bezhas-hub-<version>.zip).
    const zipName = (findZip(WP_PLUGIN_DIR) || 'bezhas-hub-2.0.0.zip');
    const zipFile = path.join(WP_PLUGIN_DIR, zipName);
    if (fs.existsSync(zipFile)) {
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        res.setHeader('Content-Type', 'application/zip');
        return res.sendFile(zipFile);
    }
    res.status(404).json({ error: 'WordPress plugin not found. Install from WordPress directory.' });
});

// ── Shared handler ────────────────────────────────────────────────────────────
function servePackage(req, res, pkgDir, filename) {
    // 1. Look for pre-built tgz in dist/ or sdk/ dir
    const tgzInDist = findTgz(path.join(pkgDir, 'dist'));
    const tgzInRoot = findTgz(pkgDir);
    const tgzFile = tgzInDist
        ? path.join(pkgDir, 'dist', tgzInDist)
        : tgzInRoot
            ? path.join(pkgDir, tgzInRoot)
            : null;

    if (tgzFile && fs.existsSync(tgzFile)) {
        const version = readVersion(pkgDir);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}-${version}.tgz"`);
        res.setHeader('Content-Type', 'application/gzip');
        return res.sendFile(tgzFile);
    }

    // 2. No tgz found — redirect to npm registry as fallback
    const version = readVersion(pkgDir);
    const pkgName = filename === 'bezhas-sdk' ? '@bezhas/sdk' : '@bezhas/mcp-server';
    const npmTarball = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/-/${filename}-${version}.tgz`;

    console.log(`[downloads] No tgz found locally, redirecting to: ${npmTarball}`);
    return res.redirect(302, npmTarball);
}

module.exports = router;
