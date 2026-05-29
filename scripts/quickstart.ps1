# 🚀 BeZhas Security System - Quick Start

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🛡️  BeZhas Security System Setup" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Check Node.js installation
Write-Host "1️⃣  Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Node.js instalado: $nodeVersion`n" -ForegroundColor Green
}
else {
    Write-Host "   ❌ Node.js no encontrado. Instálalo desde https://nodejs.org`n" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "2️⃣  Instalando dependencias..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\scripts"
pnpm install
Write-Host "   ✅ Dependencias instaladas`n" -ForegroundColor Green

# Check .env file
Write-Host "3️⃣  Verificando configuración..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "DISCORD_WEBHOOK_URL=https://discord\.com/api/webhooks/") {
        Write-Host "   ✅ Webhook de Discord configurado`n" -ForegroundColor Green
        $webhookConfigured = $true
    }
    else {
        Write-Host "   ⚠️  Webhook de Discord NO configurado correctamente`n" -ForegroundColor Yellow
        $webhookConfigured = $false
    }
}
else {
    Write-Host "   ❌ Archivo .env no encontrado`n" -ForegroundColor Red
    $webhookConfigured = $false
}

# Test Discord connection if configured
if ($webhookConfigured) {
    Write-Host "4️⃣  Probando conexión Discord..." -ForegroundColor Yellow
    pnpm run test-discord
    Write-Host ""
}
else {
    Write-Host "4️⃣  Configurando Discord webhook..." -ForegroundColor Yellow
    Write-Host "`n   📝 ACCIÓN REQUERIDA:" -ForegroundColor Cyan
    Write-Host "   1. Únete al servidor: https://discord.gg/wrGJzP7tr" -ForegroundColor White
    Write-Host "   2. Configuración del Servidor > Integraciones > Webhooks" -ForegroundColor White
    Write-Host "   3. Crear Nuevo Webhook" -ForegroundColor White
    Write-Host "   4. Copiar URL del webhook" -ForegroundColor White
    Write-Host "   5. Editar scripts\.env y pegar la URL`n" -ForegroundColor White
    
    $continue = Read-Host "   ¿Ya configuraste el webhook? (s/n)"
    if ($continue -eq "s" -or $continue -eq "S") {
        pnpm run test-discord
    }
    Write-Host ""
}

# Offer to start sentinel
Write-Host "5️⃣  ¿Deseas iniciar el monitoreo continuo?" -ForegroundColor Yellow
Write-Host "   El sistema escaneará vulnerabilidades cada 12 horas" -ForegroundColor White
$startSentinel = Read-Host "   (s/n)"

if ($startSentinel -eq "s" -or $startSentinel -eq "S") {
    Write-Host "`n🚀 Iniciando Security Sentinel...`n" -ForegroundColor Green
    .\sentinel.ps1
}
else {
    Write-Host "`n📋 Comandos disponibles:" -ForegroundColor Cyan
    Write-Host "   cd scripts" -ForegroundColor White
    Write-Host "   .\sentinel.ps1              # Iniciar monitoreo continuo" -ForegroundColor White
    Write-Host "   .\sentinel.ps1 -Status      # Ver estado del servicio" -ForegroundColor White
    Write-Host "   .\sentinel.ps1 -Logs        # Ver logs en tiempo real" -ForegroundColor White
    Write-Host "   .\sentinel.ps1 -Stop        # Detener el servicio" -ForegroundColor White
    Write-Host "   pnpm run test-discord        # Probar Discord" -ForegroundColor White
    Write-Host "   pnpm run security-check      # Escaneo único" -ForegroundColor White
    Write-Host "   pnpm run full-audit          # Auditoría completa`n" -ForegroundColor White
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Setup completado" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "📚 Documentación completa: ACTIVATION_GUIDE.md`n" -ForegroundColor Yellow
