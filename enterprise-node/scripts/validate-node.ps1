$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$userNpm = "C:\Users\yoela\AppData\Local\pnpm"
if (Test-Path (Join-Path $userNpm "npm.CMD")) {
  $env:PATH = "$userNpm;$env:PATH"
}

pnpm --version
pnpm run check
docker compose config --quiet

$envPath = Join-Path $Root ".env"
if (Test-Path $envPath) {
  $envContent = Get-Content -Raw $envPath
  if ($envContent -match "API_KEY=CHANGE_ME|API_KEY=\s*(\r?\n|$)") {
    Write-Warning "Configura API_KEY antes de exponer endpoints autenticados."
  }
} else {
  Write-Warning "No existe .env. Ejecuta scripts/install-windows.ps1."
}

Write-Host "Validacion completada."
