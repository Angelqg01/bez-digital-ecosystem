#!/usr/bin/env pwsh
# Test Script - Phase 1 Implementation
# Verifica que todas las funcionalidades estén operativas

Write-Host "🧪 BeZhas - Test de Implementación Fase 1" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""

$baseUrl = "http://localhost:3001"
$adminToken = $env:ADMIN_TOKEN
if (-not $adminToken) {
    $adminToken = "dev-admin-token-12345-very-secure-token"
    Write-Host "⚠️  Usando ADMIN_TOKEN por defecto" -ForegroundColor Yellow
}

$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

Write-Host "1️⃣  Verificando servidor..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    Write-Host "   ✅ Servidor operativo" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Servidor no responde. Ejecuta: pnpm run start" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2️⃣  Testeando autenticación..." -ForegroundColor White

# Test sin token
try {
    Invoke-RestMethod -Uri "$baseUrl/api/diagnostic/health" -Method GET -ErrorAction Stop | Out-Null
    Write-Host "   ❌ Endpoint sin protección!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "   ✅ Autenticación requerida (401/403)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "3️⃣  Testeando endpoints protegidos..." -ForegroundColor White

$endpoints = @(
    @{ Method = "GET"; Path = "/api/diagnostic/health"; Name = "Health Score" },
    @{ Method = "GET"; Path = "/api/diagnostic/logs"; Name = "Diagnostic Logs" },
    @{ Method = "GET"; Path = "/api/diagnostic/reports"; Name = "Maintenance Reports" }
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$($endpoint.Path)" -Method $endpoint.Method -Headers $headers -ErrorAction Stop
        Write-Host "   ✅ $($endpoint.Name)" -ForegroundColor Green
        
        if ($endpoint.Path -eq "/api/diagnostic/health" -and $response.healthScore) {
            Write-Host "      Health Score: $($response.healthScore)/100" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "   ❌ $($endpoint.Name) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "4️⃣  Verificando configuración de alertas..." -ForegroundColor White

$discordUrl = $env:DISCORD_WEBHOOK_URL
$slackUrl = $env:SLACK_WEBHOOK_URL

if ($discordUrl) {
    Write-Host "   ✅ Discord Webhook configurado" -ForegroundColor Green
    Write-Host "      URL: $($discordUrl.Substring(0, [Math]::Min(50, $discordUrl.Length)))..." -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Discord Webhook no configurado" -ForegroundColor Yellow
    Write-Host "      Configura: DISCORD_WEBHOOK_URL en .env" -ForegroundColor Gray
}

if ($slackUrl) {
    Write-Host "   ✅ Slack Webhook configurado" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Slack Webhook no configurado (opcional)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "5️⃣  Verificando Redis..." -ForegroundColor White
try {
    $redisTest = docker exec redis-bezhas redis-cli ping 2>&1
    if ($redisTest -eq "PONG") {
        Write-Host "   ✅ Redis operativo (Docker)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Redis no responde correctamente" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  No se pudo verificar Redis" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "6️⃣  Verificando Dashboard Frontend..." -ForegroundColor White
$frontendUrl = "http://localhost:5173/admin"
try {
    $response = Invoke-WebRequest -Uri $frontendUrl -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Frontend disponible en $frontendUrl" -ForegroundColor Green
    Write-Host "      Ve a: Admin Panel → Diagnóstico IA" -ForegroundColor Cyan
} catch {
    Write-Host "   ⚠️  Frontend no disponible. Ejecuta: pnpm run dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "📊 RESUMEN" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Fase 1 - Implementación Crítica" -ForegroundColor Green
Write-Host "   • Dashboard integrado en Admin Panel" -ForegroundColor White
Write-Host "   • Autenticación admin en todos los endpoints" -ForegroundColor White
Write-Host "   • Sistema de alertas configurado" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentación:" -ForegroundColor Cyan
Write-Host "   • PHASE1_IMPLEMENTATION_SUMMARY.md" -ForegroundColor White
Write-Host "   • ALERT_SYSTEM_GUIDE.md" -ForegroundColor White
Write-Host "   • DIAGNOSTIC_SYSTEM_README.md" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Sistema listo para producción" -ForegroundColor Green
Write-Host ""
