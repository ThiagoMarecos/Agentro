# Nexora

**Build stores. Let AI sell.**

SaaS multi-tenant de e-commerce con inteligencia artificial para ventas.

## Stack

- **Backend**: FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis, Pydantic, JWT
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, App Router
- **Infra**: Docker, docker-compose

## Estructura

```
nexora/
├── backend/       # API FastAPI
├── frontend/      # Next.js
├── docs/          # Documentación
├── infra/         # Infraestructura
├── scripts/       # Scripts de utilidad
├── docker-compose.yml
└── .env.example
```

## Requisitos

- Python 3.11+
- Node.js 18+
- Docker (PostgreSQL, Redis)

## Inicio rápido

### 1. Variables de entorno

```bash
cp .env.example .env
# Editar .env con SECRET_KEY y demás valores
```

### 2. Servicios (Docker)

```bash
docker-compose up -d
```

### 3. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
alembic upgrade head
python scripts/seed.py    # Datos demo (opcional)
uvicorn app.main:app --reload
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

### URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Datos demo (seed)

- User: `demo@nexora.dev` / `demo123`
- Storefront: http://localhost:3000/store/demo-store

## Flujo Auth y Onboarding

1. **Login/Registro** (`/login`, `/signup`) - Email/contraseña o Google OAuth
2. **Callback OAuth** (`/auth/callback`) - Recibe tokens en fragment (#), actualiza AuthProvider, redirige según `has_store`
3. **Onboarding** (`/onboarding`) - Wizard para crear tienda inicial (si no tiene)
4. **Admin** (`/app`) - Protegido por ProtectedRoute + OnboardingGuard

### Configurar Google OAuth

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID
3. Tipo: Web application
4. Authorized redirect URIs: `http://localhost:8000/api/v1/auth/google/callback` (desarrollo)
5. En `.env`: `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`

## Superficies

1. **Landing** (`/`) - Hero, features, FAQ, Sign in with Google, Create store
2. **Auth** (`/login`, `/signup`) - Login, registro, Google OAuth
3. **Onboarding** (`/onboarding`) - Wizard para crear tienda inicial
4. **Admin** (`/app`) - Dashboard, productos, categorías, pedidos, clientes, IA, etc.
5. **Storefront** (`/store/[slug]`) - Tienda pública con catálogo, drops, chat IA

## Módulo Catálogo (Products)

- Productos con variantes, imágenes, status (draft/active/archived)
- Categorías por tienda
- Filtros, búsqueda y paginación en listado
- CRUD completo en admin
- Base lista para storefront, carrito y checkout

## Fase B: Admin Experience (implementada)

- **Dashboard**: Métricas (productos, categorías, low stock, conversaciones, AI agents), actividad reciente, setup progress, quick actions
- **Store Settings**: General, Brand, Region, Contact, SEO (GET/PATCH /stores/current/settings)
- **Appearance**: Selección de templates (streetwear, minimal, modern), colores, tipografía, preview
- **Theme presets**: Aplicar preset, editar custom_config (colors, typography, button_style, card_style)
- **Setup progress**: Checklist (store profile, logo, theme, categories, products, AI channel, storefront ready)
- **Storefront**: Devuelve theme completo con custom_config para renderizado temático

### Migración 005

Añade a `stores`: support_email, support_phone, logo_url, favicon_url, timezone, meta_title, meta_description, business_type.

```bash
cd backend && alembic upgrade head
```

## Próximas fases
- Pagos (Stripe u otro)
- WhatsApp Business API
- Billing y planes
- Tests automatizados
