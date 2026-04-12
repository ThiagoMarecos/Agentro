"""
Servicio de relleno automático de productos con IA.
Usa OpenAI GPT-4o para generar la información del producto
y Pexels API para obtener imágenes de alta calidad.
"""

import json
import re
import uuid
from pathlib import Path

import httpx
from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.product import Product

# Mismo directorio de uploads que el endpoint de upload
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


def _get_next_sku(db: Session, store_id: str) -> str:
    """Genera el siguiente SKU disponible sin colisiones."""
    existing_skus = (
        db.query(Product.sku)
        .filter(Product.store_id == store_id, Product.sku.isnot(None))
        .all()
    )
    max_num = 0
    for (sku,) in existing_skus:
        if sku:
            match = re.search(r"\d+$", sku)
            if match:
                max_num = max(max_num, int(match.group()))
    return f"PROD-{str(max_num + 1).zfill(4)}"


def _download_pexels_image(url: str, store_id: str) -> str | None:
    """Descarga una imagen de Pexels y la guarda en uploads. Retorna la URL interna."""
    try:
        store_dir = UPLOAD_DIR / store_id
        store_dir.mkdir(parents=True, exist_ok=True)

        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return None

            content_type = resp.headers.get("content-type", "image/jpeg")
            ext = "jpg"
            if "png" in content_type:
                ext = "png"
            elif "webp" in content_type:
                ext = "webp"

            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = store_dir / filename
            filepath.write_bytes(resp.content)

        return f"/uploads/{store_id}/{filename}"
    except Exception:
        return None


def _search_pexels_images(query: str, pexels_api_key: str, count: int = 3) -> list[dict]:
    """Busca imágenes en Pexels y las descarga. Retorna lista de dicts con url e info."""
    results = []
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": count, "orientation": "portrait"},
                headers={"Authorization": pexels_api_key},
            )
            if resp.status_code != 200:
                return []

            photos = resp.json().get("photos", [])
            for photo in photos[:count]:
                results.append({
                    "pexels_url": photo["src"]["large"],
                    "alt": photo.get("alt", query),
                    "photographer": photo.get("photographer", ""),
                })
    except Exception:
        pass
    return results


def ai_prefill_product(db: Session, store_id: str, description: str) -> dict:
    """
    Genera todos los campos de un producto usando GPT-4o y busca imágenes en Pexels.

    Returns:
        dict con todos los campos listos para llenar el formulario, incluyendo
        una lista de `images` con URLs ya guardadas en el servidor.
    """
    settings = get_settings()

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY no configurada en el servidor.")

    # Categorías disponibles en la tienda
    from app.models.product import Category  # import local para evitar circular
    categories = db.query(Category).filter(Category.store_id == store_id).all()
    cat_list = [{"id": c.id, "name": c.name} for c in categories]

    # SKU siguiente sin colisiones
    next_sku = _get_next_sku(db, store_id)

    # ── Llamada a OpenAI ──────────────────────────────────────────────────────
    client = OpenAI(api_key=settings.openai_api_key)

    system_prompt = (
        "Sos un experto en e-commerce y copywriting para tiendas online latinoamericanas. "
        "Tu tarea es generar información completa y atractiva para un producto de tienda online. "
        "Respondé siempre en español (Argentina/Latam). "
        "Devolvé únicamente JSON válido, sin texto adicional ni markdown."
    )

    user_prompt = f"""Generá la información completa para este producto: "{description}"

Categorías disponibles en la tienda: {json.dumps(cat_list, ensure_ascii=False)}
Próximo SKU disponible: {next_sku}

Devolvé un JSON con exactamente estos campos:
{{
  "name": "nombre comercial del producto (específico y atractivo)",
  "slug": "slug-url-desde-el-nombre-en-minusculas-con-guiones",
  "short_description": "descripción de una línea para listados (máx 120 chars)",
  "description": "descripción completa de 2-3 párrafos, mencionando materiales, características, talles o colores disponibles si aplica, y cuidados",
  "price": precio_de_venta_numerico_en_USD,
  "compare_at_price": precio_original_si_aplica_o_null,
  "sku": "{next_sku}",
  "category_id": "id_de_la_categoría_más_apropiada_o_null_si_no_hay_ninguna",
  "seo_title": "título SEO optimizado máx 60 caracteres",
  "seo_description": "descripción SEO máx 160 caracteres para Google",
  "pexels_query": "2-4 palabras en inglés para buscar imágenes del producto en Pexels"
}}

Importante:
- El precio debe ser realista para el tipo de producto
- Si hay categorías disponibles, elegí la más apropiada
- pexels_query debe ser en inglés y muy específico para obtener buenas fotos del producto
"""

    response = client.chat.completions.create(
        model=settings.openai_default_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    raw = response.choices[0].message.content or "{}"
    product_data = json.loads(raw)

    # ── Imágenes de Pexels ────────────────────────────────────────────────────
    images: list[dict] = []
    pexels_query = product_data.pop("pexels_query", description)

    if settings.pexels_api_key:
        pexels_results = _search_pexels_images(pexels_query, settings.pexels_api_key, count=3)
        for i, photo in enumerate(pexels_results):
            saved_url = _download_pexels_image(photo["pexels_url"], store_id)
            if saved_url:
                images.append({
                    "url": saved_url,
                    "alt": photo["alt"],
                    "is_cover": i == 0,
                    "sort_order": i,
                })

    # Limpiar campos que no deben ir al frontend tal cual
    product_data.pop("pexels_query", None)

    # Asegurar tipos correctos
    product_data["price"] = float(product_data.get("price") or 0)
    cp = product_data.get("compare_at_price")
    product_data["compare_at_price"] = float(cp) if cp else None
    product_data["images"] = images

    return product_data
