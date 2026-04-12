# Nexora - Arquitectura del Sistema

## Visión General

Nexora es un SaaS multi-tenant de e-commerce con inteligencia artificial para ventas.

## Superficies Principales

1. **Landing pública** - Marketing, branding, registro/login
2. **Admin panel** - Gestión de tiendas, productos, pedidos, IA, etc.
3. **Storefront** - Tienda pública por tenant (home, catálogo, carrito, chat IA)

## Stack Tecnológico

- **Backend**: FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis, Celery
- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS, App Router
- **Infra**: Docker, docker-compose

## Estructura del Monorepo

```
nexora/
├── backend/     # API FastAPI
├── frontend/    # Next.js
├── docs/        # Documentación
├── infra/       # Configuración de infraestructura
└── scripts/     # Scripts de utilidad
```

## Multi-tenant

- Cada tienda está aislada por `store_id`
- Todas las entidades críticas incluyen `store_id` para aislamiento
- Middleware de tenant context en cada request

## Seguridad

- JWT para autenticación
- Roles: owner, admin, manager, support
- CORS configurado
- Rate limiting (estructura preparada)
- Auditoría de acciones críticas
