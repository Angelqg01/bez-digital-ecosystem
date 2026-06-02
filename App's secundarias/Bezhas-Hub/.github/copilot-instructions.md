# Bezhas Web3 System Instructions

## Project Overview
Bezhas is a Web3 Social Network integrating AI, Blockchain (DAO, Quality Oracle), and standard Social Features.
- **Architecture**: Hybrid Monorepo containing Frontend, Backend, and Smart Contracts.
- **Primary Stack**: JavaScript (Node.js/React), Solidity, MongoDB, Redis.

## Core Components & Tech Stack

### 1. Smart Contracts (`/`)
- **Framework**: Hardhat (Solidity 0.8.24).
- **Networks**: Polygon, Amoy (Testnet), Localhost (Hardhat Network).
- **Key Config**: `hardhat.config.js` (Network & Compiler settings).
- **Deploy Scripts**: `scripts/` (e.g., `deploy-dao.js`, `deploy-quality-oracle.js`).

### 2. Backend (`/backend`)
- **Runtime**: Node.js with Express.
- **Database**: MongoDB (Mongoose), Redis (Caching & BullMQ Queues).
- **AI/ML**: Integrated Node.js services (`ml.service.js` using TensorFlow.js, OpenAI, Google Gemini).
- **Structure**: Service-oriented (`services/`, `controllers/`, `routes/`).
- **Web3**: Uses `ethers.js` for server-side blockchain interaction.

### 3. Frontend (`/frontend`)
- **Framework**: React (Vite) - **JavaScript** (not TypeScript).
- **Styling**: Tailwind CSS + PostCSS.
- **Web3**: Wagmi + Viem + Web3Modal.
- **State**: Zustand (implied by typical Vite/React patterns in this ecosystem) or Context.
- **Linting**: ESLint.

## Developer Workflows

### Startup
- **Docker (Preferred)**: Run `pnpm run dev:up` in the root to start Backend, Frontend, Mongo, Redis, and Hardhat node via Docker Compose.
- **PowerShell**: Use `start-bezhas.ps1` or individual scripts like `start-backend.ps1` in root for Windows-native execution.
- **pnpm**: The project now uses pnpm as the package manager. Use `pnpm install` and `pnpm run <script>` instead of npm.

### Deployment & Testing
- **Smart Contracts**:
  - Deploy: `pnpm run deploy:<contract>` (e.g., `deploy:dao`) or `npx hardhat run scripts/<script> --network <network>`.
  - Test: `npx hardhat test`.
- **Backend Changes**:
  - Restart: `pnpm run start:backend` (or assumes Nodemon in dev).
  - Logs: Check `backend_startup.log` or Docker logs.
- **Database**:
  - Seeding: `pnpm run seed:dao` (in backend) or `dev:up` handles init.

## Conventions & Patterns
- **AI Integration**: AI logic resides in `backend/services/` (e.g., `personalAI.service.js`). Do not create separate Python services unless requested; use Node.js SDKs.
- **Blockchain Validation**: Critical features (like Posts) use "Quality Oracle" validation. Check `contracts/QualityOracle.sol` logic when modifying post validation flows.
- **Documentation**: Refer to `COMPLETE_SYSTEM_GUIDE.md` for the latest "truth" on implemented features. Architectural decisions are documented in root `*.md` files.

## Key Paths
- **Frontend Config**: `frontend/vite.config.js`, `frontend/tailwind.config.js`.
- **Backend Config**: `backend/.env`, `backend/server.js`.
- **Contracts**: `contracts/` (Source), `scripts/` (Deployment).
- **Infrastructure**: `docker-compose.yml`.
