#!/bin/bash
# Script de configuración inicial para Nexora
# Ejecutar desde la raíz del proyecto

set -e

echo "=== Nexora Setup ==="

# Crear .env si no existe
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Creado .env desde .env.example"
else
    echo ".env ya existe"
fi

# Backend
echo "Configurando backend..."
cd backend
python -m venv .venv 2>/dev/null || true
source .venv/bin/activate 2>/dev/null || true
pip install -r requirements.txt
cd ..

# Frontend
echo "Configurando frontend..."
cd frontend
npm install
cd ..

echo "=== Setup completado ==="
echo "Ejecuta: docker-compose up -d  (para PostgreSQL y Redis)"
echo "Luego: cd backend && alembic upgrade head"
echo "Luego: cd frontend && npm run dev"
