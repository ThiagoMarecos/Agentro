@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Nexora - Servidor

REM === Agregar Node.js al PATH ===
if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%APPDATA%\npm" set "PATH=%APPDATA%\npm;%PATH%"

echo.
echo ========================================
echo   Nexora - Iniciando proyecto
echo ========================================
echo.

REM === Detectar IP LAN (usa la interfaz con gateway, ignora virtuales) ===
set "LAN_IP="
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress" 2^>nul') do (
    set "LAN_IP=%%i"
)
if not defined LAN_IP (
    for /f "tokens=2 delims=:" %%a in ('ipconfig 2^>nul ^| findstr /c:"IPv4"') do (
        if not defined LAN_IP (
            set "_tmp=%%a"
            set "LAN_IP=!_tmp: =!"
        )
    )
)
if not defined LAN_IP set "LAN_IP=localhost"
echo   IP LAN: !LAN_IP!
echo.

REM === Verificar Python venv ===
set "BACKEND_PY=%~dp0backend\venv\Scripts\python.exe"
if not exist "!BACKEND_PY!" (
    echo   Creando entorno virtual del backend...
    cd /d "%~dp0backend"
    python -m venv venv 2>nul
    if not exist "venv\Scripts\python.exe" py -m venv venv 2>nul
    if not exist "venv\Scripts\python.exe" (
        echo   ERROR: No se encontro Python. Instala Python 3.10+
        pause
        exit /b 1
    )
    echo   Instalando dependencias...
    call venv\Scripts\pip install -r requirements.txt -q
    cd /d "%~dp0"
)

echo   [1/5] Verificando dependencias del backend...
cd /d "%~dp0backend"
"!BACKEND_PY!" -m pip install -r requirements.txt -q 2>nul
cd /d "%~dp0"

echo   [2/5] Verificando base de datos...
cd /d "%~dp0backend"
"!BACKEND_PY!" -m alembic upgrade head 2>nul
cd /d "%~dp0"

REM === Verificar npm ===
where npm >nul 2>&1
if errorlevel 1 (
    echo   ERROR: npm no encontrado. Instala Node.js desde https://nodejs.org
    pause
    exit /b 1
)

if not exist "%~dp0frontend\node_modules" (
    echo   [3/5] Instalando dependencias del frontend...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
) else (
    echo   [3/5] Dependencias del frontend OK.
)

REM === Variables de entorno ===
set "CORS_ORIGINS=http://localhost:5000,http://localhost:3000,http://127.0.0.1:5000,http://127.0.0.1:3000,http://!LAN_IP!:5000,http://!LAN_IP!:3000"
set "HOSTNAME=0.0.0.0"

REM === Iniciar Backend en segundo plano ===
echo   [4/5] Iniciando backend...
cd /d "%~dp0backend"
start /b "" "!BACKEND_PY!" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > "%~dp0backend_log.txt" 2>&1
cd /d "%~dp0"

timeout /t 4 /nobreak > nul
echo   [5/5] Iniciando frontend...
echo.
echo ========================================
echo   Nexora corriendo!
echo ========================================
echo.
echo   Local:    http://localhost:5000
echo   Red LAN:  http://!LAN_IP!:5000
echo   Backend:  http://!LAN_IP!:8000
echo.
echo   Otros dispositivos en tu red pueden
echo   acceder desde http://!LAN_IP!:5000
echo.
echo   Ctrl+C para detener todo.
echo ========================================
echo.

REM === Abrir navegador ===
start /b cmd /c "timeout /t 5 /nobreak > nul & start http://localhost:5000"

REM === Frontend en primer plano ===
cd /d "%~dp0frontend"
call npm run dev -- -p 5000 -H 0.0.0.0

echo.
echo   Nexora se detuvo.
pause
exit /b 0
