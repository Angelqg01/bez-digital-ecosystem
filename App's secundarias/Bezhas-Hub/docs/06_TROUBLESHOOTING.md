# 🔧 Troubleshooting Guide

## 🛑 Common Issues

### 1. "Wallet connection failed"
- **Cause**: Wrong network selected or MetaMask locked.
- **Fix**: Switch MetaMask to **Localhost 8545** (Dev) or **Amoy** (Testnet). Refresh page.

### 2. "Nonce too high" (Localhost)
- **Cause**: Metamask history out of sync with reset local node.
- **Fix**: Open MetaMask > Settings > Advanced > Clear Activity Tab Data.

### 3. Backend "Connection Refused"
- **Cause**: MongoDB is not running.
- **Fix**: Run `docker-compose up -d mongo` or check local service.

### 4. Smart Contract "Revert" errors
- **Cause**: Usually lack of allowance or insufficient balance.
- **Fix**: Check console logs. Ensure you `approve()` tokens before spending.

---

## 📜 Logs & Diagnostics

### Backend Logs
Located in `backend_startup.log` or view live:
```bash
docker-compose logs -f backend
```

### Self-Diagnostic Tool
Run the included PowerShell script to check environment health:
```powershell
./check.ps1
```
It verifies: Node version, MongoDB connection, Ports 3000/3001/8545 availability.
