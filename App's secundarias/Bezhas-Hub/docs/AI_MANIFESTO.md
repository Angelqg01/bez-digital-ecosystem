# 🤖 BeZhas AI & MCP Manifesto

Welcome, Agent. This document is designed to give you an immediate high-level understanding of the BeZhas platform architecture, key logic locations, and operational workflows.

## 🏗️ Core Architecture

BeZhas is a multi-sector Web3 ecosystem with a focus on enterprise logistics, payments, and RWA (Real World Assets).

- **Frontend**: `/frontend` (React + Vite). Main user interface.
- **Backend**: `/backend` (Node.js/Express). API layer, orchestration, and business logic.
- **Blockchain**: Core smart contracts (Solidity) often reside in `/contracts` or linked packages.
- **SDK**: `/sdk`. The unified interface for interacting with BeZhas services programmatically.
- **MCP Server**: `/packages/mcp-server`. Model Context Protocol implementation for AI tools.

## 💳 Key Systems

### Payments
- **Crypto**: Handled via `backend/services/payment.service.js` and smart contracts.
- **Fiat**: Integration with Stripe and MoonPay.
- **Webhook handling**: `backend/routes/payment.routes.js`.

### Automations & Logistics
- **Engine**: `/aegis` or `/backend/services/automation.service.js` (Verify current location).
- **Logistics SDK**: `/sdk/logistics.js`.
- **Integrations**: Maersk, TNT, Vinted, etc.

### Quality Oracle
- **Verification**: System for verifying asset quality and escrow releases.
- **Location**: `backend/services/oracle.service.js`.

## 📂 Project Organization

- **`/docs`**: Organized documentation.
    - `system/`: Architecture and core logic details.
    - `guides/`: Installation, deployment, and usage guides.
    - `reports/`: Audit and implementation history.
- **`/scripts`**: PowerShell and Bash scripts for local dev and GCP deployment.
- **`/api`**: API specifications and documentation.

## 🚀 Environment & Deployment

- **Local**: Use `scripts/quick-start.ps1` to launch Backend (3001) and Frontend (3000).
- **GCP**: Deployment via Google Cloud Run and Cloud Build. `cloudbuild.yaml` is in the root.
- **Secrets**: Managed via GCP Secret Manager or locally via `.env`.

## 🛠️ Essential Commands

- `scripts/check.ps1`: Comprehensive system diagnostic.
- `scripts/quick-start.ps1`: Full ecosystem startup.
- `scripts/setup-gcp.ps1`: Initial GCP project configuration.

## 📋 Best Practices for Agents
1. **Prefer the SDK**: Always check `sdk/` for existing methods before reinventing logic.
2. **Consult documentation**: Most subsystems have detailed `.md` files in `docs/system/`.
3. **Use the scripts**: For startup or verification, use the established scripts in `scripts/` instead of raw `node` or `npm` commands where possible.
