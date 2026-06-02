# BeZhas Quick Start with pnpm
# Inicio rápido usando pnpm como gestor de paquetes

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BEZHAS - QUICK START (pnpm)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "SilentlyContinue"

# Verificar pnpm
$pnpmVersion = pnpm --version 2>$null
if (-not $pnpmVersion) {
    Write-Host "ERROR: pnpm no está instalado" -ForegroundColor Red
    Write-Host "Instala pnpm con: iwr https://get.pnpm.io/install.ps1 -useb | iex" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ pnpm: v$pnpmVersion" -ForegroundColor Green

# Verificar Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js no está instalado" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Paths
$scriptPath = $PSScriptRoot
$backendPath = Join-Path $scriptPath "backend"
$frontendPath = Join-Path $scriptPath "frontend"

# Verificar dependencias
Write-Host "Verificando dependencias..." -ForegroundColor Yellow

if (-not (Test-Path "$backendPath\node_modules")) {
    Write-Host "Instalando dependencias del backend..." -ForegroundColor Yellow
    cd $backendPath
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Falló la instalación del backend" -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path "$frontendPath\node_modules")) {
    Write-Host "Instalando dependencias del frontend..." -ForegroundColor Yellow
    cd $frontendPath
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Falló la instalación del frontend" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✓ Dependencias verificadas" -ForegroundColor Green
Write-Host ""

# Iniciar Backend
Write-Host "Iniciando Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backendPath'; `$env:MONGODB_URI='mongodb://localhost:27017/bezhas'; `$env:REDIS_URL=''; pnpm start"
) -WindowStyle Normal

Start-Sleep -Seconds 5

# Iniciar Frontend
Write-Host "Iniciando Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", 
    "-Command",
    "cd '$frontendPath'; pnpm run dev"
) -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   ✓ SERVIDORES INICIADOS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
