# ===================================================
# BeZhas Web3 - Pre-Deployment Validation Script
# ===================================================
# Ejecutar antes de subir a produccion
# Uso: .\validate-deploy.ps1 [-Quick] [-Docker] [-Verbose]
# ===================================================

param(
    [switch]$Quick,
    [switch]$Docker,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$script:hasErrors = $false
$script:warnings = 0

function Write-Status {
    param([string]$Message, [string]$Type = "INFO")
    $color = switch ($Type) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red"; $script:hasErrors = $true }
        "WARNING" { "Yellow"; $script:warnings++ }
        "INFO" { "Cyan" }
        default { "White" }
    }
    $symbol = switch ($Type) {
        "SUCCESS" { "[OK]" }
        "ERROR" { "[X]" }
        "WARNING" { "[!]" }
        "INFO" { "[i]" }
        default { "[*]" }
    }
    Write-Host "$symbol $Message" -ForegroundColor $color
}

function Test-FileExists {
    param([string]$Path, [string]$Description, [bool]$Critical = $true)
    if (Test-Path $Path) {
        Write-Status "$Description existe" "SUCCESS"
        return $true
    }
    else {
        $type = if ($Critical) { "ERROR" } else { "WARNING" }
        Write-Status "$Description NO ENCONTRADO: $Path" $type
        return $false
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  BeZhas Pre-Deployment Validation" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# ===================================================
# 1. VERIFICAR ARCHIVOS CRITICOS
# ===================================================
Write-Host "`n[1/7] Verificando archivos criticos..." -ForegroundColor White

Test-FileExists ".\backend\Dockerfile" "Backend Dockerfile"
Test-FileExists ".\backend\Dockerfile.optimized" "Backend Dockerfile Optimizado"
Test-FileExists ".\frontend\Dockerfile" "Frontend Dockerfile"
Test-FileExists ".\frontend\Dockerfile.optimized" "Frontend Dockerfile Optimizado"
Test-FileExists ".\cloudbuild.yaml" "Cloud Build config"
Test-FileExists ".\docker-compose.gcp.yml" "Docker Compose GCP"
Test-FileExists ".\frontend\nginx.conf" "Nginx config"
Test-FileExists ".\.github\workflows\deploy-gcp.yml" "Deploy GCP Workflow"
Test-FileExists ".\.github\workflows\ci.yml" "CI Workflow"
Test-FileExists ".\.env.gcp.example" "GCP Env Template"

# ===================================================
# 2. VERIFICAR PACKAGE.JSON
# ===================================================
Write-Host "`n[2/7] Verificando package.json..." -ForegroundColor White

$packages = @(".\package.json", ".\backend\package.json", ".\frontend\package.json")
foreach ($pkg in $packages) {
    if (Test-Path $pkg) {
        $content = Get-Content $pkg | ConvertFrom-Json
        Write-Status "$pkg - version: $($content.version)" "SUCCESS"
    }
    else {
        Write-Status "$pkg no encontrado" "ERROR"
    }
}

# ===================================================
# 3. VERIFICAR LOCK FILES
# ===================================================
Write-Host "`n[3/7] Verificando lock files..." -ForegroundColor White

if (Test-Path ".\pnpm-lock.yaml") {
    Write-Status "pnpm-lock.yaml encontrado (raiz)" "SUCCESS"
}
elseif (Test-Path ".\package-lock.json") {
    Write-Status "package-lock.json encontrado (usando npm)" "WARNING"
}
else {
    Write-Status "No se encontro lock file en raiz" "ERROR"
}

if ((Test-Path ".\backend\pnpm-lock.yaml") -or (Test-Path ".\backend\package-lock.json")) {
    Write-Status "Backend lock file encontrado" "SUCCESS"
}
else {
    Write-Status "Backend sin lock file" "WARNING"
}

if ((Test-Path ".\frontend\pnpm-lock.yaml") -or (Test-Path ".\frontend\package-lock.json")) {
    Write-Status "Frontend lock file encontrado" "SUCCESS"
}
else {
    Write-Status "Frontend sin lock file" "WARNING"
}

# ===================================================
# 4. VERIFICAR GITIGNORE
# ===================================================
Write-Host "`n[4/7] Verificando .gitignore..." -ForegroundColor White

if (Test-Path ".\.gitignore") {
    $gitignore = Get-Content ".\.gitignore" -Raw
    $requiredEntries = @("node_modules", ".env", "dist")
    
    foreach ($entry in $requiredEntries) {
        if ($gitignore -match [regex]::Escape($entry)) {
            Write-Status "'$entry' esta en .gitignore" "SUCCESS"
        }
        else {
            Write-Status "'$entry' deberia estar en .gitignore" "WARNING"
        }
    }
}
else {
    Write-Status ".gitignore no encontrado" "ERROR"
}

# ===================================================
# 5. VERIFICAR QUE NO HAY SECRETOS EXPUESTOS
# ===================================================
Write-Host "`n[5/7] Escaneando secretos expuestos..." -ForegroundColor White

$sensitivePatterns = @(
    @{ Pattern = "sk_live_[a-zA-Z0-9]{20,}"; Name = "Stripe Live Key" }
    @{ Pattern = "sk-[a-zA-Z0-9]{40,}"; Name = "OpenAI Key" }
    @{ Pattern = "AIzaSy[a-zA-Z0-9_-]{33}"; Name = "Google API Key" }
    @{ Pattern = "GOCSPX-[a-zA-Z0-9]{28}"; Name = "Google Client Secret" }
    @{ Pattern = "ghp_[a-zA-Z0-9]{36}"; Name = "GitHub Personal Token" }
)

$filesToScan = Get-ChildItem -Path . -Include @("*.js", "*.json", "*.yaml", "*.yml", "*.md") -Recurse -ErrorAction SilentlyContinue | 
Where-Object { $_.FullName -notmatch "node_modules|\.git|dist|build|backup_docs|coverage" }

$secretsFound = $false
foreach ($file in $filesToScan) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content) {
        foreach ($pattern in $sensitivePatterns) {
            if ($content -match $pattern.Pattern) {
                if ($file.Name -notmatch "\.example") {
                    Write-Status "Posible $($pattern.Name) en: $($file.Name)" "WARNING"
                    $secretsFound = $true
                }
            }
        }
    }
}

