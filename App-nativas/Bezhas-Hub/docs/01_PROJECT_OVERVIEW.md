# 🚀 BeZhas Web3 Ecosystem - Project Overview

> **Version**: 2.0 (Complete System)
> **Last Updated**: January 2026

## 📖 Introduction
BeZhas is a comprehensive Web3 Social Network integrating **AI Agents**, **DAO Governance**, **DeFi Farming**, **NFT Marketplace**, and **Quality Oracle** validation.

This documentation unifies all previous guides into a structured manual.

## 📂 Quick Navigation
| Document | Description |
|----------|-------------|
| **[01_PROJECT_OVERVIEW.md](./01_PROJECT_OVERVIEW.md)** | Start here. System setup and architecture. |
| **[02_BLOCKCHAIN_GUIDE.md](./02_BLOCKCHAIN_GUIDE.md)** | Smart contracts, tokens, DAO, deployment. |
| **[03_FEATURES_MANUAL.md](./03_FEATURES_MANUAL.md)** | User guides for AI, Feed, Market, Farming. |
| **[04_TECHNICAL_REFERENCE.md](./04_TECHNICAL_REFERENCE.md)** | API specs, Security, Database, Testing. |
| **[05_ADMIN_OPERATIONS.md](./05_ADMIN_OPERATIONS.md)** | Admin panel, monitoring, DevOps. |
| **[06_TROUBLESHOOTING.md](./06_TROUBLESHOOTING.md)** | Common errors and solutions. |

---

## 🏗️ System Architecture

### 1. Frontend (`/frontend`)
- **Stack**: React (Vite), TailwindCSS, Wagmi/Viem.
- **Key Features**: Social Feed, DAO Dashboard, NFT Market UI, Business Dashboard.
- **Run**: `pnpm run dev` (Starts at `http://localhost:5173`)

### 2. Backend (`/backend`)
- **Stack**: Node.js (Express), MongoDB, Redis, BullMQ.
- **Key Features**: REST API, AI Services (Gemini/OpenAI), Off-chain validation.
- **Run**: `node server.js` (Starts at `http://localhost:3001`)

### 3. Blockchain (`/contracts`)
- **Stack**: Hardhat, Solidity 0.8.24.
- **Networks**: Localhost (Hardhat), Polygon Amoy (Testnet), Polygon Mainnet.
- **Key Contracts**: `BezhasToken`, `GovernanceSystem`, `QualityOracle`, `LiquidityFarming`.

---

## ⚡ Quick Start

### Prerequisites
- Node.js v18+
- Docker & Docker Compose (Recommended)
- PowerShell (Windows)

### Option A: Automated Start (Recommended)
This script checks requirements and starts all services (Frontend, Backend, Node).
```powershell
./quick-start.ps1
```

### Option B: Docker Start
```bash
docker-compose up -d
```

### Option C: Manual Start
**Terminal 1 (Blockchain)**
```bash
npx hardhat node
```

**Terminal 2 (Deploy Contracts)**
```bash
npx hardhat run scripts/deploy-all.js --network localhost
```

**Terminal 3 (Backend)**
```bash
cd backend
npm install
npm start
```

**Terminal 4 (Frontend)**
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing
- **Run all tests**: `npm test`
- **Smart Contracts**: `npx hardhat test`
- **Backend API**: `cd backend && npm test`
- **Verification Script**: `./check.ps1`

