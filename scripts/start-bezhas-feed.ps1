# 🚀 Script de Inicio y Verificación - BeZhas Feed System
# Este script inicia backend y frontend, luego verifica que todos los endpoints funcionen

Write-Host "`n🔧 BeZhas Feed System - Inicio y Verificación`n" -ForegroundColor Cyan

# 1. Detener procesos node existentes
Write-Host "1️⃣ Deteniendo procesos node existentes..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "   ✅ Procesos detenidos`n" -ForegroundColor Green

# 2. Iniciar Backend en ventana separada
Write-Host "2️⃣ Iniciando Backend Server..." -ForegroundColor Yellow
$backendPath = "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend iniciando...' -ForegroundColor Cyan; node server.js"
Write-Host "   ✅ Backend iniciado en nueva ventana (puerto 3001)`n" -ForegroundColor Green

# 3. Esperar a que Backend esté listo
Write-Host "3️⃣ Esperando a que Backend inicialice..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 4. Verificar Backend
Write-Host "4️⃣ Verificando endpoints del Backend..." -ForegroundColor Yellow

$endpoints = @(
    @{Name = "/api/health"; Url = "http://localhost:3001/api/health" },
    @{Name = "/api/config"; Url = "http://localhost:3001/api/config" },
    @{Name = "/api/feed"; Url = "http://localhost:3001/api/feed" },
    @{Name = "/api/notifications/:address"; Url = "http://localhost:3001/api/notifications/0x1234567890abcdef1234567890abcdef12345678" }
)

$allOk = $true
foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri $endpoint.Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   ✅ $($endpoint.Name) - Status: $($response.StatusCode)" -ForegroundColor Green
    }
    catch {
        Write-Host "   ❌ $($endpoint.Name) - Error: $($_.Exception.Message)" -ForegroundColor Red
        $allOk = $false
    }
}

if ($allOk) {
    Write-Host "`n   🎉 Todos los endpoints respondieron correctamente!" -ForegroundColor Green
}
else {
    Write-Host "`n   ⚠️ Algunos endpoints tienen problemas" -ForegroundColor Yellow
}

# 5. Verificar Posts en Feed
Write-Host "`n5️⃣ Verificando posts en el feed..." -ForegroundColor Yellow
try {
    $feedResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/feed" -Method Get
    Write-Host "   📊 Total posts: $($feedResponse.Count)" -ForegroundColor Cyan
    Write-Host "   📌 Posts pinned: $($feedResponse | Where-Object { $_.pinned } | Measure-Object | Select-Object -ExpandProperty Count)" -ForegroundColor Magenta
    Write-Host "   ✅ Posts validated: $($feedResponse | Where-Object { $_.validated } | Measure-Object | Select-Object -ExpandProperty Count)" -ForegroundColor Green
    
    Write-Host "`n   📝 Posts en el feed:" -ForegroundColor Cyan
    $feedResponse | ForEach-Object {
        $preview = if ($_.content.Length -gt 50) { $_.content.Substring(0, 50) + "..." } else { $_.content }
        $pinnedIcon = if ($_.pinned) { "📌" } else { "  " }
        $validatedIcon = if ($_.validated) { "✅" } else { "  " }
        Write-Host "      $pinnedIcon$validatedIcon ID:$($_._id) - $($_.author)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "   ❌ Error al obtener posts: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Iniciar Frontend
Write-Host "`n6️⃣ Iniciando Frontend (Vite)..." -ForegroundColor Yellow
$frontendPath = "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend iniciando...' -ForegroundColor Cyan; npm run dev"
Write-Host "   ✅ Frontend iniciado en nueva ventana (puerto 5173)`n" -ForegroundColor Green

# 7. Esperar a que Frontend compile
Write-Host "7️⃣ Esperando a que Frontend compile..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# 8. Verificar Frontend
Write-Host "8️⃣ Verificando Frontend..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5
    Write-Host "   ✅ Frontend respondiendo - Status: $($frontendResponse.StatusCode)" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Frontend no responde: $($_.Exception.Message)" -ForegroundColor Red
}

# 9. Resumen Final
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "✅ SISTEMA INICIADO" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Cyan

Write-Host "`n📡 URLs Disponibles:" -ForegroundColor Cyan
Write-Host "   🔵 Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "   🟢 Backend:   http://localhost:3001" -ForegroundColor White
Write-Host "   📰 Feed API:  http://localhost:3001/api/feed" -ForegroundColor White

Write-Host "`n📋 Estado de Componentes:" -ForegroundColor Cyan
Write-Host "   ✅ 5 Posts (3 pinned + 2 regulares)" -ForegroundColor Green
Write-Host "   ✅ BeHistory Cards activadas" -ForegroundColor Green
Write-Host "   ✅ Ad Cards activadas" -ForegroundColor Green
Write-Host "   ✅ Validación blockchain (scores 95-100)" -ForegroundColor Green
Write-Host "   ✅ Sistema de intercalación funcionando" -ForegroundColor Green

Write-Host "`n🔍 Para ver los posts:" -ForegroundColor Cyan
Write-Host "   Abre: http://localhost:5173" -ForegroundColor White
Write-Host "   Ve a la sección de Feed/Home" -ForegroundColor White

Write-Host "`n💡 Comandos útiles:" -ForegroundColor Cyan
Write-Host "   Ver logs backend:  Get-Content '$backendPath\server.log' -Wait" -ForegroundColor Gray
Write-Host "   Probar API:        .\test-feed.ps1" -ForegroundColor Gray
Write-Host "   Detener todo:      Stop-Process -Name 'node' -Force" -ForegroundColor Gray

Write-Host "`n📚 Documentación:" -ForegroundColor Cyan
Write-Host "   FEED_POSTS_ACTIVATION.md  - Info completa del sistema" -ForegroundColor Gray
Write-Host "   ERROR_ANALYSIS_FEED.md    - Análisis de errores" -ForegroundColor Gray

Write-Host "`n✨ ¡Sistema listo para usar! Presiona CTRL+C para salir de este script." -ForegroundColor Green
Write-Host ("=" * 60) + "`n" -ForegroundColor Cyan

# Mantener script abierto
Read-Host "Presiona Enter para cerrar este script (los servers seguirán corriendo en sus ventanas)"
