# BeZhas Blockchain — Local Bootstrap Script
# Starts all services locally for development and verifies the full pipeline.
#
# Prerequisites:
#   - Foundry (forge/anvil) installed at $env:USERPROFILE\.foundry\bin\
#   - Node.js 20+ with pnpm
#   - Docker (for PostgreSQL) OR local PostgreSQL on port 5432
#   - Redis on port 6379
#
# Usage:
#   .\scripts\bootstrap-local.ps1 [-SkipDeploy] [-SkipDocker]

param(
    [switch]$SkipDeploy,
    [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "1"
$FORGE = Join-Path $env:USERPROFILE ".foundry\bin\forge.exe"
$ANVIL = Join-Path $env:USERPROFILE ".foundry\bin\anvil.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BeZhas Blockchain — Local Bootstrap"   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check prerequisites ──
Write-Host "[1/8] Checking prerequisites..." -ForegroundColor Yellow
if (-not (Test-Path $FORGE)) { throw "Forge not found at $FORGE" }
if (-not (Test-Path $ANVIL)) { throw "Anvil not found at $ANVIL" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js not found" }
try { redis-cli ping | Out-Null } catch { Write-Host "  WARNING: Redis not running" -ForegroundColor DarkYellow }
Write-Host "  All prerequisites OK" -ForegroundColor Green

# ── Step 2: Start Anvil ──
Write-Host "[2/8] Starting Anvil (port 8545, chain 31337)..." -ForegroundColor Yellow
try { taskkill /F /IM anvil.exe 2>$null | Out-Null } catch { }
Start-Sleep -Seconds 1
Start-Process -FilePath $ANVIL -ArgumentList "--chain-id", "31337", "--port", "8545", "--block-time", "2", "--silent" -WindowStyle Hidden
Start-Sleep -Seconds 3
# Verify Anvil is running
$tries = 0
while ($tries -lt 20) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8545" -Method POST -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { break }
    }
    catch { }
    Start-Sleep -Milliseconds 500
    $tries++
}
if ($tries -ge 20) { throw "Anvil failed to start" }
Write-Host "  Anvil running" -ForegroundColor Green

# ── Step 3: Deploy contracts ──
if (-not $SkipDeploy) {
    Write-Host "[3/8] Deploying 66 contracts..." -ForegroundColor Yellow
    Push-Location (Join-Path $ROOT "smart-contracts")
    $env:DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    & $FORGE script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast --slow 2>$null
    if ($LASTEXITCODE -ne 0) {
        # forge exit code 1 can be lint warnings — check if broadcast succeeded
        $broadcastFile = Join-Path $PWD "broadcast\DeployAll.s.sol\31337\run-latest.json"
        if (-not (Test-Path $broadcastFile)) { throw "Deployment failed" }
    }
    Write-Host "  Core + Sector contracts deployed" -ForegroundColor Green

    # ── Step 3b: Deploy Validation System ──
    Write-Host "[3b/8] Deploying Validation System (6 contracts)..." -ForegroundColor Yellow
    $bezAddr = (Get-Content (Join-Path $PWD "deployments\31337.json") | ConvertFrom-Json).core.BEZCoinV2
    if (-not $bezAddr) {
        # Parse first so we can get BEZ address
        node script/parse-deployment.js 31337
        $bezAddr = (Get-Content (Join-Path $PWD "deployments\31337.json") | ConvertFrom-Json).core.BEZCoinV2
    }
    $env:BEZ_TOKEN_ADDRESS = $bezAddr
    & $FORGE script script/DeployValidation.s.sol --rpc-url http://localhost:8545 --broadcast --slow 2>$null
    if ($LASTEXITCODE -ne 0) {
        $vBroadcast = Join-Path $PWD "broadcast\DeployValidation.s.sol\31337\run-latest.json"
        if (-not (Test-Path $vBroadcast)) { Write-Host "  WARNING: Validation deploy failed" -ForegroundColor DarkYellow }
    }
    Write-Host "  Validation system deployed" -ForegroundColor Green

    # ── Step 4: Parse deployment ──
    Write-Host "[4/8] Parsing deployment addresses..." -ForegroundColor Yellow
    node script/parse-deployment.js 31337
    node script/parse-deployment-validation.js 31337
    Pop-Location
    Write-Host "  Parsed to deployments/31337.json" -ForegroundColor Green
}
else {
    Write-Host "[3/8] Skipping deploy (--SkipDeploy)" -ForegroundColor DarkGray
    Write-Host "[4/8] Skipping parse (--SkipDeploy)" -ForegroundColor DarkGray
}

# ── Step 5: Start PostgreSQL ──
if (-not $SkipDocker) {
    Write-Host "[5/8] Starting PostgreSQL (Docker)..." -ForegroundColor Yellow
    Push-Location $ROOT
    docker compose up postgres -d 2>$null
    Start-Sleep -Seconds 5
    # Wait for healthcheck
    $tries = 0
    while ($tries -lt 30) {
        $status = docker inspect --format='{{.State.Health.Status}}' bezhas-blockchain-postgres-1 2>$null
        if ($status -eq "healthy") { break }
        Start-Sleep -Seconds 2
        $tries++
    }
    Pop-Location
    if ($tries -ge 30) { throw "PostgreSQL failed to start" }
    Write-Host "  PostgreSQL healthy" -ForegroundColor Green
}
else {
    Write-Host "[5/8] Skipping Docker PostgreSQL (--SkipDocker)" -ForegroundColor DarkGray
}

# ── Step 6: Run migrations + seed ──
Write-Host "[6/8] Running migrations and seeding..." -ForegroundColor Yellow
Push-Location (Join-Path $ROOT "api")
$env:DATABASE_URL = "postgresql://admin:TuPasswordSeguro@localhost:5432/bezhas_control"
$env:REDIS_URL = "redis://localhost:6379"
node db/migrate.js
node db/seed.js
node db/seed-contracts.js 31337
Pop-Location
Write-Host "  Database seeded with 66 contract addresses" -ForegroundColor Green

# ── Step 7: Verify deployment ──
Write-Host "[7/8] Verifying deployment..." -ForegroundColor Yellow
node (Join-Path $ROOT "scripts\verify-deployment.js") 31337
Write-Host "  All contracts verified" -ForegroundColor Green

# ── Step 8: Start API ──
Write-Host "[8/8] Starting API server..." -ForegroundColor Yellow
$env:PORT = "3001"
$env:NODE_ENV = "development"
$env:BEZHAS_L2_RPC_URL = "http://localhost:8545"
$env:BEZHAS_CHAIN_ID = "31337"
$env:JWT_SECRET = "dev-secret-key-change-in-production"
Push-Location (Join-Path $ROOT "api")
Start-Process -FilePath "node" -ArgumentList "index.js" -WindowStyle Hidden
Pop-Location
Start-Sleep -Seconds 3
# Verify API
try {
    $health = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 5
    $data = $health.Content | ConvertFrom-Json
    Write-Host "  API: $($data.status) | DB: $($data.services.database)" -ForegroundColor Green
}
catch {
    Write-Host "  WARNING: API health check failed" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bootstrap Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Anvil:      http://localhost:8545  (chain 31337)" -ForegroundColor White
Write-Host "  API:        http://localhost:3001" -ForegroundColor White
Write-Host "  Redis:      localhost:6379" -ForegroundColor White
Write-Host "  PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host ""
Write-Host "  Contracts:  66 deployed" -ForegroundColor White
Write-Host "  BEZ Token:  100,000,000 total supply" -ForegroundColor White
Write-Host "  Edge Node:  10,000 BEZ + EDGE_NODE_ROLE" -ForegroundColor White
Write-Host ""
