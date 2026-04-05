# Script para arrancar BeZhas en modo simple (sin Web3)
# Este script arranca backend y frontend en ventanas separadas

Write-Host "Iniciando BeZhas (Modo Simple - Sin Web3)..." -ForegroundColor Green

# Matar procesos node existentes
Write-Host "Deteniendo procesos existentes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Ruta base
$basePath = "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"

# Arrancar Backend
Write-Host "`nArrancando Backend en puerto 3001..." -ForegroundColor Cyan
$backendPath = Join-Path $basePath "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend BeZhas' -ForegroundColor Green; npm start" -WindowStyle Normal

# Esperar 5 segundos antes de arrancar frontend
Start-Sleep -Seconds 5

# Arrancar Frontend
Write-Host "Arrancando Frontend en puerto 5173..." -ForegroundColor Cyan
$frontendPath = Join-Path $basePath "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend BeZhas' -ForegroundColor Green; npm run dev" -WindowStyle Normal

Write-Host "`nServidores iniciados!" -ForegroundColor Green
Write-Host "`nAccede a:" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "`nPuedes ver los logs en las ventanas separadas." -ForegroundColor Yellow
