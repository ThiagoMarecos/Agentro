"""
Catálogo estático de providers de pago soportados.

Cada provider tiene:
  - key: identificador único (lowercase, snake_case)
  - name: nombre legible para mostrar en la UI
  - countries: lista de ISO 3166-1 alpha-2 donde aplica (o ["*"] = global)
  - kind: cómo se procesa el cobro
       cash             — efectivo en mano, calcula vuelto
       manual_external  — cobro fuera del sistema (POSnet propio, billetera manual)
       manual_transfer  — transferencia/depósito con comprobante a verificar
       digital_redirect — genera link/QR con API, webhook confirma pago
  - config_fields: lista de campos que el dueño debe llenar al activar
       (ej: account_number, pix_key, mp_access_token)
  - icon: emoji o ícono representativo para la UI
  - description: una línea de qué es
"""

PAYMENT_PROVIDERS: dict = {
    # ── Universal ──────────────────────────────────────────────
    "efectivo": {
        "name": "Efectivo",
        "countries": ["*"],
        "kind": "cash",
        "config_fields": [],
        "icon": "💵",
        "description": "Pago en efectivo con cálculo de vuelto",
    },
    "tarjeta_externa": {
        "name": "Tarjeta (POSnet propio)",
        "countries": ["*"],
        "kind": "manual_external",
        "config_fields": [],
        "icon": "💳",
        "description": "Cobrás con tu propio POSnet/lector y registrás la venta",
    },
    "transferencia": {
        "name": "Transferencia bancaria",
        "countries": ["*"],
        "kind": "manual_transfer",
        "config_fields": [
            {"key": "bank_name", "label": "Banco", "type": "text", "required": True},
            {"key": "account_holder", "label": "Titular", "type": "text", "required": True},
            {"key": "account_number", "label": "Nº de cuenta / CBU / IBAN", "type": "text", "required": True},
            {"key": "tax_id", "label": "CUIT / RUC / Tax ID", "type": "text", "required": False},
            {"key": "alias", "label": "Alias (opcional)", "type": "text", "required": False},
        ],
        "icon": "🏦",
        "description": "Cliente transfiere y sube comprobante para verificar",
    },

    # ── Argentina ──────────────────────────────────────────────
    "mercadopago": {
        "name": "Mercado Pago",
        "countries": ["AR", "BR", "MX", "CL", "UY", "PE", "CO"],
        "kind": "digital_redirect",
        "config_fields": [
            {"key": "access_token", "label": "Access Token", "type": "secret", "required": True},
            {"key": "public_key", "label": "Public Key", "type": "text", "required": True},
            {"key": "webhook_secret", "label": "Webhook Secret", "type": "secret", "required": False},
        ],
        "icon": "💙",
        "description": "Checkout Pro + QR. Cliente paga online y MP confirma vía webhook.",
    },
    "modo": {
        "name": "Modo",
        "countries": ["AR"],
        "kind": "manual_external",
        "config_fields": [
            {"key": "alias", "label": "Alias / Tag MODO", "type": "text", "required": True},
        ],
        "icon": "📲",
        "description": "Cliente paga con app MODO. Verificación manual hasta integración API.",
    },

    # ── Brasil ─────────────────────────────────────────────────
    "pix": {
        "name": "Pix",
        "countries": ["BR"],
        "kind": "manual_transfer",
        "config_fields": [
            {"key": "pix_key", "label": "Chave Pix", "type": "text", "required": True},
            {"key": "pix_key_type", "label": "Tipo (CPF/CNPJ/email/celular/aleatória)", "type": "text", "required": True},
            {"key": "account_holder", "label": "Titular", "type": "text", "required": True},
        ],
        "icon": "⚡",
        "description": "Pagamento instantâneo via Pix. QR estático com tua chave.",
    },

    # ── Paraguay ───────────────────────────────────────────────
    "ueno_bank": {
        "name": "Ueno Bank",
        "countries": ["PY"],
        "kind": "manual_transfer",
        "config_fields": [
            {"key": "account_holder", "label": "Titular", "type": "text", "required": True},
            {"key": "account_number", "label": "Nº de cuenta", "type": "text", "required": True},
            {"key": "ruc", "label": "RUC", "type": "text", "required": False},
        ],
        "icon": "🟣",
        "description": "Transferencia a cuenta de Ueno Bank con verificación manual",
    },
    "sudameris": {
        "name": "Banco Sudameris",
        "countries": ["PY"],
        "kind": "manual_transfer",
        "config_fields": [
            {"key": "account_holder", "label": "Titular", "type": "text", "required": True},
            {"key": "account_number", "label": "Nº de cuenta", "type": "text", "required": True},
            {"key": "ruc", "label": "RUC", "type": "text", "required": False},
        ],
        "icon": "🔴",
        "description": "Transferencia a Sudameris con verificación manual",
    },
    "gnb": {
        "name": "Banco GNB",
        "countries": ["PY"],
        "kind": "manual_transfer",
        "config_fields": [
            {"key": "account_holder", "label": "Titular", "type": "text", "required": True},
            {"key": "account_number", "label": "Nº de cuenta", "type": "text", "required": True},
            {"key": "ruc", "label": "RUC", "type": "text", "required": False},
        ],
        "icon": "🟢",
        "description": "Transferencia a GNB con verificación manual",
    },
    "tigo_money": {
        "name": "Tigo Money",
        "countries": ["PY"],
        "kind": "manual_external",
        "config_fields": [
            {"key": "phone", "label": "Número Tigo Money", "type": "text", "required": True},
            {"key": "account_holder", "label": "Titular", "type": "text", "required": True},
        ],
        "icon": "🟦",
        "description": "Cliente paga con Tigo Money al número del comercio",
    },
    "personal_pay": {
        "name": "Personal Pay",
        "countries": ["PY"],
        "kind": "manual_external",
        "config_fields": [
            {"key": "phone", "label": "Número Personal Pay", "type": "text", "required": True},
            {"key": "account_holder", "label": "Titular", "type": "text", "required": True},
        ],
        "icon": "🟪",
        "description": "Cliente paga con Personal Pay al número del comercio",
    },
    "bancard_qr": {
        "name": "Bancard QR",
        "countries": ["PY"],
        "kind": "manual_external",  # API real cuando consigas acuerdo
        "config_fields": [
            {"key": "merchant_id", "label": "Merchant ID Bancard (cuando lo tengas)", "type": "text", "required": False},
            {"key": "qr_image_url", "label": "URL imagen QR estático", "type": "text", "required": False},
        ],
        "icon": "🟧",
        "description": "Pago QR Bancard. Manual hasta integración API (acuerdo comercial).",
    },

    # ── México ─────────────────────────────────────────────────
    "spei": {
        "name": "SPEI",
        "countries": ["MX"],
        "kind": "manual_transfer",
        "config_fields": [
            {"key": "clabe", "label": "CLABE", "type": "text", "required": True},
            {"key": "bank_name", "label": "Banco", "type": "text", "required": True},
            {"key": "account_holder", "label": "Titular", "type": "text", "required": True},
        ],
        "icon": "🇲🇽",
        "description": "Transferencia SPEI con verificación manual",
    },
    "oxxo": {
        "name": "OXXO",
        "countries": ["MX"],
        "kind": "manual_external",
        "config_fields": [],
        "icon": "🟥",
        "description": "Cobrar en OXXO (manual hasta integración con Conekta/MP)",
    },

    # ── Chile ──────────────────────────────────────────────────
    "webpay": {
        "name": "Webpay (Transbank)",
        "countries": ["CL"],
        "kind": "manual_external",
        "config_fields": [
            {"key": "merchant_code", "label": "Código de comercio", "type": "text", "required": False},
        ],
        "icon": "🇨🇱",
        "description": "Webpay manual hasta integrar API de Transbank",
    },

    # ── Internacional ──────────────────────────────────────────
    "stripe": {
        "name": "Stripe",
        "countries": ["US", "CA", "GB", "EU", "*"],
        "kind": "digital_redirect",
        "config_fields": [
            {"key": "secret_key", "label": "Secret Key (sk_live_...)", "type": "secret", "required": True},
            {"key": "publishable_key", "label": "Publishable Key (pk_live_...)", "type": "text", "required": True},
            {"key": "webhook_secret", "label": "Webhook Secret (whsec_...)", "type": "secret", "required": False},
        ],
        "icon": "💜",
        "description": "Stripe Checkout + webhook. Tarjeta crédito/débito internacional.",
    },
    "paypal": {
        "name": "PayPal",
        "countries": ["*"],
        "kind": "digital_redirect",
        "config_fields": [
            {"key": "client_id", "label": "Client ID", "type": "text", "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "secret", "required": True},
            {"key": "mode", "label": "Modo (sandbox/live)", "type": "text", "required": True},
        ],
        "icon": "🅿️",
        "description": "PayPal Order API",
    },
}


# Defaults sugeridos por país (en orden de prioridad para mostrar al onboarding)
COUNTRY_DEFAULTS: dict[str, list[str]] = {
    "PY": ["efectivo", "transferencia", "ueno_bank", "personal_pay", "tigo_money", "tarjeta_externa"],
    "AR": ["efectivo", "mercadopago", "transferencia", "modo", "tarjeta_externa"],
    "BR": ["efectivo", "pix", "mercadopago", "tarjeta_externa"],
    "MX": ["efectivo", "spei", "mercadopago", "oxxo", "tarjeta_externa"],
    "CL": ["efectivo", "webpay", "mercadopago", "transferencia", "tarjeta_externa"],
    "UY": ["efectivo", "mercadopago", "transferencia", "tarjeta_externa"],
    "PE": ["efectivo", "mercadopago", "transferencia", "tarjeta_externa"],
    "CO": ["efectivo", "mercadopago", "transferencia", "tarjeta_externa"],
    "US": ["stripe", "paypal", "efectivo"],
    "GB": ["stripe", "paypal", "efectivo"],
    "ES": ["stripe", "transferencia", "paypal", "efectivo"],
}

# Fallback si el país no está mapeado
DEFAULT_FALLBACK = ["efectivo", "transferencia", "tarjeta_externa"]


def get_provider(key: str) -> dict | None:
    """Devuelve la definición del provider o None si no existe."""
    return PAYMENT_PROVIDERS.get(key)


def list_providers_for_country(country_code: str | None) -> list[dict]:
    """Devuelve los providers que aplican a un país (o todos si country_code es None)."""
    cc = (country_code or "").upper()
    out = []
    for key, p in PAYMENT_PROVIDERS.items():
        countries = p.get("countries", [])
        if "*" in countries or cc in countries:
            out.append({"key": key, **p})
    return out


def recommend_for_country(country_code: str | None) -> list[str]:
    """Devuelve la lista ordenada de providers recomendados para un país."""
    cc = (country_code or "").upper()
    return COUNTRY_DEFAULTS.get(cc, DEFAULT_FALLBACK)