if (-not $secretsFound) {
    Write-Status "No se encontraron secretos expuestos obvios" "SUCCESS"
}

# ===================================================
# 6. VERIFICAR TESTS (si no es modo Quick)
# ===================================================
if (-not $Quick) {
    Write-Host "`n[6/7] Ejecutando tests..." -ForegroundColor White
    
    Write-Host "  Ejecutando lint del frontend..." -ForegroundColor Gray
    Push-Location .\frontend
    $lintResult = & pnpm lint 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Frontend lint paso" "SUCCESS"
    }
    else {
        Write-Status "Frontend lint tiene errores" "ERROR"
        if ($Verbose) { Write-Host $lintResult -ForegroundColor Gray }
    }
    Pop-Location
    
    Write-Host "  Compilando contratos..." -ForegroundColor Gray
    $compileResult = & npx hardhat compile 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Contratos compilados correctamente" "SUCCESS"
    }
    else {
        Write-Status "Error compilando contratos" "ERROR"
        if ($Verbose) { Write-Host $compileResult -ForegroundColor Gray }
    }
}
else {
    Write-Host "`n[6/7] Tests omitidos (modo Quick)" -ForegroundColor Yellow
}

# ===================================================
# 7. VERIFICAR DOCKER BUILD (si se especifica)
# ===================================================
if ($Docker) {
    Write-Host "`n[7/7] Construyendo imagenes Docker..." -ForegroundColor White
    
    Write-Host "  Construyendo backend..." -ForegroundColor Gray
    $backendBuild = & docker build -t bezhas-backend-test -f backend/Dockerfile.optimized backend/ 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Backend Docker build exitoso" "SUCCESS"
    }
    else {
        Write-Status "Backend Docker build fallo" "ERROR"
        if ($Verbose) { Write-Host $backendBuild -ForegroundColor Gray }
    }
    
    Write-Host "  Construyendo frontend..." -ForegroundColor Gray
    $frontendBuild = & docker build -t bezhas-frontend-test -f frontend/Dockerfile.optimized frontend/ 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Frontend Docker build exitoso" "SUCCESS"
    }
    else {
        Write-Status "Frontend Docker build fallo" "ERROR"
        if ($Verbose) { Write-Host $frontendBuild -ForegroundColor Gray }
    }
    
    docker rmi bezhas-backend-test bezhas-frontend-test 2>$null
}
else {
    Write-Host "`n[7/7] Docker build omitido (usar -Docker para incluir)" -ForegroundColor Yellow
}

# ===================================================
# RESUMEN FINAL
# ===================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  RESUMEN DE VALIDACION" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

if ($script:hasErrors) {
    Write-Host "[X] VALIDACION FALLIDA" -ForegroundColor Red
    Write-Host "    Corrige los errores antes de hacer deploy." -ForegroundColor Red
    Write-Host ""
    exit 1
}
elseif ($script:warnings -gt 0) {
    Write-Host "[!] VALIDACION CON ADVERTENCIAS ($($script:warnings))" -ForegroundColor Yellow
    Write-Host "    Revisa las advertencias, pero puedes continuar." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}
else {
    Write-Host "[OK] VALIDACION EXITOSA" -ForegroundColor Green
    Write-Host "     El proyecto esta listo para deployment." -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos pasos:" -ForegroundColor Cyan
    Write-Host "  1. git add ." -ForegroundColor White
    Write-Host "  2. git commit -m 'deploy: ready for production'" -ForegroundColor White
    Write-Host "  3. git push origin main" -ForegroundColor White
    Write-Host ""
    exit 0
}
