# Script para esperar a que el frontend termine de compilar y abrir el navegador
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Esperando a que el frontend este listo..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 60
$attempt = 0
$url = "http://localhost:5173"

while ($attempt -lt $maxAttempts) {
    $attempt++
    
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -ErrorAction Stop
        
        # Frontend esta listo!
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  FRONTEND LISTO!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Abriendo navegador en $url..." -ForegroundColor Yellow
        Write-Host ""
        
        # Abrir el navegador
        Start-Process $url
        
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Sistema BeZhas completamente iniciado:" -ForegroundColor Green
        Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Cyan
        Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        exit 0
    }
    catch {
        # Aun no esta listo
        Write-Host "Intento $attempt/$maxAttempts - Esperando..." -ForegroundColor Gray
        Start-Sleep -Seconds 3
    }
}

# Timeout
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Timeout: Frontend no respondio despues de 3 minutos" -ForegroundColor Yellow
Write-Host "Verifica la ventana del frontend manualmente" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
