# Script para desplegar BEZ Token en Amoy
Write-Host ""
Write-Host "Desplegando BEZ Token en Polygon Amoy..." -ForegroundColor Cyan

$scriptPath = "scripts\deploy-bez-simple.js"
$network = "amoy"

Set-Location -Path "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"

if (Test-Path $scriptPath) {
    Write-Host "Script encontrado" -ForegroundColor Green
} else {
    Write-Host "Script no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "Ejecutando deployment..." -ForegroundColor Yellow
& pnpm exec hardhat run $scriptPath --network $network

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment completado!" -ForegroundColor Green
} else {
    Write-Host "Error en deployment" -ForegroundColor Red
}

Write-Host ""
