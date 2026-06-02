# ============================================================================
#  BeZhas Platform — Stop All Dev Services
#
#  Usage:
#    .\scripts\stop-dev.ps1              # Stop everything
#    .\scripts\stop-dev.ps1 -KeepDocker  # Only stop local Node processes
# ============================================================================

param(
    [switch]$KeepDocker
)

$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "Stopping BeZhas Platform..." -ForegroundColor Yellow
Write-Host ""

# Kill Node.js processes on known ports
$ports = @(3000, 3001, 3003, 4000, 5174)
$killed = 0
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object State -eq Listen
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -ne "com.docker.backend") {
            Write-Host "  Stopping $($proc.ProcessName) on :$port (PID $($proc.Id))" -ForegroundColor DarkGray
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killed++
        }
    }
}
Write-Host "  Stopped $killed local processes" -ForegroundColor Green

# Stop Docker
if (-not $KeepDocker) {
    Write-Host "  Stopping Docker containers..." -ForegroundColor DarkGray
    Set-Location $ROOT
    docker compose down 2>$null
    Write-Host "  Docker containers stopped" -ForegroundColor Green
} else {
    Write-Host "  Keeping Docker containers running (--KeepDocker)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "All services stopped." -ForegroundColor Cyan
Write-Host ""
