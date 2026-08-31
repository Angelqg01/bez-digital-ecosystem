/**
 * ═══════════════════════════════════════════════════════
 * BeZhas API Gateway — Unified Backend for Ecosystem
 * ═══════════════════════════════════════════════════════
 * 
 * Single entry point for all sub-app API calls:
 * - /api/auth/*     → SIWE login, JWT verification, DID resolution
 * - /api/gas/*      → Gas Tank balance, recharge (Stripe), Aegis predictions
 * - /api/vision/*   → Gemini Vision proxy, SIFT fingerprint, scan history
 * - /api/wallet/*   → Balance, tx history, NFT metadata
 * - /api/nodes/*    → Edge node registration, metrics, rewards
 * - /api/contracts/* → Contract read/write proxy, Paymaster relay
 * - /api/mcp/*      → AI tool invocation (12 MCP tools)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Routes
import { authRouter } from './routes/auth.js';
import { gasRouter } from './routes/gas.js';
import { visionRouter } from './routes/vision.js';
import { walletRouter } from './routes/wallet.js';
import { nodesRouter } from './routes/nodes.js';
import { contractsRouter } from './routes/contracts.js';
import { mcpRouter } from './routes/mcp.js';
import { energyRouter } from './routes/energy.js';
import { purescanRouter } from './routes/purescan.js';
import { cargolinkRouter } from './routes/cargolink.js';
import { bzsphereRouter } from './routes/bzsphere.js';
import { healthRouter } from './routes/health.js';
import { billingRouter } from './routes/billing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load shared env
config({ path: resolve(__dirname, '../../../.env.shared') });

const app = express();
const PORT = process.env.GATEWAY_PORT || 3001;

// ─── Middleware ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin: [
    'http://localhost:3000',  // Bezhas-Hub
    'http://localhost:3010',  // BEZ Wallet
    'http://localhost:3011',  // Gas Tank Manager
    'http://localhost:3012',  // Edge Node Manager
    'http://localhost:3013',  // BEZ Vision Scan
    'http://localhost:3014',  // BZ Capital
    'http://localhost:3015',  // Customs
    'http://localhost:3017',  // BeZhas Energy 4.0
    'http://localhost:3018',  // BZ PureScan
    'http://localhost:3019',  // BZ CargoLink
    'http://localhost:3020',  // BZ Sphere
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '25mb' })); // Vision images can be large
app.use(morgan('short'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Try again in a minute.' },
});
app.use('/api/', limiter);

// ─── API Routes ─────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/gas', gasRouter);
app.use('/api/vision', visionRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/nodes', nodesRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/mcp', mcpRouter);
app.use('/api/energy', energyRouter);
app.use('/api/purescan', purescanRouter);
app.use('/api/cargolink', cargolinkRouter);
app.use('/api/sphere', bzsphereRouter);
app.use('/api/billing', billingRouter);

// ─── Error Handler ──────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[GATEWAY ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'GATEWAY_ERROR',
  });
});

// ─── 404 ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// ─── Start ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║  BeZhas API Gateway · v1.0.0            ║
  ║  Port: ${PORT}                            ║
  ║  Chain: 2708 (BeZhas L2)                ║
  ║  Endpoints: 9 route groups              ║
  ╚══════════════════════════════════════════╝
  `);
});

export default app;
