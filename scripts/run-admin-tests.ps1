# run-admin-tests.ps1
# Script para ejecutar los tests de paginas admin

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   BeZhas Admin Pages Test Runner" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Cambiar al directorio del proyecto
Set-Location "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"

# Verificar si los servidores estan corriendo
Write-Host "Verificando servidores..." -ForegroundColor Yellow

$frontendUp = Test-NetConnection -ComputerName localhost -Port 5173 -WarningAction SilentlyContinue
$backendUp = Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue

if ($frontendUp.TcpTestSucceeded) {
    Write-Host "[OK] Frontend disponible en http://localhost:5173" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] Frontend NO disponible" -ForegroundColor Red
    Write-Host "  Ejecuta en otra terminal: cd frontend; pnpm dev" -ForegroundColor Yellow
    exit 1
}

if ($backendUp.TcpTestSucceeded) {
    Write-Host "[OK] Backend disponible en http://localhost:3001" -ForegroundColor Green
}
else {
    Write-Host "[WARN] Backend NO disponible (algunos tests pueden fallar)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Ejecutando tests..." -ForegroundColor Cyan
Write-Host ""

# Ejecutar tests
node frontend/tests/admin-pages.test.js

$exitCode = $LASTEXITCODE
Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "[OK] Tests completados exitosamente" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] Algunos tests fallaron" -ForegroundColor Red
}

exit $exitCode
