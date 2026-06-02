# BeZhas — Deploy Validation System (Phase 11)
# Deploys ValidatorRegistry, EdgeNodeRewards, SequencerRotation, SlashingManager,
# TimelockController, and GovernanceSystem on top of an existing deployment.
#
# Prerequisites:
#   - Anvil running on 8545 with existing core deployment (BEZCoinV2 etc.)
#   - Forge compiled: forge build (in smart-contracts/)
#
# Usage:
#   .\scripts\deploy-validation.ps1
#   .\scripts\deploy-validation.ps1 -SeedDb
#   .\scripts\deploy-validation.ps1 -ChainId 2708 -RpcUrl "http://bezhas-rpc:8545"

param(
    [int]$ChainId = 31337,
    [string]$RpcUrl = "http://localhost:8545",
    [string]$PrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    [switch]$SeedDb
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FORGE = Join-Path $env:USERPROFILE ".foundry\bin\forge.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BeZhas — Validation System Deploy"     -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check prerequisites ──
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow
if (-not (Test-Path $FORGE)) { throw "Forge not found at $FORGE" }

# Check Anvil/RPC is accessible
try {
    $resp = Invoke-WebRequest -Uri $RpcUrl -Method POST -ContentType "application/json" `
        -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' `
        -UseBasicParsing -TimeoutSec 5
    Write-Host "  RPC accessible at $RpcUrl" -ForegroundColor Green
}
catch {
    throw "RPC not accessible at $RpcUrl. Start Anvil first: anvil --chain-id 31337 --port 8545"
}

# Read BEZ token address from existing deployment
$deploymentsFile = Join-Path $ROOT "smart-contracts\deployments\$ChainId.json"
if (-not (Test-Path $deploymentsFile)) {
    throw "Deployment file not found: $deploymentsFile. Run bootstrap-local.ps1 first."
}
$deployments = Get-Content $deploymentsFile | ConvertFrom-Json
$bezAddress = $deployments.core.BEZCoinV2
if (-not $bezAddress) { throw "BEZCoinV2 not found in $deploymentsFile" }

# Check if validation already deployed
if ($deployments.core.ValidatorRegistry) {
    Write-Host "  WARNING: ValidatorRegistry already deployed at $($deployments.core.ValidatorRegistry)" -ForegroundColor DarkYellow
    $confirm = Read-Host "  Redeploy? (y/N)"
    if ($confirm -ne "y") { exit 0 }
}

Write-Host "  BEZCoinV2: $bezAddress" -ForegroundColor Green

# ── Step 2: Deploy validation contracts ──
Write-Host "[2/5] Deploying validation system (6 contracts)..." -ForegroundColor Yellow
Push-Location (Join-Path $ROOT "smart-contracts")
$env:DEPLOYER_PRIVATE_KEY = $PrivateKey
$env:BEZ_TOKEN_ADDRESS = $bezAddress
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "1"

& $FORGE script script/DeployValidation.s.sol --rpc-url $RpcUrl --broadcast --slow 2>&1 | ForEach-Object {
    if ($_ -match "ValidatorRegistry:|EdgeNodeRewards:|SequencerRotation:|SlashingManager:|TimelockController:|GovernanceSystem:") {
        Write-Host "  $_" -ForegroundColor White
    }
}

$broadcastFile = Join-Path $PWD "broadcast\DeployValidation.s.sol\$ChainId\run-latest.json"
if (-not (Test-Path $broadcastFile)) { throw "Deployment failed — no broadcast file" }
Write-Host "  Validation contracts deployed" -ForegroundColor Green

# ── Step 3: Parse deployment ──
Write-Host "[3/5] Merging addresses into deployments/$ChainId.json..." -ForegroundColor Yellow
node script/parse-deployment-validation.js $ChainId
Pop-Location
Write-Host "  Addresses merged" -ForegroundColor Green

# ── Step 4: Seed database ──
if ($SeedDb) {
    Write-Host "[4/5] Seeding contract_addresses table..." -ForegroundColor Yellow
    Push-Location (Join-Path $ROOT "api")
    node db/seed-contracts.js $ChainId
    Pop-Location
    Write-Host "  Database seeded" -ForegroundColor Green
}
else {
    Write-Host "[4/5] Skipping DB seed (use -SeedDb to enable)" -ForegroundColor DarkGray
}

# ── Step 5: Verify ──
Write-Host "[5/5] Verifying validation contracts..." -ForegroundColor Yellow
$updatedDeploy = Get-Content (Join-Path $ROOT "smart-contracts\deployments\$ChainId.json") | ConvertFrom-Json
$contracts = @("ValidatorRegistry", "EdgeNodeRewards", "SequencerRotation", "SlashingManager", "TimelockController", "GovernanceSystem")
$allOk = $true
foreach ($c in $contracts) {
    $addr = $updatedDeploy.core.$c
    if ($addr) {
        Write-Host "  $c`: $addr" -ForegroundColor Green
    }
    else {
        Write-Host "  $c`: MISSING" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "=== Validation System Ready ===" -ForegroundColor Green
    Write-Host "Core contracts: $($updatedDeploy.core.PSObject.Properties.Count)" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Seed DB:   cd api && node db/seed-contracts.js $ChainId" -ForegroundColor White
    Write-Host "  2. Register:  node scripts/register-validator.js --privateKey <PK> --companyName 'Corp' --stakeAmountEth 50000" -ForegroundColor White
    Write-Host "  3. Status:    node scripts/validator-status.js --address 0x..." -ForegroundColor White
}
else {
    throw "Some validation contracts are missing — deployment may have failed"
}
# BeZhas — Deploy Validation System (Phase 11)
# Deploys ValidatorRegistry, EdgeNodeRewards, SequencerRotation, SlashingManager,
# TimelockController, and GovernanceSystem on top of an existing deployment.
#
# Prerequisites:
#   - Anvil running on 8545 with existing core deployment (BEZCoinV2 etc.)
#   - Forge compiled: forge build (in smart-contracts/)
#
# Usage:
#   .\scripts\deploy-validation.ps1
#   .\scripts\deploy-validation.ps1 -SeedDb
#   .\scripts\deploy-validation.ps1 -ChainId 2708 -RpcUrl "http://bezhas-rpc:8545"

param(
    [int]$ChainId = 31337,
    [string]$RpcUrl = "http://localhost:8545",
    [string]$PrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    [switch]$SeedDb
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FORGE = Join-Path $env:USERPROFILE ".foundry\bin\forge.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BeZhas — Validation System Deploy"     -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check prerequisites ──
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow
if (-not (Test-Path $FORGE)) { throw "Forge not found at $FORGE" }

# Check Anvil/RPC is accessible
try {
    $resp = Invoke-WebRequest -Uri $RpcUrl -Method POST -ContentType "application/json" `
        -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' `
        -UseBasicParsing -TimeoutSec 5
    Write-Host "  RPC accessible at $RpcUrl" -ForegroundColor Green
}
catch {
    throw "RPC not accessible at $RpcUrl. Start Anvil first: anvil --chain-id 31337 --port 8545"
}

# Read BEZ token address from existing deployment
$deploymentsFile = Join-Path $ROOT "smart-contracts\deployments\$ChainId.json"
if (-not (Test-Path $deploymentsFile)) {
    throw "Deployment file not found: $deploymentsFile. Run bootstrap-local.ps1 first."
}
$deployments = Get-Content $deploymentsFile | ConvertFrom-Json
$bezAddress = $deployments.core.BEZCoinV2
if (-not $bezAddress) { throw "BEZCoinV2 not found in $deploymentsFile" }

# Check if validation already deployed
if ($deployments.core.ValidatorRegistry) {
    Write-Host "  WARNING: ValidatorRegistry already deployed at $($deployments.core.ValidatorRegistry)" -ForegroundColor DarkYellow
    $confirm = Read-Host "  Redeploy? (y/N)"
    if ($confirm -ne "y") { exit 0 }
}

Write-Host "  BEZCoinV2: $bezAddress" -ForegroundColor Green

# ── Step 2: Deploy validation contracts ──
Write-Host "[2/5] Deploying validation system (6 contracts)..." -ForegroundColor Yellow
Push-Location (Join-Path $ROOT "smart-contracts")
$env:DEPLOYER_PRIVATE_KEY = $PrivateKey
$env:BEZ_TOKEN_ADDRESS = $bezAddress
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "1"

& $FORGE script script/DeployValidation.s.sol --rpc-url $RpcUrl --broadcast --slow 2>&1 | ForEach-Object {
    if ($_ -match "ValidatorRegistry:|EdgeNodeRewards:|SequencerRotation:|SlashingManager:|TimelockController:|GovernanceSystem:") {
        Write-Host "  $_" -ForegroundColor White
    }
}

$broadcastFile = Join-Path $PWD "broadcast\DeployValidation.s.sol\$ChainId\run-latest.json"
if (-not (Test-Path $broadcastFile)) { throw "Deployment failed — no broadcast file" }
Write-Host "  Validation contracts deployed" -ForegroundColor Green

# ── Step 3: Parse deployment ──
Write-Host "[3/5] Merging addresses into deployments/$ChainId.json..." -ForegroundColor Yellow
node script/parse-deployment-validation.js $ChainId
Pop-Location
Write-Host "  Addresses merged" -ForegroundColor Green

# ── Step 4: Seed database ──
if ($SeedDb) {
    Write-Host "[4/5] Seeding contract_addresses table..." -ForegroundColor Yellow
    Push-Location (Join-Path $ROOT "api")
    node db/seed-contracts.js $ChainId
    Pop-Location
    Write-Host "  Database seeded" -ForegroundColor Green
}
else {
    Write-Host "[4/5] Skipping DB seed (use -SeedDb to enable)" -ForegroundColor DarkGray
}

# ── Step 5: Verify ──
Write-Host "[5/5] Verifying validation contracts..." -ForegroundColor Yellow
$updatedDeploy = Get-Content (Join-Path $ROOT "smart-contracts\deployments\$ChainId.json") | ConvertFrom-Json
$contracts = @("ValidatorRegistry", "EdgeNodeRewards", "SequencerRotation", "SlashingManager", "TimelockController", "GovernanceSystem")
$allOk = $true
foreach ($c in $contracts) {
    $addr = $updatedDeploy.core.$c
    if ($addr) {
        Write-Host "  $c`: $addr" -ForegroundColor Green
    }
    else {
        Write-Host "  $c`: MISSING" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "=== Validation System Ready ===" -ForegroundColor Green
    Write-Host "Core contracts: $($updatedDeploy.core.PSObject.Properties.Count)" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Seed DB:   cd api && node db/seed-contracts.js $ChainId" -ForegroundColor White
    Write-Host "  2. Register:  node scripts/register-validator.js --privateKey <PK> --companyName 'Corp' --stakeAmountEth 50000" -ForegroundColor White
    Write-Host "  3. Status:    node scripts/validator-status.js --address 0x..." -ForegroundColor White
}
else {
    throw "Some validation contracts are missing — deployment may have failed"
}
