Write-Host "`n" -NoNewline
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "                                                                               " -ForegroundColor Cyan
Write-Host "                  SISTEMA BEZ-COIN - BEZHAS WEB3                               " -ForegroundColor Cyan
Write-Host "                                                                               " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan

$OFFICIAL_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"

Write-Host "`nCONTRATO BEZ-COIN OFICIAL" -ForegroundColor Green
Write-Host "-------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  Direccion:  " -NoNewline -ForegroundColor White
Write-Host $OFFICIAL_CONTRACT -ForegroundColor Cyan
Write-Host "  Network:    " -NoNewline -ForegroundColor White
Write-Host "Polygon Amoy Testnet (ChainID 80002)" -ForegroundColor Yellow
Write-Host "  Status:     " -NoNewline -ForegroundColor White
Write-Host "PRODUCCION - INMUTABLE" -ForegroundColor Red
Write-Host "  Explorer:   " -NoNewline -ForegroundColor White
Write-Host "https://amoy.polygonscan.com/address/$OFFICIAL_CONTRACT" -ForegroundColor Blue

Write-Host "`nCOMANDOS DISPONIBLES" -ForegroundColor Green
Write-Host "-------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  pnpm run " -NoNewline -ForegroundColor White
Write-Host "bez:info      " -NoNewline -ForegroundColor Cyan
Write-Host "Ver informacion del contrato BEZ" -ForegroundColor Gray

Write-Host "  pnpm run " -NoNewline -ForegroundColor White
Write-Host "bez:verify    " -NoNewline -ForegroundColor Cyan
Write-Host "Verificar configuracion del sistema" -ForegroundColor Gray

Write-Host "  pnpm run " -NoNewline -ForegroundColor White
Write-Host "dev:up        " -NoNewline -ForegroundColor Cyan
Write-Host "Iniciar servicios (Docker)" -ForegroundColor Gray

Write-Host "  pnpm run " -NoNewline -ForegroundColor White
Write-Host "start:backend " -NoNewline -ForegroundColor Cyan
Write-Host "Iniciar backend manualmente" -ForegroundColor Gray

Write-Host "`nDOCUMENTACION" -ForegroundColor Green
Write-Host "-------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  - " -NoNewline -ForegroundColor Yellow
Write-Host "CONTRATO_OFICIAL_BEZ.md         " -NoNewline -ForegroundColor Cyan
Write-Host "Contrato oficial" -ForegroundColor Gray

Write-Host "  - " -NoNewline -ForegroundColor Yellow
Write-Host "ESTADO_SISTEMA_COMPRAVENTA.md   " -NoNewline -ForegroundColor Cyan
Write-Host "Estado del sistema" -ForegroundColor Gray

Write-Host "  - " -NoNewline -ForegroundColor Yellow
Write-Host "scripts/README_BEZ_CONTRACT.md  " -NoNewline -ForegroundColor Cyan
Write-Host "Guia de desarrollo" -ForegroundColor Gray

Write-Host "`nINICIO RAPIDO" -ForegroundColor Green
Write-Host "-------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  1. " -NoNewline -ForegroundColor White
Write-Host "Verificar sistema:  " -NoNewline -ForegroundColor Gray
Write-Host "pnpm run bez:verify" -ForegroundColor Cyan

Write-Host "  2. " -NoNewline -ForegroundColor White
Write-Host "Iniciar servicios:  " -NoNewline -ForegroundColor Gray
Write-Host "pnpm run dev:up" -ForegroundColor Cyan

Write-Host "  3. " -NoNewline -ForegroundColor White
Write-Host "Ver logs:           " -NoNewline -ForegroundColor Gray
Write-Host "pnpm run dev:logs" -ForegroundColor Cyan

Write-Host "`nIMPORTANTE" -ForegroundColor Red
Write-Host "-------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  NO crear nuevos contratos BEZ-Coin" -ForegroundColor Red
Write-Host "  NO modificar el contrato oficial" -ForegroundColor Red
Write-Host "  Usar siempre: $OFFICIAL_CONTRACT" -ForegroundColor Green

Write-Host "`n===============================================================================" -ForegroundColor Cyan
Write-Host "  Sistema configurado y listo. Lee la documentacion antes de comenzar." -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
