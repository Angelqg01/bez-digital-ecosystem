# Verificador Rápido de Gas
# Uso: .\check-gas.ps1

$response = Invoke-RestMethod -Method Post -Uri "https://polygon-rpc.com" `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}' `
  -ErrorAction Stop

$gasPriceWei = [bigint]::Parse($response.result.TrimStart('0x'), 'AllowHexSpecifier')
$gasPriceGwei = [Math]::Round([decimal]$gasPriceWei / 1000000000, 2)

Write-Host "`n⛽ Gas Price Actual: $gasPriceGwei Gwei" -ForegroundColor Cyan

if ($gasPriceGwei -lt 50) {
    Write-Host "✅ ÓPTIMO - Momento ideal para desplegar`n" -ForegroundColor Green
    Write-Host "Ejecuta:" -ForegroundColor Yellow
    Write-Host "  node scripts/deploy-quality-oracle-direct.js`n"
} elseif ($gasPriceGwei -lt 80) {
    Write-Host "🟡 ACEPTABLE - Puedes desplegar, pero podrías esperar mejor momento`n" -ForegroundColor Yellow
} else {
    Write-Host "❌ ALTO - Recomendado esperar`n" -ForegroundColor Red
    Write-Host "Sugerencia: Intenta en horario 02:00-06:00 UTC" -ForegroundColor DarkGray
}

# Verificar balance también
Write-Host "Verificando balance..." -ForegroundColor DarkGray
$balanceResponse = Invoke-RestMethod -Method Post -Uri "https://polygon-rpc.com" `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x52Df82920CBAE522880dD7657e43d1A754eD044E","latest"],"id":1}' `
  -ErrorAction Stop

$balanceWei = [bigint]::Parse($balanceResponse.result.TrimStart('0x'), 'AllowHexSpecifier')
$balanceMatic = [Math]::Round([decimal]$balanceWei / 1e18, 4)

Write-Host "💰 Balance: $balanceMatic MATIC`n" -ForegroundColor Cyan
