@echo off
REM ═══════════════════════════════════════════════════════════════
REM  BeZhas OpenClaw — Setup Script para Windows
REM  Proyecto: D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain
REM ═══════════════════════════════════════════════════════════════

echo.
echo  ██████╗ ███████╗███████╗██╗  ██╗ █████╗ ███████╗
echo  ██╔══██╗██╔════╝╚══███╔╝██║  ██║██╔══██╗██╔════╝
echo  ██████╔╝█████╗    ███╔╝ ███████║███████║███████╗
echo  ██╔══██╗██╔══╝   ███╔╝  ██╔══██║██╔══██║╚════██║
echo  ██████╔╝███████╗███████╗██║  ██║██║  ██║███████║
echo  ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
echo  OpenClaw AI Engine — BeZhas Platform
echo.

REM ── Verificar Docker Desktop ────────────────────────────────
echo [1/5] Verificando Docker Desktop...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Desktop no está instalado o no está corriendo.
    echo Descarga: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)
echo OK — Docker disponible

REM ── Verificar NVIDIA Docker ─────────────────────────────────
echo [2/5] Verificando soporte GPU NVIDIA...
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi >nul 2>&1
if %errorlevel% neq 0 (
    echo AVISO: GPU NVIDIA no detectada. El motor usará CPU.
    echo Para GPU: instala NVIDIA Container Toolkit
    echo https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
) else (
    echo OK — GPU NVIDIA disponible
)

REM ── Configurar .env ─────────────────────────────────────────
echo [3/5] Configurando variables de entorno...
if not exist .env (
    copy .env.example .env
    echo IMPORTANTE: Edita .env con tus API keys antes de continuar
    notepad .env
)

REM ── Build Docker ────────────────────────────────────────────
echo [4/5] Construyendo imagen Docker...
echo NOTA: Primera vez tarda 10-20 min (descarga CUDA + PyTorch + libs)
docker-compose build --no-cache
if %errorlevel% neq 0 (
    echo ERROR en el build. Revisa los logs arriba.
    pause
    exit /b 1
)
echo OK — Imagen construida

REM ── Iniciar servicios ────────────────────────────────────────
echo [5/5] Iniciando servicios BeZhas OpenClaw...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ERROR al iniciar servicios.
    pause
    exit /b 1
)

echo.
echo ═══════════════════════════════════════════════════════════
echo  ✅ BeZhas OpenClaw Engine ACTIVO
echo  📡 API REST:    http://localhost:8000
echo  📊 Health:      http://localhost:8000/health
echo  📋 Docs:        http://localhost:8000/docs
echo ═══════════════════════════════════════════════════════════
echo.
echo  Comandos útiles:
echo    Ver logs:      docker-compose logs -f openclaw-engine
echo    Parar:         docker-compose down
echo    Reiniciar:     docker-compose restart openclaw-engine
echo    Estado GPU:    docker exec bezhas-openclaw nvidia-smi
echo.
pause
