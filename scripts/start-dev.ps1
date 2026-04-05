# BeZhas Development Servers Starter
# Este script inicia backend y frontend en terminales separadas

Write-Host "Iniciando servidores BeZhas..." -ForegroundColor Cyan

# Matar procesos node existentes
Write-Host "Limpiando procesos anteriores..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Iniciar Backend en nueva ventana
Write-Host "Iniciando Backend (Puerto 3001)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm start"

# Esperar un poco para que el backend inicie
Start-Sleep -Seconds 5

# Iniciar Frontend en nueva ventana
Write-Host "Iniciando Frontend (Puerto 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "Servidores iniciados!" -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
