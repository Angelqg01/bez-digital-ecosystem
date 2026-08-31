# Script para verificar que el contrato BEZ oficial está configurado correctamente

Write-Host "`n================================================================================" -ForegroundColor Gray
Write-Host "VERIFICACIÓN DEL CONTRATO BEZ-COIN OFICIAL" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Gray

$OFFICIAL_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"

Write-Host "`nContrato Oficial: $OFFICIAL_CONTRACT" -ForegroundColor Cyan
Write-Host "Network: Polygon Amoy (ChainID 80002)" -ForegroundColor White
Write-Host "Explorer: https://amoy.polygonscan.com/address/$OFFICIAL_CONTRACT" -ForegroundColor Gray

Write-Host "`n================================================================================" -ForegroundColor Gray
Write-Host "VERIFICANDO ARCHIVOS DE CONFIGURACIÓN" -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Gray

$allCorrect = $true

# Verificar .env raíz
Write-Host "`nVerificando .env (raíz)..." -ForegroundColor Cyan
if (Test-Path ".env") {
    $content = Get-Content ".env" -Raw
    if ($content -match "BEZCOIN_CONTRACT_ADDRESS.*$OFFICIAL_CONTRACT") {
        Write-Host "  ✅ Correcto" -ForegroundColor Green
    } else {
        Write-Host "  ❌ INCORRECTO - Actualizar a: $OFFICIAL_CONTRACT" -ForegroundColor Red
        $allCorrect = $false
    }
} else {
    Write-Host "  ⚠️  Archivo no encontrado" -ForegroundColor Yellow
}

# Verificar backend/.env
Write-Host "`nVerificando backend/.env..." -ForegroundColor Cyan
if (Test-Path "backend\.env") {
    $content = Get-Content "backend\.env" -Raw
    if ($content -match "BEZCOIN.*ADDRESS.*$OFFICIAL_CONTRACT") {
        Write-Host "  ✅ Correcto" -ForegroundColor Green
    } else {
        Write-Host "  ❌ INCORRECTO - Actualizar a: $OFFICIAL_CONTRACT" -ForegroundColor Red
        $allCorrect = $false
    }
} else {
    Write-Host "  ⚠️  Archivo no encontrado" -ForegroundColor Yellow
}

# Verificar frontend/.env
Write-Host "`nVerificando frontend/.env..." -ForegroundColor Cyan
if (Test-Path "frontend\.env") {
    $content = Get-Content "frontend\.env" -Raw
    if ($content -match "VITE_BEZCOIN_CONTRACT_ADDRESS.*$OFFICIAL_CONTRACT") {
        Write-Host "  ✅ Correcto" -ForegroundColor Green
    } else {
        Write-Host "  ❌ INCORRECTO - Actualizar a: $OFFICIAL_CONTRACT" -ForegroundColor Red
        $allCorrect = $false
    }
} else {
    Write-Host "  ⚠️  Archivo no encontrado" -ForegroundColor Yellow
}

Write-Host "`n================================================================================" -ForegroundColor Gray

if ($allCorrect) {
    Write-Host "✅ VERIFICACIÓN EXITOSA" -ForegroundColor Green
    Write-Host "   Todos los archivos usan el contrato oficial correcto." -ForegroundColor White
} else {
    Write-Host "❌ VERIFICACIÓN FALLIDA" -ForegroundColor Red
    Write-Host "   Algunos archivos necesitan actualización." -ForegroundColor Yellow
    Write-Host "`n   Ejecuta: node scripts/verify-contract-address.js" -ForegroundColor White
    Write-Host "   O actualiza manualmente los archivos .env" -ForegroundColor White
}

Write-Host "`n📚 Documentación: Ver CONTRATO_OFICIAL_BEZ.md" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Gray
Write-Host ""
