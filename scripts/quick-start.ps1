# Quick Start Script - Inicia Backend y Frontend
$projectRoot = "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   BeZhas Quick Start - Iniciando servicios...      " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar MongoDB
Write-Host "Verificando MongoDB..." -ForegroundColor Yellow
$mongoProcess = Get-Process mongod -ErrorAction SilentlyContinue
if (-not $mongoProcess) {
    Write-Host "MongoDB no detectado localmente. Asegurate de tener MongoDB Atlas configurado." -ForegroundColor Yellow
}

# Iniciar Backend
Write-Host ""
Write-Host "Iniciando Backend en nueva ventana..." -ForegroundColor Green
$backendCmd = "cd '$projectRoot\backend'; Write-Host 'BeZhas Backend Server - Port 3001' -ForegroundColor Cyan; pnpm run start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Write-Host "Esperando 5 segundos para que el backend inicie..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Iniciar Frontend
Write-Host ""
Write-Host "Iniciando Frontend en nueva ventana..." -ForegroundColor Green
$frontendCmd = "cd '$projectRoot\frontend'; Write-Host 'BeZhas Frontend App - Port 3000' -ForegroundColor Cyan; pnpm run start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Servicios iniciados en ventanas separadas:" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  Documentacion: Ver docs/PROXIMOS_PASOS.md" -ForegroundColor Green
Write-Host "  Tests SDK: cd sdk; node test-enterprise-sdk.js" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  Para detener: Cierra las ventanas de PowerShell" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
