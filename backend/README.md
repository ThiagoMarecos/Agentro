# Agentro Backend

API FastAPI del SaaS Agentro.

## Módulos

- **auth** - Login, registro, refresh token, Google OAuth
- **stores** - CRUD tiendas, settings (GET/PATCH /stores/current/settings)
- **dashboard** - Resumen, actividad, setup progress (X-Store-ID)
- **themes** - Presets, tema actual, aplicar preset (X-Store-ID para current)
- **onboarding** - Estado y creación de tienda inicial
- **products** - CRUD productos con variantes, imágenes, filtros, paginación (X-Store-ID)
- **categories** - CRUD categorías (slug único por tienda)
- **orders** - Lista y detalle pedidos
- **customers** - Lista clientes
- **conversations** - Conversaciones IA
- **ai-agents** - Agentes de IA
- **ai-channels** - Canales (web_chat, whatsapp)
- **next-drop** - Próximos drops
- **settings** - Configuración key-value por tienda (legacy)
- **storefront** - API pública (sin auth) por slug, incluye theme con custom_config

## Variables de entorno

Ver `.env.example` en la raíz. Principales:

- `DATABASE_URL` - PostgreSQL
- `REDIS_URL` - Redis
- `SECRET_KEY` - JWT
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth
- `CORS_ORIGINS` - Orígenes permitidos

## Migraciones

```bash
alembic revision --autogenerate -m "descripción"
alembic upgrade head
```

## Ejecución

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Seed

```bash
python scripts/seed.py
```

Crea user demo, store demo-store, categorías, productos (con variantes e imágenes), agente IA, drop.

## Endpoints Dashboard (X-Store-ID)

- `GET /dashboard/summary` - Métricas: productos, categorías, low stock, conversaciones, AI agents, setup progress
- `GET /dashboard/activity?limit=20` - Actividad reciente desde AuditLog

## Endpoints Store Settings (X-Store-ID)

- `GET /stores/current/settings` - Configuración completa (name, slug, support_email, logo_url, meta, etc.)
- `PATCH /stores/current/settings` - Actualizar (valida slug único)

## Endpoints Themes (X-Store-ID para current)

- `GET /themes/presets` - Lista presets (streetwear, minimal, modern)
- `GET /themes/current` - Tema actual con custom_config
- `PATCH /themes/current` - Actualizar template_name y/o custom_config
- `POST /themes/current/apply-preset/{preset_id}` - Aplicar preset

## Endpoints Products

- `GET /products` - Lista con ?search, ?status, ?category_id, ?sort, ?order, ?skip, ?limit
- `POST /products` - Crear (body con variants, images)
- `GET /products/{id}` - Detalle
- `PATCH /products/{id}` - Actualizar
- `DELETE /products/{id}` - Eliminar
- `POST /products/{id}/duplicate?new_slug=` - Duplicar
- Sub-recursos: variants, images (POST, PATCH, DELETE)
