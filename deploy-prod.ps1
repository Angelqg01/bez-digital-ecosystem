# BeZhas Blockchain — Production Deployment Script (Option 3)
# Requisitos: Docker Desktop + NVIDIA Container Toolkit (para GPU)

Write-Host "🚀 Iniciando despliegue de Producción (BeZhas Agentic Infrastructure)" -ForegroundColor Cyan

# 1. Verificar Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Docker no está instalado. Por favor instala Docker Desktop."
    exit 1
}

# 2. Construir imágenes locales
Write-Host "`n📦 Construyendo Agent Runtime..." -ForegroundColor Yellow
docker compose build agent-runtime

# 3. Levantar servicios
Write-Host "`n⚡ Levantando infraestructura (Redis, Postgres, Ollama, Runtime)..." -ForegroundColor Yellow
docker compose up -d

# 4. Esperar a Ollama y descargar modelo base
Write-Host "`n🦙 Configurando Ollama (esto puede tardar unos minutos)..." -ForegroundColor Yellow
$ollamaReady = $false
$retryCount = 0
while (!$ollamaReady -and $retryCount -lt 12) {
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -ErrorAction SilentlyContinue
        $ollamaReady = $true
    } catch {
        Write-Host "⏳ Esperando a que Ollama inicie..."
        Start-Sleep -Seconds 10
        $retryCount++
    }
}

if ($ollamaReady) {
    Write-Host "✅ Ollama está listo. Descargando modelo llama3.2..." -ForegroundColor Green
    docker exec -it bezhas-ollama ollama pull llama3.2
} else {
    Write-Warning "⚠️ Ollama tardó demasiado en iniciar. Deberás ejecutar 'docker exec bezhas-ollama ollama pull llama3.2' manualmente."
}

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           SISTEMA EN PRODUCCIÓN (Docker)            ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  • Agent Runtime (HITL): http://localhost:3099       ║" -ForegroundColor Green
Write-Host "║  • Open WebUI (LLM):    http://localhost:3000       ║" -ForegroundColor Green
Write-Host "║  • Redis:               localhost:6379              ║" -ForegroundColor Green
Write-Host "║  • Postgres:            localhost:5432              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host "`nUsa 'docker compose logs -f agent-runtime' para ver la actividad."
