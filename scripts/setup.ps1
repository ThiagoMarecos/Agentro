# Script de configuración inicial para Nexora (Windows PowerShell)
# Ejecutar desde la raíz del proyecto

Write-Host "=== Nexora Setup ===" -ForegroundColor Cyan

# Crear .env si no existe
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Creado .env desde .env.example"
} else {
    Write-Host ".env ya existe"
}

# Backend
Write-Host "Configurando backend..."
Set-Location backend
python -m venv .venv 2>$null
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Set-Location ..

# Frontend
Write-Host "Configurando frontend..."
Set-Location frontend
npm install
Set-Location ..

Write-Host "=== Setup completado ===" -ForegroundColor Green
Write-Host "Ejecuta: docker-compose up -d  (para PostgreSQL y Redis)"
Write-Host "Luego: cd backend; alembic upgrade head"
Write-Host "Luego: cd frontend; npm run dev"
