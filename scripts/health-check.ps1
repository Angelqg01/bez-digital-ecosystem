#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Health Check Script - Verifica el estado de todos los componentes
#>

function Write-Status {
    param($Message, $Status)
    if ($Status -eq "OK") {
        Write-Host "✅ $Message" -ForegroundColor Green
    }
    elseif ($Status -eq "WARNING") {
        Write-Host "⚠️  $Message" -ForegroundColor Yellow
    }
    else {
        Write-Host "❌ $Message" -ForegroundColor Red
    }
}

Clear-Host
Write-Host @"

╔══════════════════════════════════════════════════════════╗
║         BeZhas Health Check - System Status             ║
╚══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$projectRoot = "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"

# 1. Node.js & npm
Write-Host "🔧 Verificando herramientas de desarrollo..." -ForegroundColor Cyan
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Status "Node.js $nodeVersion instalado" "OK"
}
else {
    Write-Status "Node.js no encontrado" "ERROR"
}

$npmVersion = npm --version 2>$null
if ($npmVersion) {
    Write-Status "npm v$npmVersion instalado" "OK"
}
else {
    Write-Status "npm no encontrado" "ERROR"
}

Write-Host ""

# 2. Dependencias
Write-Host "📦 Verificando dependencias..." -ForegroundColor Cyan

if (Test-Path "$projectRoot\backend\node_modules") {
    Write-Status "Backend node_modules instalado" "OK"
}
else {
    Write-Status "Backend node_modules faltante" "ERROR"
}

if (Test-Path "$projectRoot\frontend\node_modules") {
    Write-Status "Frontend node_modules instalado" "OK"
}
else {
    Write-Status "Frontend node_modules faltante" "ERROR"
}

if (Test-Path "$projectRoot\sdk\node_modules") {
    Write-Status "SDK node_modules instalado" "OK"
}
else {
    Write-Status "SDK node_modules faltante" "ERROR"
}

Write-Host ""

# 3. Archivos críticos
Write-Host "📄 Verificando archivos críticos..." -ForegroundColor Cyan

$criticalFiles = @(
    @{Path = "backend\.env"; Name = "Backend .env" },
    @{Path = "backend\server.js"; Name = "Backend server.js" },
    @{Path = "backend\routes\vip.routes.js"; Name = "VIP Routes" },
    @{Path = "backend\routes\bezcoin-moonpay.routes.js"; Name = "BEZ-Coin Routes" },
    @{Path = "backend\routes\vinted.routes.js"; Name = "Vinted Routes" },
    @{Path = "backend\models\VIPSubscription.model.js"; Name = "VIP Model" },
    @{Path = "backend\models\BEZCoinTransaction.model.js"; Name = "BEZ-Coin Model" },
    @{Path = "backend\models\VintedListing.model.js"; Name = "Vinted Model" },
    @{Path = "backend\models\LogisticsShipment.model.js"; Name = "Logistics Model" },
    @{Path = "frontend\src\pages\VIPPanel.jsx"; Name = "VIP Panel Component" },
    @{Path = "sdk\bezhas-enterprise-sdk.js"; Name = "Enterprise SDK" }
)

foreach ($file in $criticalFiles) {
    if (Test-Path "$projectRoot\$($file.Path)") {
        Write-Status "$($file.Name)" "OK"
    }
    else {
        Write-Status "$($file.Name) faltante" "ERROR"
    }
}

Write-Host ""

# 4. Servicios en ejecución
Write-Host "🔌 Verificando servicios..." -ForegroundColor Cyan

function Test-ServicePort {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

if (Test-ServicePort 3001) {
    Write-Status "Backend corriendo en puerto 3001" "OK"
}
else {
    Write-Status "Backend no está corriendo (puerto 3001)" "WARNING"
}

if (Test-ServicePort 3000) {
    Write-Status "Frontend corriendo en puerto 3000" "OK"
}
else {
    Write-Status "Frontend no está corriendo (puerto 3000)" "WARNING"
}

Write-Host ""

# 5. MongoDB
Write-Host "🗄️  Verificando base de datos..." -ForegroundColor Cyan
$mongoProcess = Get-Process mongod -ErrorAction SilentlyContinue
if ($mongoProcess) {
    Write-Status "MongoDB local corriendo (PID: $($mongoProcess.Id))" "OK"
}
else {
    Write-Status "MongoDB local no detectado (puede usar Atlas)" "WARNING"
}

Write-Host ""

# 6. Probar Backend API (si está corriendo)
if (Test-ServicePort 3001) {
    Write-Host "🧪 Probando endpoints del Backend..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Status "Health endpoint respondiendo" "OK"
        }
    }
    catch {
        Write-Status "Health endpoint no disponible" "WARNING"
    }
    
    Write-Host ""
}

# 7. Resumen
Write-Host @"
╔══════════════════════════════════════════════════════════╗
║                        RESUMEN                           ║
╚══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host ""
Write-Host "📚 Archivos de documentación:" -ForegroundColor Yellow
Write-Host "   - PROXIMOS_PASOS.md" -ForegroundColor White
Write-Host "   - IMPLEMENTACION_COMPLETA_RESUMEN.md" -ForegroundColor White
Write-Host "   - DEPLOYMENT_CHECKLIST.md" -ForegroundColor White

Write-Host ""
Write-Host "🚀 Comandos rápidos:" -ForegroundColor Yellow
Write-Host "   - Iniciar todo: .\quick-start.ps1" -ForegroundColor White
Write-Host "   - Backend solo: cd backend; pnpm start" -ForegroundColor White
Write-Host "   - Frontend solo: cd frontend; pnpm start" -ForegroundColor White
Write-Host "   - Tests SDK: cd sdk; node test-enterprise-sdk.js" -ForegroundColor White

Write-Host ""
Write-Host "🔑 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Solicitar API keys (Stripe, MoonPay, Maersk, TNT, Vinted)" -ForegroundColor White
Write-Host "   2. Configurar .env con las API keys" -ForegroundColor White
Write-Host "   3. Iniciar servicios con .\quick-start.ps1" -ForegroundColor White
Write-Host "   4. Abrir http://localhost:3000 en el navegador" -ForegroundColor White

Write-Host ""
