# BeZhas - Quick Start Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BEZHAS - STARTING SERVERS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = $PSScriptRoot
$backendPath = Join-Path $scriptPath "backend"
$frontendPath = Join-Path $scriptPath "frontend"

# Verificar Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js no está instalado" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

# Iniciar Backend
Write-Host ""
Write-Host "Iniciando Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; node server.js" -WindowStyle Normal

Start-Sleep -Seconds 3

# Iniciar Frontend
Write-Host "Iniciando Frontend..." -ForegroundColor Yellow

# Verificar si existen node_modules en frontend
if (-not (Test-Path "$frontendPath\node_modules")) {
    Write-Host "ADVERTENCIA: Frontend no tiene dependencias instaladas" -ForegroundColor Red
    Write-Host "Intentando instalar dependencias..." -ForegroundColor Yellow
    
    # Intentar con diferentes métodos
    Write-Host "Método 1: Usando pnpm..." -ForegroundColor Gray
    $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpm) {
        cd $frontendPath
        pnpm install
    } else {
        Write-Host "pnpm no disponible, intenta instalar manualmente" -ForegroundColor Red
        Write-Host "Ejecuta: cd frontend && pnpm install" -ForegroundColor Yellow
        exit 1
    }
}

# Buscar el ejecutable de vite
$viteJs = Join-Path $frontendPath "node_modules\vite\bin\vite.js"

if (Test-Path $viteJs) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; node node_modules/vite/bin/vite.js" -WindowStyle Normal
} else {
    Write-Host "ERROR: No se encontró Vite en node_modules" -ForegroundColor Red
    Write-Host "Ruta esperada: $viteJs" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   SERVIDORES INICIADOS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
