@echo off
chcp 65001 > nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         BEZHAS AI AGENT 24/7 — INICIANDO...                ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Verificar que existe .env
if not exist ".env" (
    echo ❌ ERROR: Archivo .env no encontrado.
    echo    Copia .env.example a .env y configura tus API keys.
    echo.
    pause
    exit /b 1
)

:: Verificar Node.js
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js no está instalado.
    echo    Descarga desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Instalar dependencias si no existen
if not exist "node_modules" (
    echo 📦 Instalando dependencias...
    npm install
    echo.
)

echo ✅ Iniciando servidor BeZhas Agent en puerto 3099...
echo ✅ Iniciando Telegram Bot...
echo.
echo Para detener: Ctrl+C
echo.

:: Iniciar servidor y bot en paralelo
start "BeZhas Agent Server" cmd /k "node bezhas-agent-server.js"
timeout /t 3 /nobreak > nul
start "BeZhas Telegram Bot" cmd /k "node telegram-bot.js"

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  Servidor: http://localhost:3099                            ║
echo ║  Bot:      Abre Telegram y busca tu bot                    ║
echo ║  Comando:  /start para comenzar                            ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
