# BeZhas Health Check
# Verificación rápida del estado del sistema

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "  BeZhas System Health Check" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

$root = "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"

# Check Node.js
$node = node --version 2>$null
if ($node) {
    Write-Host "[OK] Node.js $node" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] Node.js not found" -ForegroundColor Red
}

# Check dependencies
Write-Host "`nDependencies:" -ForegroundColor Yellow
if (Test-Path "$root\backend\node_modules") {
    Write-Host "[OK] Backend dependencies" -ForegroundColor Green
}
else {
    Write-Host "[MISSING] Backend dependencies" -ForegroundColor Red
}

if (Test-Path "$root\frontend\node_modules") {
    Write-Host "[OK] Frontend dependencies" -ForegroundColor Green
}
else {
    Write-Host "[MISSING] Frontend dependencies" -ForegroundColor Red
}

if (Test-Path "$root\sdk\node_modules") {
    Write-Host "[OK] SDK dependencies" -ForegroundColor Green
}
else {
    Write-Host "[MISSING] SDK dependencies" -ForegroundColor Red
}

# Check critical files
Write-Host "`nCritical Files:" -ForegroundColor Yellow

$files = @(
    "backend\.env",
    "backend\routes\vip.routes.js",
    "backend\routes\bezcoin-moonpay.routes.js",
    "backend\routes\vinted.routes.js",
    "backend\models\VIPSubscription.model.js",
    "backend\models\BEZCoinTransaction.model.js",
    "backend\models\VintedListing.model.js",
    "backend\models\LogisticsShipment.model.js",
    "frontend\src\pages\VIPPanel.jsx",
    "sdk\bezhas-enterprise-sdk.js"
)

foreach ($file in $files) {
    if (Test-Path "$root\$file") {
        $name = Split-Path $file -Leaf
        Write-Host "[OK] $name" -ForegroundColor Green
    }
    else {
        Write-Host "[MISSING] $file" -ForegroundColor Red
    }
}

# Check services
Write-Host "`nServices:" -ForegroundColor Yellow

function Test-Port {
    param($Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", $Port)
        $tcp.Close()
        return $true
    }
    catch {
        return $false
    }
}

if (Test-Port 3001) {
    Write-Host "[RUNNING] Backend on port 3001" -ForegroundColor Green
}
else {
    Write-Host "[STOPPED] Backend not running" -ForegroundColor Yellow
}

if (Test-Port 3000) {
    Write-Host "[RUNNING] Frontend on port 3000" -ForegroundColor Green
}
else {
    Write-Host "[STOPPED] Frontend not running" -ForegroundColor Yellow
}

# MongoDB
$mongo = Get-Process mongod -ErrorAction SilentlyContinue
if ($mongo) {
    Write-Host "[RUNNING] MongoDB (PID: $($mongo.Id))" -ForegroundColor Green
}
else {
    Write-Host "[INFO] MongoDB not detected locally (may use Atlas)" -ForegroundColor Cyan
}

Write-Host "`n====================================`n" -ForegroundColor Cyan
Write-Host "Quick Commands:" -ForegroundColor Yellow
Write-Host "  Start all: scripts\quick-start.ps1" -ForegroundColor White
Write-Host "  Backend: cd backend; pnpm start" -ForegroundColor White
Write-Host "  Frontend: cd frontend; pnpm start" -ForegroundColor White
Write-Host "  SDK Test: cd sdk; node test-enterprise-sdk.js" -ForegroundColor White
Write-Host "`n"
