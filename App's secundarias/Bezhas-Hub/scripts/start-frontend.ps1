#!/usr/bin/env pwsh
# Script para iniciar el Frontend de BeZhas
# Compatible con PowerShell 5.x y superior

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Iniciando Frontend de BeZhas" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Cambiar al directorio frontend
Set-Location -Path "frontend"

# Verificar si existe node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error al instalar dependencias" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

# Iniciar el servidor de desarrollo
Write-Host ""
Write-Host "Iniciando servidor frontend en http://localhost:5173" -ForegroundColor Green
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""

pnpm run dev
