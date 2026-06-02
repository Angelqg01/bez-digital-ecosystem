param(
  [switch]$Start,
  [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
$Example = Join-Path $Root ".env.example"

Set-Location $Root

if (!(Test-Path $EnvFile)) {
  Copy-Item $Example $EnvFile
}

if ($ApiKey -and $ApiKey.Trim().Length -gt 0) {
  $content = Get-Content -Raw $EnvFile
  $content = $content -replace "API_KEY=.*", "API_KEY=$ApiKey"
  Set-Content -Path $EnvFile -Value $content -Encoding UTF8
}

$userNpm = "C:\Users\yoela\AppData\Local\pnpm"
if (Test-Path (Join-Path $userNpm "npm.CMD")) {
  $env:PATH = "$userNpm;$env:PATH"
}

pnpm install
pnpm run check
docker compose config --quiet

if ($Start) {
  docker compose up -d
}

Write-Host "BeZhas Enterprise Node listo."
Write-Host "API: http://localhost:4100"
Write-Host "Health: http://localhost:4100/health"

