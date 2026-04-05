# BeZhas - Inicio Completo de Servicios
# Este script inicia Hardhat, Backend y Frontend en paralelo

Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     BeZhas Web3 - Sistema de Inicio Completo          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Función para verificar si un puerto está en uso
function Test-Port {
    param($Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    return $connection
}

# Verificar servicios previos
Write-Host "📊 Verificando puertos disponibles..." -ForegroundColor Yellow
$services = @(
    @{Name="Hardhat"; Port=8545},
    @{Name="Backend"; Port=3001},
    @{Name="Frontend"; Port=5173}
)

foreach ($svc in $services) {
    if (Test-Port -Port $svc.Port) {
        Write-Host "⚠️  Puerto $($svc.Port) ($($svc.Name)) ya está en uso" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Puerto $($svc.Port) ($($svc.Name)) disponible" -ForegroundColor Green
    }
}

Write-Host "`n🚀 Iniciando servicios en segundo plano...`n" -ForegroundColor Cyan

# Terminal 1: Hardhat Node
Write-Host "1️⃣  Iniciando Hardhat Local Node (Puerto 8545)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host '⛓️  HARDHAT NODE' -ForegroundColor Magenta; npx hardhat node" -WindowStyle Normal

Start-Sleep -Seconds 8

# Terminal 2: Backend
Write-Host "2️⃣  Iniciando Backend API (Puerto 3001)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host '🔧 BACKEND API' -ForegroundColor Blue; pnpm run start" -WindowStyle Normal

Start-Sleep -Seconds 5

# Terminal 3: Frontend
Write-Host "3️⃣  Iniciando Frontend Vite (Puerto 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host '🎨 FRONTEND VITE' -ForegroundColor Green; pnpm run dev" -WindowStyle Normal

Write-Host "`n⏳ Esperando a que los servicios inicien..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║            Estado Final de los Servicios               ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

foreach ($svc in $services) {
    if (Test-Port -Port $svc.Port) {
        Write-Host "✅ $($svc.Name) - http://localhost:$($svc.Port)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($svc.Name) - No está ejecutándose" -ForegroundColor Red
    }
}

Write-Host "`n📝 URLs de Acceso:" -ForegroundColor Cyan
Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:   http://localhost:3001" -ForegroundColor White
Write-Host "   Hardhat:   http://localhost:8545" -ForegroundColor White

Write-Host "`n💡 Próximos Pasos:" -ForegroundColor Yellow
Write-Host "   1. Despliega los contratos: npx hardhat run scripts/deploy-quality-oracle.js --network localhost" -ForegroundColor White
Write-Host "   2. Abre el navegador: http://localhost:5173" -ForegroundColor White
Write-Host "   3. Conecta MetaMask a localhost:8545" -ForegroundColor White

Write-Host "`n✅ Todos los servicios iniciados correctamente`n" -ForegroundColor Green
