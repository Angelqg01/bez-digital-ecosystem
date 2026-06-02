# BeZhas Web3 Startup Script
Write-Host "Starting Services..." -ForegroundColor Cyan

# Kill existing Node processes
taskkill /F /IM node.exe 2>$null | Out-Null
Start-Sleep -Seconds 2

# Start Backend
Write-Host "Starting Backend Server..." -ForegroundColor Green
$backendPath = Join-Path $PSScriptRoot "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; pnpm start"

Start-Sleep -Seconds 5

# Start Frontend  
Write-Host "Starting Frontend Server..." -ForegroundColor Green
$frontendPath = Join-Path $PSScriptRoot "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; pnpm run dev"

Start-Sleep -Seconds 8

Write-Host ""
Write-Host "Servers Started!" -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor White
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "DeFi Governance: http://localhost:5173/defi-governance" -ForegroundColor Cyan
