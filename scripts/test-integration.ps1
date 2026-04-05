# Test de Integración Blockchain - BeZhas
# Este script inicia el backend si no está corriendo y ejecuta los tests

Write-Host "`n🚀 BeZhas Blockchain Integration Test`n" -ForegroundColor Cyan

# Verificar si el backend ya está corriendo
Write-Host "📡 Verificando si el backend está activo..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    Write-Host "✅ Backend ya está corriendo en puerto 5000`n" -ForegroundColor Green
    $backendRunning = $true
} catch {
    Write-Host "⚠️  Backend no está corriendo, necesitas iniciarlo primero`n" -ForegroundColor Yellow
    $backendRunning = $false
}

if (-not $backendRunning) {
    Write-Host "Para iniciar el backend, ejecuta en otra terminal:" -ForegroundColor Cyan
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  pnpm start`n" -ForegroundColor White
    
    $continue = Read-Host "¿Deseas continuar con los tests de todas formas? (y/n)"
    if ($continue -ne 'y') {
        Write-Host "`n❌ Tests cancelados`n" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n🧪 Ejecutando tests de integración blockchain...`n" -ForegroundColor Cyan

# Ejecutar el script de test
node test-blockchain-integration.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Todos los tests pasaron exitosamente`n" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Algunos tests fallaron. Revisa los errores arriba.`n" -ForegroundColor Yellow
}

# Resumen final
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n📚 Documentación disponible:`n" -ForegroundColor Blue
Write-Host "  • BLOCKCHAIN_INTEGRATION_COMPLETE.md - Documentación técnica completa" -ForegroundColor White
Write-Host "  • BLOCKCHAIN_QUICK_START.md - Guía rápida de activación" -ForegroundColor White
Write-Host "  • INTEGRATION_GUIDE.md - Guía paso a paso" -ForegroundColor White
Write-Host "  • DEPLOYMENT_SUMMARY.md - Resumen de contratos desplegados`n" -ForegroundColor White

Write-Host "🔗 Endpoints API disponibles:" -ForegroundColor Blue
Write-Host "  GET  /api/blockchain/contracts" -ForegroundColor White
Write-Host "  GET  /api/blockchain/balance/:address" -ForegroundColor White
Write-Host "  GET  /api/blockchain/admin/check/:address" -ForegroundColor White
Write-Host "  GET  /api/blockchain/vendor/check/:address" -ForegroundColor White
Write-Host "  GET  /api/blockchain/marketplace/products/count" -ForegroundColor White
Write-Host "  POST /api/blockchain/test/connection" -ForegroundColor White
Write-Host "  POST /api/blockchain/rewards/distribute`n" -ForegroundColor White

exit $LASTEXITCODE
