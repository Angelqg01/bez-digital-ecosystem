# BeZhas Enterprise - Auto Start Script
# Inicia backend y frontend automáticamente

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BEZHAS ENTERPRISE - AUTO START" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "SilentlyContinue"

# Verificar si Node.js está instalado
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js no está instalado" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js detectado: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Verificar si los puertos están libres
Write-Host "Verificando puertos..." -ForegroundColor Yellow

$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($port3001) {
    Write-Host "  Puerto 3001 (backend) ya está en uso" -ForegroundColor Yellow
    $killBackend = Read-Host "  Detener proceso existente? (S/N)"
    if ($killBackend -eq "S" -or $killBackend -eq "s") {
        $processId = $port3001 | Select-Object -ExpandProperty OwningProcess -First 1
        Stop-Process -Id $processId -Force
        Write-Host "  Proceso detenido" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
}

if ($port5173) {
    Write-Host "  Puerto 5173 (frontend) ya está en uso" -ForegroundColor Yellow
    $killFrontend = Read-Host "  Detener proceso existente? (S/N)"
    if ($killFrontend -eq "S" -or $killFrontend -eq "s") {
        $processId = $port5173 | Select-Object -ExpandProperty OwningProcess -First 1
        Stop-Process -Id $processId -Force
        Write-Host "  Proceso detenido" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "Iniciando servicios..." -ForegroundColor Cyan
Write-Host ""

# Iniciar Backend
Write-Host "1. Iniciando Backend (Puerto 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '=== BACKEND BEZHAS ===' -ForegroundColor Green; node server.js"
Write-Host "   Backend iniciado" -ForegroundColor Green

# Esperar 3 segundos para que el backend inicie
Write-Host "   Esperando al backend..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Iniciar Frontend
Write-Host ""
Write-Host "2. Iniciando Frontend (Puerto 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '=== FRONTEND BEZHAS ===' -ForegroundColor Blue; npm run dev"
Write-Host "   Frontend iniciado" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   SERVICIOS INICIADOS CORRECTAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona Ctrl+C para detener este script" -ForegroundColor Gray
Write-Host "(Los servicios seguirán ejecutándose en sus ventanas)" -ForegroundColor Gray
Write-Host ""

# Mantener el script abierto
Write-Host "Monitoreando servicios..." -ForegroundColor Yellow
Write-Host ""

# Loop para mostrar estado cada 30 segundos
while ($true) {
    Start-Sleep -Seconds 30
    
    # Verificar si los puertos siguen activos
    $backend = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
    $frontend = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] Estado:" -ForegroundColor Gray
    
    if ($backend) {
        Write-Host "  Backend:  ONLINE" -ForegroundColor Green
    }
    else {
        Write-Host "  Backend:  OFFLINE" -ForegroundColor Red
    }
    
    if ($frontend) {
        Write-Host "  Frontend: ONLINE" -ForegroundColor Green
    }
    else {
        Write-Host "  Frontend: OFFLINE" -ForegroundColor Red
    }
    
    Write-Host ""
}
# BeZhas Enterprise - Auto Start Script
# Inicia backend y frontend automáticamente

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BEZHAS ENTERPRISE - AUTO START" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "SilentlyContinue"

# Verificar si Node.js está instalado
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js no está instalado" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js detectado: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Verificar si los puertos están libres
Write-Host "Verificando puertos..." -ForegroundColor Yellow

$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($port3001) {
    Write-Host "  Puerto 3001 (backend) ya está en uso" -ForegroundColor Yellow
    $killBackend = Read-Host "  Detener proceso existente? (S/N)"
    if ($killBackend -eq "S" -or $killBackend -eq "s") {
        $processId = $port3001 | Select-Object -ExpandProperty OwningProcess -First 1
        Stop-Process -Id $processId -Force
        Write-Host "  Proceso detenido" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
}

if ($port5173) {
    Write-Host "  Puerto 5173 (frontend) ya está en uso" -ForegroundColor Yellow
    $killFrontend = Read-Host "  Detener proceso existente? (S/N)"
    if ($killFrontend -eq "S" -or $killFrontend -eq "s") {
        $processId = $port5173 | Select-Object -ExpandProperty OwningProcess -First 1
        Stop-Process -Id $processId -Force
        Write-Host "  Proceso detenido" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "Iniciando servicios..." -ForegroundColor Cyan
Write-Host ""

# Iniciar Backend
Write-Host "1. Iniciando Backend (Puerto 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '=== BACKEND BEZHAS ===' -ForegroundColor Green; node server.js"
Write-Host "   Backend iniciado" -ForegroundColor Green

# Esperar 3 segundos para que el backend inicie
Write-Host "   Esperando al backend..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Iniciar Frontend
Write-Host ""
Write-Host "2. Iniciando Frontend (Puerto 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '=== FRONTEND BEZHAS ===' -ForegroundColor Blue; npm run dev"
Write-Host "   Frontend iniciado" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   SERVICIOS INICIADOS CORRECTAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona Ctrl+C para detener este script" -ForegroundColor Gray
Write-Host "(Los servicios seguirán ejecutándose en sus ventanas)" -ForegroundColor Gray
Write-Host ""

# Mantener el script abierto
Write-Host "Monitoreando servicios..." -ForegroundColor Yellow
Write-Host ""

# Loop para mostrar estado cada 30 segundos
while ($true) {
    Start-Sleep -Seconds 30
    
    # Verificar si los puertos siguen activos
    $backend = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
    $frontend = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] Estado:" -ForegroundColor Gray
    
    if ($backend) {
        Write-Host "  Backend:  ONLINE" -ForegroundColor Green
    }
    else {
        Write-Host "  Backend:  OFFLINE" -ForegroundColor Red
    }
    
    if ($frontend) {
        Write-Host "  Frontend: ONLINE" -ForegroundColor Green
    }
    else {
        Write-Host "  Frontend: OFFLINE" -ForegroundColor Red
    }
    
    Write-Host ""
}
