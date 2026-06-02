<#
.SYNOPSIS
  Launcher script for the entire BeZhas Blockchain Ecosystem.
.DESCRIPTION
  This script uses pnpm and turbo to start all 7 secondary apps in parallel.
  It also waits a few seconds and then displays the port mapping for quick access.
#>

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "   🚀 INICIANDO BEZHAS BLOCKCHAIN ECOSYSTEM (7 APPS)" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Iniciando TurboRepo en modo paralelo..." -ForegroundColor Yellow
Write-Host ""

# Start the dev:all command in a new window so the terminal isn't blocked
Start-Process -FilePath "pnpm" -ArgumentList "run dev:all" -NoNewWindow

Start-Sleep -Seconds 3

Write-Host "=========================================================" -ForegroundColor Green
Write-Host "✅ Servicios inicializándose en los siguientes puertos:" -ForegroundColor Green
Write-Host ""
Write-Host "  👉 3010 - BeZhas Wallet"
Write-Host "  👉 3011 - Gas Tank Manager"
Write-Host "  👉 3012 - Edge Node Manager"
Write-Host "  👉 3013 - Vision Scan"
Write-Host "  👉 3014 - BZ Capital (DeFi)"
Write-Host "  👉 3015 - BZ Prestige (Retail)"
Write-Host "  👉 3016 - BZ CargoLink"
Write-Host ""
Write-Host "  ⚙️ Hub / API Gateway (si aplica) en 3000/3001"
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "Para detener todos los servicios, presiona Ctrl+C en esta terminal." -ForegroundColor DarkGray
