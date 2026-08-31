#!/usr/bin/env pwsh
# Script para iniciar el Backend de BeZhas
# Compatible con PowerShell 5.x y superior

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Iniciando Backend de BeZhas" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Cambiar al directorio backend
Set-Location -Path "backend"

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

# Iniciar el servidor
Write-Host ""
Write-Host "Iniciando servidor backend en http://localhost:3001" -ForegroundColor Green
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""

pnpm start
