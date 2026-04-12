@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM Detectar IP LAN
set "LAN_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    if not defined LAN_IP (
        set "LAN_IP=%%a"
        set "LAN_IP=!LAN_IP: =!"
    )
)
if not defined LAN_IP set "LAN_IP=localhost"

echo Instalando dependencias de Python...
python -m pip install -r requirements.txt -q 2>nul

REM Configurar CORS para LAN
set "CORS_ORIGINS=http://localhost:5000,http://localhost:3000,http://127.0.0.1:5000,http://127.0.0.1:3000,http://%LAN_IP%:5000,http://%LAN_IP%:3000"

echo.
echo Backend Nexora
echo   Local:   http://localhost:8000
echo   Red LAN: http://%LAN_IP%:8000
echo.
echo Ejecutando uvicorn...
echo.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
