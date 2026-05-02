"""
Router principal de la API.
"""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_terminal,
    auth,
    users,
    stores,
    onboarding,
    health,
    dashboard,
    themes,
    products,
    categories,
    orders,
    customers,
    conversations,
    ai_agents,
    ai_channels,
    agent_performance,
    agent_lessons,
    next_drop,
    settings,
    storefront,
    uploads,
    chat,
    widget,
    sales_sessions,
    suppliers,
    team,
    payment_methods,
    pos,
    whatsapp,
    whatsapp_webhook,
    pages,
    web_import,
    platform_settings,
)

api_router = APIRouter()

# Health
api_router.include_router(health.router, tags=["health"])

# Auth y usuarios
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Tiendas y onboarding
api_router.include_router(stores.router, prefix="/stores", tags=["stores"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])

# Admin (requieren X-Store-ID)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(themes.router, prefix="/themes", tags=["themes"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(ai_agents.router, prefix="/ai-agents", tags=["ai-agents"])
api_router.include_router(ai_channels.router, prefix="/ai-channels", tags=["ai-channels"])
api_router.include_router(agent_performance.router, prefix="/agent-performance", tags=["agent-performance"])
api_router.include_router(agent_lessons.router, prefix="/agent-lessons", tags=["agent-lessons"])
api_router.include_router(next_drop.router, prefix="/next-drop", tags=["next-drop"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(uploads.router, prefix="/upload", tags=["upload"])
api_router.include_router(sales_sessions.router, prefix="/sales-sessions", tags=["sales-sessions"])
api_router.include_router(suppliers.router, tags=["suppliers"])
api_router.include_router(pages.router, prefix="/pages", tags=["pages"])
api_router.include_router(web_import.router, prefix="/import", tags=["import"])
api_router.include_router(team.router, prefix="/team", tags=["team"])
api_router.include_router(payment_methods.router, prefix="/payment-methods", tags=["payment-methods"])
api_router.include_router(payment_methods.providers_router, prefix="/payment-providers", tags=["payment-providers"])
api_router.include_router(pos.router, prefix="/pos", tags=["pos"])

# WhatsApp (admin, requiere auth)
api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["whatsapp"])

# Chat público (sin auth de admin, solo X-Store-ID)
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])

# WhatsApp webhook (público, llamado por Evolution API)
api_router.include_router(whatsapp_webhook.router, prefix="/whatsapp-webhook", tags=["whatsapp-webhook"])

# Super Admin (requiere is_superadmin)
api_router.include_router(admin.router, prefix="/admin", tags=["super-admin"])
api_router.include_router(platform_settings.router, prefix="/admin/platform-settings", tags=["platform-settings"])
api_router.include_router(admin_terminal.router, prefix="/admin/terminal", tags=["admin-terminal"])

# Widget público (sin auth, sirve JS embebible)
api_router.include_router(widget.router, prefix="/widget", tags=["widget"])

# Storefront público (sin auth)
api_router.include_router(storefront.router, prefix="/storefront", tags=["storefront"])
