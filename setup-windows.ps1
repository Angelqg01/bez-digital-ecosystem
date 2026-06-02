# ============================================================
# BeZhas Blockchain — Setup Completo Windows
# OpenCode + Ollama + Kimi-K2.6 + Gemma4 + Qwen3.6
# ============================================================
# Ejecutar como Administrador en PowerShell:
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\scripts\setup-windows.ps1
# ============================================================

param(
    [switch]$SkipOllama,
    [switch]$SkipModels,
    [switch]$SkipOpenCode,
    [switch]$SkipNodeDeps,
    [switch]$SmallModelsOnly   # Solo modelos <20GB para tests rápidos
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ── Colores ──────────────────────────────────────────────────────────────────
function Write-Step  { param($n,$msg) Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "    ✅ $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "    ⚠️  $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "    ❌ $msg" -ForegroundColor Red }
function Write-Info  { param($msg) Write-Host "    → $msg" -ForegroundColor Gray }

Write-Host @"

╔══════════════════════════════════════════════════════════╗
║     BeZhas Blockchain — Setup Completo v2.0              ║
║     OpenCode + Ollama + Kimi-K2.6 + Gemma4 + Qwen3.6    ║
║     RTX 4090 · 128GB RAM · Windows                       ║
╚══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

# ── Rutas del proyecto ────────────────────────────────────────────────────────
$PROJECT_ROOT = "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain"
$MODELS_DIR   = "D:\Models\Ollama"
$SCRIPTS_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── 1. Verificar prerequisitos ────────────────────────────────────────────────
Write-Step "1/9" "Verificando prerequisitos del sistema"

# Node.js >= 20
try {
    $nodeVer = (node --version 2>$null)
    $nodeMaj = [int]($nodeVer -replace 'v(\d+)\..*','$1')
    if ($nodeMaj -ge 20) { Write-OK "Node.js $nodeVer" }
    else { Write-Fail "Node.js $nodeVer demasiado antiguo. Instala v20+: winget install OpenJS.NodeJS.LTS" ; exit 1 }
# pnpm >= 11
try {
    $pnpmVer = (pnpm --version 2>$null)
    $pnpmMaj = [int]($pnpmVer -replace '(\d+)\..*','$1')
    if ($pnpmMaj -ge 11) { Write-OK "pnpm $pnpmVer" }
    else { 
        Write-Warn "pnpm $pnpmVer es inferior a v11. Actualizando..."
        npm install -g pnpm@latest
        $pnpmVer = (pnpm --version)
        Write-OK "pnpm actualizado a $pnpmVer"
    }
} catch { 
    Write-Info "pnpm no encontrado. Instalando..."
    npm install -g pnpm
    Write-OK "pnpm instalado"
}

# Git
try { git --version | Out-Null ; Write-OK "Git disponible" }
catch { Write-Warn "Git no encontrado. Instala: winget install Git.Git" }

# Docker Desktop
try {
    docker info 2>$null | Out-Null
    Write-OK "Docker Desktop corriendo"
} catch { Write-Warn "Docker no disponible. Arranca Docker Desktop para los contenedores." }

# NVIDIA GPU
try {
    $gpu = (nvidia-smi --query-gpu=name --format=csv,noheader 2>$null)
    if ($gpu) { Write-OK "GPU: $gpu" }
} catch { Write-Warn "nvidia-smi no encontrado (¿drivers NVIDIA instalados?)" }

# ── 2. Variables de entorno ───────────────────────────────────────────────────
Write-Step "2/9" "Configurando variables de entorno Ollama"

$envVars = @{
    "OLLAMA_HOST"        = "0.0.0.0:11434"
    "OLLAMA_MODELS"      = $MODELS_DIR
    "OLLAMA_NUM_GPU"     = "1"
    "CUDA_VISIBLE_DEVICES" = "0"
    "OLLAMA_FLASH_ATTENTION" = "1"   # Flash attention para Gemma4
    "OLLAMA_MAX_LOADED_MODELS" = "2" # RTX 4090 puede tener 2 modelos en VRAM
    "OLLAMA_NUM_PARALLEL" = "4"
    "OLLAMA_KEEP_ALIVE"  = "30m"
}

foreach ($key in $envVars.Keys) {
    [System.Environment]::SetEnvironmentVariable($key, $envVars[$key], "Machine")
    $env:($key) = $envVars[$key]
    Write-Info "$key = $($envVars[$key])"
}
Write-OK "Variables de entorno configuradas"

# Crear directorio de modelos
if (-not (Test-Path $MODELS_DIR)) {
    New-Item -ItemType Directory -Path $MODELS_DIR -Force | Out-Null
    Write-OK "Directorio modelos: $MODELS_DIR"
}

# ── 3. Instalar / actualizar Ollama ───────────────────────────────────────────
Write-Step "3/9" "Instalando/actualizando Ollama"

if (-not $SkipOllama) {
    try {
        $ollamaVer = (ollama --version 2>$null)
        Write-OK "Ollama ya instalado: $ollamaVer"
        Write-Info "Actualizando..."
        winget upgrade Ollama.Ollama --silent 2>$null
    } catch {
        Write-Info "Instalando Ollama via winget..."
        winget install Ollama.Ollama --silent --accept-package-agreements --accept-source-agreements
        Write-OK "Ollama instalado"
    }
    Write-Info "Reinicia PowerShell si es la primera instalación para que el PATH se actualice"
} else {
    Write-Warn "Ollama omitido (--SkipOllama)"
}

# ── 4. Instalar OpenCode ──────────────────────────────────────────────────────
Write-Step "4/9" "Instalando OpenCode (stable)"

if (-not $SkipOpenCode) {
    # Método 1: Via Ollama launch (integración nativa)
    Write-Info "Método primario: ollama launch opencode"
    try {
        ollama pull qwen3.6:latest 2>$null  # modelo base para OpenCode
        Write-OK "Modelo base qwen3.6 disponible para OpenCode"
    } catch {}

    # Método 2: Instalador oficial via curl/wget (Windows)
    Write-Info "Instalando OpenCode CLI..."
    try {
        # Descargar instalador
        $opencodeUrl = "https://opencode.ai/install"
        $installerPath = "$env:TEMP\opencode-install.ps1"

        # Intentar con curl (viene con Windows 10/11)
        $curlResult = & curl.exe -fsSL --max-time 30 -o $installerPath $opencodeUrl 2>&1
        if (Test-Path $installerPath) {
            & powershell -ExecutionPolicy Bypass -File $installerPath
            Write-OK "OpenCode instalado via script oficial"
        } else {
            throw "No se pudo descargar el instalador"
        }
    } catch {
        Write-Warn "No se pudo instalar via script oficial. Usando integración nativa de Ollama:"
        Write-Info "  ollama launch opencode --model qwen3.6"
        Write-Info "  (esto configura OpenCode automáticamente con Ollama)"
    }

    # Configurar OpenCode para apuntar a Ollama local
    $openCodeConfig = @{
        model = "ollama/qwen3.6"
        provider = "ollama"
        apiBase = "http://localhost:11434"
        fallback = @("ollama/kimi-k2", "ollama/gemma4:27b")
    } | ConvertTo-Json

    $configDir = "$env:APPDATA\opencode"
    if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
    $openCodeConfig | Set-Content "$configDir\config.json" -Encoding UTF8
    Write-OK "OpenCode configurado: $configDir\config.json"
} else {
    Write-Warn "OpenCode omitido (--SkipOpenCode)"
}

# ── 5. Descargar modelos Ollama ────────────────────────────────────────────────
Write-Step "5/9" "Descargando modelos de IA"

if (-not $SkipModels) {

    # Definir modelos con sus tamaños aproximados
    $models = @(
        @{ name="gemma4:27b";        size="~17GB"; vram="18GB"; priority=1; small=$false;
           desc="Gemma 4 27B - Razonamiento general, español, agentes dpto." },
        @{ name="qwen3.6:35b-a3b";   size="~22GB"; vram="22GB"; priority=2; small=$false;
           desc="Qwen3.6 MoE 35B-A3B - Coding, trading algorithms, Solidity" },
        @{ name="kimi-k2:latest";    size="~40GB"; vram="40GB+"; priority=3; small=$false;
           desc="Kimi K2.6 - Agentic multi-step, long context 128k" },
        @{ name="gemma4:12b";        size="~8GB";  vram="9GB";  priority=1; small=$true;
           desc="Gemma 4 12B - Versión ligera para pruebas" },
        @{ name="qwen3.6:27b";       size="~17GB"; vram="18GB"; priority=2; small=$true;
           desc="Qwen3.6 27B dense - Alternativa si el MoE no cabe" },
        @{ name="nomic-embed-text";  size="~0.3GB"; vram="0.5GB"; priority=1; small=$true;
           desc="Embeddings para RAG Obsidian Knowledge Base" },
        @{ name="qwen3.6:8b";        size="~5GB";  vram="5GB";  priority=1; small=$true;
           desc="Qwen3.6 8B - Modelo ultrarrápido para devops/monitoring" }
    )

    $targetModels = if ($SmallModelsOnly) {
        $models | Where-Object { $_.small -eq $true }
    } else {
        $models
    }

    Write-Info "Modelos a descargar: $($targetModels.Count)"
    Write-Warn "NOTA: Kimi K2.6 pesa ~40GB. Con RTX 4090 (24GB VRAM) se carga parcialmente en VRAM + RAM."
    Write-Info "      Si prefieres no descargarlo ahora, usa: -SmallModelsOnly"

    foreach ($m in $targetModels) {
        Write-Host "`n  📥 $($m.name) ($($m.size)) — $($m.desc)" -ForegroundColor White
        try {
            & ollama pull $m.name
            Write-OK "$($m.name) descargado"
        } catch {
            Write-Warn "No se pudo descargar $($m.name): $_"
        }
    }

    # Verificar modelos descargados
    Write-Host "`n  📋 Modelos instalados:" -ForegroundColor Cyan
    & ollama list

} else {
    Write-Warn "Modelos omitidos (--SkipModels)"
}

# ── 6. Configurar ollama launch opencode ─────────────────────────────────────
Write-Step "6/9" "Configurando ollama launch opencode + openclaw"

Write-Info "Configurando OpenCode con modelo primario qwen3.6..."
try {
    # ollama launch opencode con modelo BeZhas
    # Esto configura OpenCode para usar Ollama como backend
    $launchConfig = @"
{
  "\`\$schema": "https://opencode.ai/config.schema.json",
  "model": "ollama/qwen3.6",
  "provider": {
    "ollama": {
      "models": ["qwen3.6", "kimi-k2", "gemma4:27b"],
      "baseURL": "http://localhost:11434"
    }
  },
  "instructions": "Eres un asistente de desarrollo para BeZhas Blockchain. Tienes acceso al proyecto en $PROJECT_ROOT. Eres experto en Solidity, TypeScript, Node.js, y sistemas blockchain L2 (OP Stack). El token BEZ-Coin está desplegado en Polygon (0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8) y BNB Chain (0x8a1e3930fde1f151471c368fdbb39f3f63a65b55). Siempre usa el lenguaje del usuario (español por defecto)."
}
"@
    $openCodeDir = "$env:USERPROFILE\.opencode"
    if (-not (Test-Path $openCodeDir)) { New-Item -ItemType Directory -Path $openCodeDir -Force | Out-Null }
    $launchConfig | Set-Content "$openCodeDir\config.json" -Encoding UTF8
    Write-OK "OpenCode config: $openCodeDir\config.json"
} catch {
    Write-Warn "Error configurando OpenCode: $_"
}

Write-Info "Para lanzar OpenCode con BeZhas:"
Write-Info "  cd '$PROJECT_ROOT'"
Write-Info "  ollama launch opencode --model qwen3.6"
Write-Info ""
Write-Info "Para conectar Telegram vía OpenClaw:"
Write-Info "  ollama launch openclaw --yes"

# ── 7. Instalar dependencias Node.js del proyecto ─────────────────────────────
Write-Step "7/9" "Instalando dependencias Node.js"

if (-not $SkipNodeDeps) {
    $nodePkgs = @(
        "$PROJECT_ROOT\agent-runtime",
        "$PROJECT_ROOT\messaging-mcp",
        "$PROJECT_ROOT\openclaw",
        "$PROJECT_ROOT\ai-engine",
        "$PROJECT_ROOT\aegis"
    )

    foreach ($pkg in $nodePkgs) {
        if (Test-Path "$pkg\package.json") {
            Write-Info "pnpm install en $pkg..."
            Push-Location $pkg
            try {
                pnpm install --silent
                Write-OK "$(Split-Path -Leaf $pkg) ✓"
            } catch {
                Write-Warn "Error en $pkg : $_"
            }
            Pop-Location
        }
    }
} else {
    Write-Warn "Node deps omitidos (--SkipNodeDeps)"
}

# ── 8. Crear archivo .env del proyecto ────────────────────────────────────────
Write-Step "8/9" "Creando .env del proyecto BeZhas"

$envFile = "$PROJECT_ROOT\.env"
if (-not (Test-Path $envFile)) {
    $envContent = @"
# ============================================================
# BeZhas Blockchain — Variables de entorno
# Generado por setup-windows.ps1
# ============================================================

# ── TELEGRAM (obtenido de @BotFather) ──
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALERT_CHAT_ID=
TELEGRAM_LEADS_CHANNEL_ID=
TELEGRAM_AUTHORIZED_USERS=

# ── LLM CLOUD (cascade) ──
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
KIMI_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=

# ── OLLAMA LOCAL ──
OLLAMA_HOST=http://localhost:11434
OLLAMA_PRIMARY_MODEL=qwen3.6
OLLAMA_CODING_MODEL=qwen3.6:35b-a3b
OLLAMA_AGENT_MODEL=gemma4:27b
OLLAMA_LONG_CONTEXT_MODEL=kimi-k2
OLLAMA_EMBED_MODEL=nomic-embed-text

# ── REDIS ──
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=bezhas:

# ── POSTGRES ──
DATABASE_URL=postgresql://bezhas:bezhas_secure_2026@localhost:5432/bezhas
POSTGRES_PASSWORD=bezhas_secure_2026

# ── BEZHAS API ──
BEZHAS_API_URL=https://api.bez.digital/v1
BEZHAS_PUBLIC_URL=https://mcp.bez.digital
BEZHAS_API_KEY=
JWT_SECRET=

# ── BLOCKCHAIN ──
BEZ_POLYGON=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
BEZ_BNB=0x8a1e3930fde1f151471c368fdbb39f3f63a65b55
TREASURY_DAO=0x89c23890c742d710265dD61be789C71dC8999b12
HOT_WALLET_KEY=
RPC_POLYGON=https://polygon-rpc.com
RPC_BNB=https://bsc-dataseed.binance.org

# ── OPENCODE ──
OPENCODE_MODEL=ollama/qwen3.6
OPENCODE_WORKSPACE=$PROJECT_ROOT

# ── HUMAN-IN-LOOP ──
HIL_TIMEOUT_SECS=120

# ── ENTORNO ──
NODE_ENV=development
LOG_LEVEL=info
"@
    $envContent | Set-Content $envFile -Encoding UTF8
    Write-OK ".env creado en $envFile"
    Write-Warn "¡Rellena TELEGRAM_BOT_TOKEN y ANTHROPIC_API_KEY antes de arrancar!"
} else {
    Write-OK ".env ya existe: $envFile"
}

# ── 9. Crear accesos directos en escritorio ───────────────────────────────────
Write-Step "9/9" "Creando accesos directos"

$desktopPath = [System.Environment]::GetFolderPath("Desktop")

# Shortcut: Arrancar BeZhas
$WshShell = New-Object -comObject WScript.Shell
$shortcut = $WshShell.CreateShortcut("$desktopPath\BeZhas Start.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoExit -Command `"cd '$PROJECT_ROOT'; docker compose up -d redis postgres; node agent-runtime/src/index.js`""
$shortcut.WorkingDirectory = $PROJECT_ROOT
$shortcut.Description = "Arrancar BeZhas Blockchain"
$shortcut.Save()
Write-OK "Shortcut: BeZhas Start.lnk"

# Shortcut: OpenCode en el proyecto
$shortcut2 = $WshShell.CreateShortcut("$desktopPath\BeZhas OpenCode.lnk")
$shortcut2.TargetPath = "powershell.exe"
$shortcut2.Arguments = "-NoExit -Command `"cd '$PROJECT_ROOT'; ollama launch opencode --model qwen3.6`""
$shortcut2.WorkingDirectory = $PROJECT_ROOT
$shortcut2.Description = "OpenCode para BeZhas"
$shortcut2.Save()
Write-OK "Shortcut: BeZhas OpenCode.lnk"

# ── Resumen final ─────────────────────────────────────────────────────────────
Write-Host @"

╔══════════════════════════════════════════════════════════╗
║  ✅ Setup completado                                      ║
╠══════════════════════════════════════════════════════════╣
║  Siguiente paso 1: Rellenar .env                         ║
║    $envFile
║                                                          ║
║  Siguiente paso 2: Arrancar Redis                        ║
║    docker compose up -d redis postgres                   ║
║                                                          ║
║  Siguiente paso 3: Arrancar agentes                      ║
║    cd '$PROJECT_ROOT'
║    node agent-runtime/src/index.js                       ║
║                                                          ║
║  Siguiente paso 4: OpenCode IDE                         ║
║    ollama launch opencode --model qwen3.6                ║
╚══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
