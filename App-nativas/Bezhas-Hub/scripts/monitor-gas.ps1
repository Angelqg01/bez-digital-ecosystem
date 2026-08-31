# Monitor de Gas de Polygon
# Uso: .\monitor-gas.ps1

Write-Host "`n🔍 Monitor de Gas - Polygon Mainnet" -ForegroundColor Cyan
Write-Host "=" * 50
Write-Host "Objetivo: Gas Price < 50 Gwei"
Write-Host "Presiona Ctrl+C para detener`n"

$targetGwei = 50
$checkCount = 0

while ($true) {
    $checkCount++
    
    try {
        $response = Invoke-RestMethod -Method Post -Uri "https://polygon-rpc.com" `
          -ContentType "application/json" `
          -Body '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}' `
          -ErrorAction Stop
        
        if ($response.result) {
            $gasPriceWei = [bigint]::Parse($response.result.TrimStart('0x'), 'AllowHexSpecifier')
            $gasPriceGwei = [Math]::Round([decimal]$gasPriceWei / 1000000000, 2)
            
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host "[$timestamp] Check #$checkCount - Gas: $gasPriceGwei Gwei" -NoNewline
            
            if ($gasPriceGwei -lt 50) {
                Write-Host " ✅ ÓPTIMO - ¡DESPLEGAR AHORA!" -ForegroundColor Green
                Write-Host "`n🚀 Ejecuta: node scripts/deploy-quality-oracle-direct.js`n" -ForegroundColor Yellow
                
                # Sonido de alerta (opcional)
                [Console]::Beep(1000, 500)
                Start-Sleep -Seconds 2
                [Console]::Beep(1000, 500)
                
            } elseif ($gasPriceGwei -lt 80) {
                Write-Host " 🟡 Aceptable" -ForegroundColor Yellow
            } else {
                Write-Host " ❌ Alto - Esperando..." -ForegroundColor Red
            }
            
            # Mostrar tendencia cada 5 checks
            if ($checkCount % 5 -eq 0) {
                Write-Host "`n📊 Mejor hora típica: 02:00-06:00 UTC (Madrugada América)" -ForegroundColor DarkGray
            }
        }
    }
    catch {
        Write-Host "⚠️ Error al consultar RPC, reintentando..." -ForegroundColor DarkYellow
    }
    
    # Verificar cada 60 segundos
    Start-Sleep -Seconds 60
}
