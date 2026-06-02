# ============================================================================
#  BeZhas Platform - Optimized Dev Startup Script
#  Hybrid mode: Docker (Postgres, Redis, Aegis) + Local Node services
#  Handles: Node.js v24 + Windows + Next.js 16 quirks
#
#  Usage:
#    .\scripts\start-dev.ps1              # Start everything
#    .\scripts\start-dev.ps1 -SkipDocker  # Only local services (assumes DB/Redis running)
#    .\scripts\start-dev.ps1 -Only api,frontend  # Only specific services
# ============================================================================

param(
    [switch]$SkipDocker,
    [string[]]$Only
)

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ROOT

# -- Colors & helpers --
function Write-Step($n, $total, $msg) { Write-Host "[$n/$total] $msg" -ForegroundColor Yellow }
function Write-OK($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor DarkYellow }
function Write-Err($msg) { Write-Host "  [ERR] $msg" -ForegroundColor Red }

function Test-ServiceHealth($url, $timeoutSec = 10) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec -ErrorAction Stop
        return $r.StatusCode -eq 200
    }
    catch { return $false }
}

function Wait-ForHealth($name, $url, $maxWait = 60) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $maxWait) {
        if (Test-ServiceHealth $url 5) {
            $elapsed = [math]::Round($sw.Elapsed.TotalSeconds)
            Write-OK "$name healthy (${elapsed}s)"
            return $true
        }
        Start-Sleep -Seconds 2
    }
    Write-Warn "$name not responding after ${maxWait}s (may still be starting)"
    return $false
}

function Should-Start($svc) {
    if (-not $Only -or $Only.Count -eq 0) { return $true }
    return $Only -contains $svc
}

$totalSteps = 7
$step = 0

Write-Host ""
Write-Host "+==================================================+" -ForegroundColor Cyan
Write-Host "|  BeZhas Platform - Dev Startup (Hybrid Mode)    |" -ForegroundColor Cyan
Write-Host "+==================================================+" -ForegroundColor Cyan
Write-Host ""

# â”€â”€ Step 1: Kill stale processes on our ports â”€â”€
$step++
Write-Step $step $totalSteps "Checking for stale processes..."
$ports = @(3000, 3001, 3002, 3003, 4000, 5174, 8001)
$killed = 0
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object State -eq Listen
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -ne "com.docker.backend") {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killed++
        }
    }
}
if ($killed -gt 0) { Write-OK "Killed $killed stale processes" }
else { Write-OK "No stale processes" }

# â”€â”€ Step 2: Docker infrastructure â”€â”€
$step++
if (-not $SkipDocker -and (Should-Start "docker")) {
    Write-Step $step $totalSteps "Starting Docker infrastructure (Postgres, Redis, Aegis, AI Gateway)..."

    # Check Docker daemon
    $dockerOk = $false
    try { docker info 2>$null | Out-Null; $dockerOk = $true } catch { }

    if (-not $dockerOk) {
        Write-Host "  Starting Docker Desktop..." -ForegroundColor DarkGray
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
        $tries = 0
        while ($tries -lt 60) {
            try { docker info 2>$null | Out-Null; $dockerOk = $true; break } catch { }
            Start-Sleep -Seconds 3
            $tries++
        }
        if (-not $dockerOk) { Write-Err "Docker Desktop failed to start - skipping Docker services"; $SkipDocker = $true }
    }

    if ($dockerOk) {
        # Start infra in dependency order using dev overlay (no OP Stack)
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis 2>$null
        Start-Sleep -Seconds 3

        # Wait for Postgres + Redis
        $pgHealthy = $false; $rdHealthy = $false
        for ($i = 0; $i -lt 30; $i++) {
            if (-not $pgHealthy) {
                $s = docker inspect --format='{{.State.Health.Status}}' bezhas-blockchain-postgres-1 2>$null
                if ($s -eq "healthy") { $pgHealthy = $true }
            }
            if (-not $rdHealthy) {
                $s = docker inspect --format='{{.State.Health.Status}}' bezhas-blockchain-redis-1 2>$null
                if ($s -eq "healthy") { $rdHealthy = $true }
            }
            if ($pgHealthy -and $rdHealthy) { break }
            Start-Sleep -Seconds 2
        }
        if ($pgHealthy) { Write-OK "PostgreSQL healthy (:5432)" } else { Write-Warn "PostgreSQL not healthy yet" }
        if ($rdHealthy) { Write-OK "Redis healthy (:6379)" } else { Write-Warn "Redis not healthy yet" }

        # Start Aegis + AI Gateway (depend on Postgres/Redis)
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d aegis ai-gateway 2>$null

        # Wait for Aegis + AI Gateway
        Wait-ForHealth "Aegis AI" "http://127.0.0.1:8001/aegis/v1/health" 45 | Out-Null
        Wait-ForHealth "AI Gateway" "http://127.0.0.1:3002/api/mcp/health" 30 | Out-Null
    }
}
else {
    Write-Step $step $totalSteps "Skipping Docker (--SkipDocker)"
}

