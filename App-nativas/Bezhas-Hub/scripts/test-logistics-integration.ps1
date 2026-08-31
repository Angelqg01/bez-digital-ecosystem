# Test de Creación de Envío con Privacidad

Write-Host "🧪 Iniciando test de integración de logística..." -ForegroundColor Cyan

# 1. Verificar que el backend esté corriendo
Write-Host "`n📡 Verificando conexión con backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/shipments" -Method GET
    Write-Host "✅ Backend respondiendo correctamente ($($health.Count) envíos en la base de datos)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error: Backend no responde en puerto 3001" -ForegroundColor Red
    exit 1
}

# 2. Crear envío de prueba con privacidad "members"
Write-Host "`n📦 Creando nuevo envío con privacidad 'members'..." -ForegroundColor Yellow

$testShipment = @{
    origin      = "Valencia, ES"
    destination = "Munich, DE"
    cargoType   = "Componentes Electrónicos"
    weight      = "750kg"
    payout      = 200
    visibility  = "members"
    accessFee   = 75
    shipper     = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}

$jsonBody = $testShipment | ConvertTo-Json

try {
    $newShipment = Invoke-RestMethod `
        -Uri "http://localhost:3001/api/logistics/create" `
        -Method POST `
        -Body $jsonBody `
        -ContentType "application/json"
    
    Write-Host "✅ Envío creado exitosamente!" -ForegroundColor Green
    Write-Host "   ID: $($newShipment.id)" -ForegroundColor White
    Write-Host "   Ruta: $($newShipment.origin) → $($newShipment.destination)" -ForegroundColor White
    Write-Host "   Estado: $($newShipment.status)" -ForegroundColor White
    Write-Host "   Privacidad: $($newShipment.visibility)" -ForegroundColor White
    Write-Host "   Tarifa de Acceso: $($newShipment.accessFee) BEZ" -ForegroundColor White
    
}
catch {
    Write-Host "❌ Error al crear envío: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Verificar que el envío se agregó correctamente
Write-Host "`n🔍 Verificando lista de envíos actualizada..." -ForegroundColor Yellow

try {
    $allShipments = Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/shipments" -Method GET
    $foundShipment = $allShipments | Where-Object { $_.id -eq $newShipment.id }
    
    if ($foundShipment) {
        Write-Host "✅ Envío encontrado en la base de datos" -ForegroundColor Green
        Write-Host "   Total de envíos en el sistema: $($allShipments.Count)" -ForegroundColor White
    }
    else {
        Write-Host "⚠️ Advertencia: Envío no encontrado en la lista" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error al verificar envíos" -ForegroundColor Red
}

# 4. Crear envío público para comparación
Write-Host "`n📦 Creando envío público para comparación..." -ForegroundColor Yellow

$publicShipment = @{
    origin      = "Madrid, ES"
    destination = "Lisboa, PT"
    cargoType   = "Textiles"
    weight      = "300kg"
    payout      = 120
    visibility  = "public"
    accessFee   = 0
    shipper     = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}

try {
    $newPublic = Invoke-RestMethod `
        -Uri "http://localhost:3001/api/logistics/create" `
        -Method POST `
        -Body ($publicShipment | ConvertTo-Json) `
        -ContentType "application/json"
    
    Write-Host "✅ Envío público creado (ID: $($newPublic.id))" -ForegroundColor Green
}
catch {
    Write-Host "⚠️ Error al crear envío público" -ForegroundColor Yellow
}

# 5. Resumen final
Write-Host "`n📊 Resumen del Test:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$finalList = Invoke-RestMethod -Uri "http://localhost:3001/api/logistics/shipments" -Method GET

Write-Host "Total de envíos: $($finalList.Count)" -ForegroundColor White
Write-Host "`nDesglose por privacidad:" -ForegroundColor White

$publicCount = ($finalList | Where-Object { $_.visibility -eq 'public' }).Count
$privateCount = ($finalList | Where-Object { $_.visibility -eq 'private' }).Count
$membersCount = ($finalList | Where-Object { $_.visibility -eq 'members' }).Count

Write-Host "  🌍 Públicos: $publicCount" -ForegroundColor Green
Write-Host "  🔒 Privados: $privateCount" -ForegroundColor Red
Write-Host "  👥 Solo Miembros: $membersCount" -ForegroundColor Yellow

Write-Host "`n✨ Test completado exitosamente!" -ForegroundColor Cyan
Write-Host "Puedes ver los cambios en: http://localhost:5173/create" -ForegroundColor White
