# BeZhas Security Sentinel - Servicio de Monitoreo
# PowerShell script to start security monitoring as a background job

param(
    [switch]$Stop,
    [switch]$Status,
    [switch]$Logs
)

$ScriptPath = Join-Path $PSScriptRoot "securityNotifier.js"
$LogFile = Join-Path $PSScriptRoot "security-sentinel.log"
$JobName = "BeZhasSecuritySentinel"

if ($Stop) {
    Write-Host "⚠️  Deteniendo Security Sentinel..." -ForegroundColor Yellow
    Get-Job -Name $JobName -ErrorAction SilentlyContinue | Stop-Job
    Get-Job -Name $JobName -ErrorAction SilentlyContinue | Remove-Job
    Write-Host "✅ Security Sentinel detenido" -ForegroundColor Green
    exit
}

if ($Status) {
    $job = Get-Job -Name $JobName -ErrorAction SilentlyContinue
    if ($job) {
        Write-Host "📊 Estado del Security Sentinel:" -ForegroundColor Cyan
        Write-Host "   Estado: $($job.State)" -ForegroundColor White
        Write-Host "   ID: $($job.Id)" -ForegroundColor White
        Write-Host "   Iniciado: $($job.PSBeginTime)" -ForegroundColor White
        Write-Host "`n📝 Últimas 20 líneas del log:" -ForegroundColor Cyan
        if (Test-Path $LogFile) {
            Get-Content $LogFile -Tail 20
        }
        else {
            Write-Host "   No hay logs disponibles" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "❌ Security Sentinel no está ejecutándose" -ForegroundColor Red
    }
    exit
}

if ($Logs) {
    if (Test-Path $LogFile) {
        Write-Host "📝 Mostrando logs del Security Sentinel (Ctrl+C para salir):`n" -ForegroundColor Cyan
        Get-Content $LogFile -Wait
    }
    else {
        Write-Host "❌ No se encontró el archivo de log" -ForegroundColor Red
    }
    exit
}

# Start sentinel
Write-Host "🚀 Iniciando BeZhas Security Sentinel...`n" -ForegroundColor Green

# Check if already running
$existingJob = Get-Job -Name $JobName -ErrorAction SilentlyContinue
if ($existingJob) {
    Write-Host "⚠️  Security Sentinel ya está ejecutándose" -ForegroundColor Yellow
    Write-Host "   Usa 'sentinel.ps1 -Status' para ver el estado" -ForegroundColor White
    Write-Host "   Usa 'sentinel.ps1 -Stop' para detenerlo`n" -ForegroundColor White
    exit
}

# Create log file if it doesn't exist
if (-not (Test-Path $LogFile)) {
    New-Item -Path $LogFile -ItemType File -Force | Out-Null
}

# Start as background job
$job = Start-Job -Name $JobName -ScriptBlock {
    param($scriptPath, $logFile)
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$timestamp] Starting Security Sentinel..."
    
    & node $scriptPath 2>&1 | ForEach-Object {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $message = "[$timestamp] $_"
        Add-Content -Path $logFile -Value $message
        Write-Output $_
    }
} -ArgumentList $ScriptPath, $LogFile

Write-Host "✅ Security Sentinel iniciado exitosamente" -ForegroundColor Green
Write-Host "   Job ID: $($job.Id)" -ForegroundColor White
Write-Host "   Nombre: $($job.Name)" -ForegroundColor White
Write-Host "`n📝 Comandos útiles:" -ForegroundColor Cyan
Write-Host "   .\sentinel.ps1 -Status    # Ver estado y logs" -ForegroundColor White
Write-Host "   .\sentinel.ps1 -Logs      # Ver logs en tiempo real" -ForegroundColor White
Write-Host "   .\sentinel.ps1 -Stop      # Detener el servicio" -ForegroundColor White
Write-Host "`n🔍 Monitoreando vulnerabilidades cada 12 horas..." -ForegroundColor Yellow