# â”€â”€ Step 3: Core API (Node.js + nodemon) â”€â”€
$step++
if (Should-Start "api") {
    Write-Step $step $totalSteps "Starting Core API (:3001)..."
    $env:DATABASE_URL = "postgresql://admin:TuPasswordSeguro@localhost:5432/bezhas_control"
    $env:REDIS_URL = "redis://localhost:6379"
    $env:JWT_SECRET = "dev-secret-key-change-in-production"
    $env:BEZHAS_L2_RPC_URL = "http://localhost:8545"
    $env:PORT = "3001"
    $env:NODE_ENV = "development"
    $env:AEGIS_API_URL = "http://localhost:8001/api/aegis"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$ROOT\api`" && pnpm run dev" -WindowStyle Hidden
    Wait-ForHealth "Core API" "http://127.0.0.1:3001/api/health" 20 | Out-Null
}
else { $step++; Write-Step $step $totalSteps "Skipping API" }

# â”€â”€ Step 4: DeFi Backend â”€â”€
$step++
if (Should-Start "defi-backend") {
    Write-Step $step $totalSteps "Starting DeFi Backend (:3003)..."
    $env:CORE_API_URL = "http://localhost:3001"
    $env:CORE_API_KEY = "defi-dev-key"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$ROOT\bezhas-defi\backend`" && pnpm run dev" -WindowStyle Hidden
    Wait-ForHealth "DeFi Backend" "http://127.0.0.1:3003/health" 15 | Out-Null
}
else { $step++; Write-Step $step $totalSteps "Skipping DeFi Backend" }

# â”€â”€ Step 5: Edge Node â”€â”€
$step++
if (Should-Start "edge") {
    Write-Step $step $totalSteps "Starting Edge Node (:4000)..."
    $env:RPC_URL = "http://localhost:8545"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$ROOT\bezhas-edge-node`" && node server.js" -WindowStyle Hidden
    Wait-ForHealth "Edge Node" "http://127.0.0.1:4000/health" 15 | Out-Null
}
else { $step++; Write-Step $step $totalSteps "Skipping Edge Node" }

# â”€â”€ Step 6: Control Center Frontend (Next.js 16 via _diag.js wrapper) â”€â”€
$step++
if (Should-Start "frontend") {
    Write-Step $step $totalSteps "Starting Control Center (:3000) via _diag.js wrapper..."
    $ccPath = Join-Path $ROOT "control-center\frontend"
    if (Test-Path (Join-Path $ccPath "_diag.js")) {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$ccPath`" && node _diag.js" -WindowStyle Hidden
        Write-OK "Control Center process started (first page load may take 1-3 min on slow FS)"
    }
    else {
        Write-Warn "control-center/frontend/_diag.js not found - run cd control-center/frontend; pnpm dev manually"
    }
}
else { $step++; Write-Step $step $totalSteps "Skipping Control Center" }

# â”€â”€ Step 7: DeFi Frontend (Next.js 16 via _diag.js wrapper) â”€â”€
$step++
if (Should-Start "defi") {
    Write-Step $step $totalSteps "Starting DeFi Frontend (:5174) via _diag.js wrapper..."
    $defiPath = Join-Path $ROOT "bezhas-defi\frontend"
    if (Test-Path (Join-Path $defiPath "_diag.js")) {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$defiPath`" && node _diag.js" -WindowStyle Hidden
        Write-OK "DeFi Frontend process started (first page load may take 1-3 min on slow FS)"
    }
    else {
        Write-Warn "bezhas-defi/frontend/_diag.js not found - run cd bezhas-defi/frontend; pnpm run dev manually"
    }
}
else { $step++; Write-Step $step $totalSteps "Skipping DeFi Frontend" }

# â”€â”€ Final Summary â”€â”€
Write-Host ""
Write-Host "+==================================================+" -ForegroundColor Cyan
Write-Host "|  Platform Status                                |" -ForegroundColor Cyan
Write-Host "+==================================================+" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 3

$services = @(
    @{Name = "PostgreSQL"; Port = 5432; URL = $null },
    @{Name = "Redis"; Port = 6379; URL = $null },
    @{Name = "Control Center"; Port = 3000; URL = "http://localhost:3000" },
    @{Name = "Core API"; Port = 3001; URL = "http://localhost:3001/api/health" },
    @{Name = "AI Gateway"; Port = 3002; URL = "http://localhost:3002/api/mcp/health" },
    @{Name = "DeFi Backend"; Port = 3003; URL = "http://localhost:3003/health" },
    @{Name = "Edge Node"; Port = 4000; URL = "http://localhost:4000/health" },
    @{Name = "DeFi Frontend"; Port = 5174; URL = "http://localhost:5174/defi" },
    @{Name = "Aegis AI"; Port = 8001; URL = "http://localhost:8001/aegis/v1/health" }
)

foreach ($svc in $services) {
    $listening = Get-NetTCPConnection -LocalPort $svc.Port -ErrorAction SilentlyContinue | Where-Object State -eq Listen
    if ($listening) {
        $emoji = "*"
        $color = "Green"
    }
    else {
        $emoji = "-"
        $color = "DarkGray"
    }
    $line = "  $emoji $($svc.Name.PadRight(20)) :$($svc.Port)"
    if ($svc.URL) { $line += "  $($svc.URL)" }
    Write-Host $line -ForegroundColor $color
}

Write-Host ""
Write-Host "  NOTE: Next.js frontends (3000, 5174) need 1-3 min for first compilation." -ForegroundColor DarkGray
Write-Host "  TIP:  Open http://localhost:3000 and http://localhost:5174/defi to trigger it." -ForegroundColor DarkGray
Write-Host ""

