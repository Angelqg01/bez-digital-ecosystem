#!/usr/bin/env pwsh
# Script para iniciar Backend y Frontend simultáneamente
# Compatible con PowerShell 5.x y superior

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando BeZhas (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que existen los directorios
if (-not (Test-Path "backend")) {
    Write-Host "Error: No se encontro el directorio 'backend'" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend")) {
    Write-Host "Error: No se encontro el directorio 'frontend'" -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando Backend en nueva ventana..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; .\start-backend.ps1"

# Esperar 3 segundos
Start-Sleep -Seconds 3

Write-Host "Iniciando Frontend en nueva ventana..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; .\start-frontend.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Servicios iniciados!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para detener los servicios, cierra las ventanas de PowerShell" -ForegroundColor Yellow
Write-Host ""
