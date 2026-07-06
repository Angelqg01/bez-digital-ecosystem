@echo off
cd /d "%~dp0"
echo.
echo  ==========================================
echo   BeZhas Sales Agency v1.0
echo  ==========================================
echo.

:: Verificar .env
if not exist .env (
  echo  [!] Copia .env.example a .env y rellena tus credenciales
  echo      Necesitas: ANTHROPIC_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD
  echo      Opcional:  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
  echo.
  pause
  exit /b
)

:: Instalar dependencias si no existen
if not exist node_modules (
  echo  Instalando dependencias...
  call pnpm install
  echo.
)

echo  Modos disponibles:
echo   1. Daemon automatico (9AM + 3PM cada dia)
echo   2. Scout manual ahora
echo   3. Solo follow-ups
echo   4. Ver estado en consola
echo   5. Enviar reporte Telegram
echo.
set /p MODO="Elige modo [1-5]: "

if "%MODO%"=="1" node index.js
if "%MODO%"=="2" node index.js --mode=scout
if "%MODO%"=="3" node index.js --mode=followup
if "%MODO%"=="4" node index.js --mode=status
if "%MODO%"=="5" node index.js --mode=report

pause
