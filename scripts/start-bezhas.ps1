# BeZhas Enterprise - Auto Start Script
# Inicia backend y frontend automáticamente

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyanyan
Write-Host "   BEZHAS ENTERPRISE - AUTO START" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan==============================" -ForegroundColor Cyan
Write-Host ""Write-Host ""

$ErrorActionPreference = "SilentlyContinue"

# Verificar si Node.js está instalado# Verificar si Node.js está instalado
$nodeVersion = node --version 2>$nullull
if(-not $nodeVersion) {
    Write-Host "ERROR: Node.js no está instalado" -ForegroundColor RedNode.js no está instalado" -ForegroundColor Red
exit 1    exit 1
}

Write-Host "Node.js detectado: $nodeVersion" -ForegroundColor GreenundColor Green
Write-Host ""Write-Host ""

# Verificar si los puertos están libres
Write-Host "Verificando puertos..." -ForegroundColor Yellowe-Host "Verificando puertos..." -ForegroundColor Yellow

$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinuentinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue-LocalPort 5173 -ErrorAction SilentlyContinue

if ($port3001) {
    Write-Host "  Puerto 3001 (backend) ya está en uso" -ForegroundColor YellowundColor Yellow
    $killBackend = Read-Host "  Detener proceso existente? (S/N)"
    if ($killBackend -eq "S" -or $killBackend -eq "s") {
        if ($killBackend -eq "S" -or $killBackend -eq "s") {
            $pid = $port3001 | Select-Object -ExpandProperty OwningProcess -First 101 | Select-Object -ExpandProperty OwningProcess -First 1
            Stop-Process -Id $pid -Force
            Write-Host "  Proceso detenido" -ForegroundColor Greeneso detenido" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }}
}

if($port5173) {
    Write-Host "  Puerto 5173 (frontend) ya está en uso" -ForegroundColor Yellowllow
    $killFrontend = Read-Host "  Detener proceso existente? (S/N)"   $killFrontend = Read-Host "  Detener proceso existente? (S/N)"
    if($killFrontend -eq "S" -or $killFrontend -eq "s") {($killFrontend -eq "S" -or $killFrontend -eq "s") {
        $pid = $port5173 | Select-Object -ExpandProperty OwningProcess -First 1ss -First 1
        Stop-Process -Id $pid -Force       Stop-Process -Id $pid -Force
        Write-Host "  Proceso detenido" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "Iniciando servicios..." -ForegroundColor Cyan
Write-Host ""

# Iniciar Backend en una nueva ventana de PowerShell
Write-Host "[1/2] Iniciando Backend (puerto 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host 'BACKEND BEZHAS' -ForegroundColor Cyan; node server.js"
Start-Sleep -Seconds 3

# Iniciar Frontend en una nueva ventana de PowerShell
Write-Host "[2/2] Iniciando Frontend (puerto 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host 'FRONTEND BEZHAS' -ForegroundColor Cyan; npm run dev"

Write-Host ""
Write-Host "Esperando inicialización..." -ForegroundColor Yellow

# Esperar a que el backend esté listo
for($i=1; $i -le 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -UseBasicParsing 2>$null
        if($response.StatusCode -eq 200) {
            Write-Host ""
            Write-Host "Backend:  ACTIVO (puerto 3001)" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

# Esperar a que el frontend esté listo
for($i=1; $i -le 20; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing 2>$null
        if($response.StatusCode -eq 200) {
            Write-Host "Frontend: ACTIVO (puerto 5173)" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SISTEMA INICIADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener este script" -ForegroundColor Gray
Write-Host "  (Las ventanas de Backend y Frontend seguiran activas)" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Abrir navegador automáticamente después de 3 segundos
Start-Sleep -Seconds 3
Write-Host "Abriendo navegador..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Listo! BeZhas Enterprise está ejecutándose." -ForegroundColor Green
Write-Host ""
        Write-Host "  Proceso detenido" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "Iniciando servicios..." -ForegroundColor Cyan
Write-Host ""

# Iniciar Backend en una nueva ventana de PowerShell
Write-Host "[1/2] Iniciando Backend (puerto 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host 'BACKEND BEZHAS' -ForegroundColor Cyan; node server.js"
Start-Sleep -Seconds 3

# Iniciar Frontend en una nueva ventana de PowerShell
Write-Host "[2/2] Iniciando Frontend (puerto 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host 'FRONTEND BEZHAS' -ForegroundColor Cyan; npm run dev"

Write-Host ""
Write-Host "Esperando inicialización..." -ForegroundColor Yellow

# Esperar a que el backend esté listo
for($i=1; $i -le 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -UseBasicParsing 2>$null
        if($response.StatusCode -eq 200) {
            Write-Host ""
            Write-Host "Backend:  ACTIVO (puerto 3001)" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

# Esperar a que el frontend esté listo
for($i=1; $i -le 20; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing 2>$null
        if($response.StatusCode -eq 200) {
            Write-Host "Frontend: ACTIVO (puerto 5173)" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SISTEMA INICIADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener este script" -ForegroundColor Gray
Write-Host "  (Las ventanas de Backend y Frontend seguiran activas)" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Abrir navegador automáticamente después de 3 segundos
Start-Sleep -Seconds 3
Write-Host "Abriendo navegador..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Listo! BeZhas Enterprise está ejecutándose." -ForegroundColor Green
Write-Host ""
