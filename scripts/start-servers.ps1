# Script para iniciar Backend y Frontend de BeZhas
Write-Host "Iniciando servidores BeZhas..." -ForegroundColor Cyan

# Iniciar Backend
Write-Host "Iniciando Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3\backend'; Write-Host 'Backend Server' -ForegroundColor Green; npm start"

# Esperar 5 segundos
Start-Sleep -Seconds 5

# Iniciar Frontend
Write-Host "Iniciando Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3\frontend'; Write-Host 'Frontend Server' -ForegroundColor Blue; npm run dev"

Write-Host "Servidores iniciados en nuevas ventanas" -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
