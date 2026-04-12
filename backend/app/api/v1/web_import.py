"""
Endpoints para importar productos, diseño y secciones desde URLs externas.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.user import User
from app.models.store import Store
from app.schemas.import_schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ScrapedProductSchema,
    ScrapedDesignSchema,
    ScrapedSectionSchema,
    ImportRequest,
    ImportResult,
)
from app.services.web_scraper import scrape_url
from app.services.import_service import import_products, import_design
from app.services.audit_service import log_action, get_client_info
from app.services.import_ai_service import (
    detect_source_currency,
    convert_prices,
    generate_missing_descriptions,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Texto legal completo (debe coincidir con el frontend) ──
IMPORT_LEGAL_TEXT = """
TÉRMINOS Y CONDICIONES DE USO — HERRAMIENTA DE IMPORTACIÓN DE PRODUCTOS

Al utilizar la herramienta de importación desde URL de Nexora, el propietario de la cuenta declara y acepta que:

1. Todo el contenido importado (imágenes, textos, precios, descripciones) pertenece a sus respectivos propietarios y está protegido por derechos de autor.

2. El uso de esta herramienta se realiza bajo la exclusiva responsabilidad del propietario de la cuenta. Nexora actúa únicamente como intermediario tecnológico y no se hace responsable por el uso que se le dé a los datos importados.

3. El propietario de la cuenta es el único responsable de verificar que el uso del contenido importado cumple con las leyes de propiedad intelectual, competencia desleal y protección de datos aplicables en su jurisdicción.

4. Esta herramienta es de referencia. El usuario se compromete a modificar y adaptar el contenido importado antes de publicarlo en su tienda.

5. Queda prohibido utilizar esta función para copiar catálogos completos de competidores con fines de competencia desleal.

6. Nexora se reserva el derecho de suspender el acceso a esta funcionalidad si detecta uso indebido o abusivo.

7. Al aceptar estas condiciones, se genera un registro de auditoría con validez de documento legal que incluye: identidad del usuario, fecha y hora, IP, y URL analizada.
""".strip()


class LegalAcceptRequest(BaseModel):
    url: str  # La URL que va a analizar


def _scrape_to_response(
    url: str,
    store: Store | None = None,
    generate_ai_descriptions: bool = False,
) -> AnalyzeResponse:
    """
    Run scraper and convert result to API response.

    If store is provided:
    1. Detect source currency and convert prices to store.currency
    2. (Only if generate_ai_descriptions=True) Generate AI descriptions for products missing one
    """
    try:
        result = scrape_url(url)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Scraping failed for {url}: {e}", exc_info=True)
        raise HTTPException(
            422,
            f"No se pudo analizar el sitio: {type(e).__name__}: {str(e)[:200]}. Verificá la URL e intentá de nuevo.",
        )

    try:
        products_raw = []
        for p in result.products:
            try:
                # Sanitize price — ensure it's a valid float or None
                price = p.price
                if price is not None:
                    price = float(price)
                    if price < 0:
                        price = None

                compare_at_price = p.compare_at_price
                if compare_at_price is not None:
                    compare_at_price = float(compare_at_price)
                    if compare_at_price < 0:
                        compare_at_price = None

                # Sanitize image_urls — ensure all are strings
                image_urls = [str(u) for u in (p.image_urls or []) if u]

                # Sanitize stock
                stock = p.stock_quantity
                if stock is not None:
                    stock = int(stock)

                products_raw.append({
                    "name": (p.name or "Producto sin nombre")[:255],
                    "description": (p.description or "")[:5000] if p.description else None,
                    "price": price,
                    "compare_at_price": compare_at_price,
                    "image_urls": image_urls,
                    "sku": str(p.sku).strip()[:100] if p.sku else None,
                    "stock_quantity": stock,
                })
            except Exception as pe:
                logger.warning(f"Skipping invalid product '{getattr(p, 'name', '?')}': {pe}")
                continue

        # ── AI Post-Processing (only when store is available) ──
        _source_currency = None
        _target_currency = None
        _prices_converted = False
        _ai_descs = 0

        if store and products_raw:
            store_currency = (store.currency or "USD").upper()
            _target_currency = store_currency

            # 1. Detect source currency and convert prices
            # Prefer JSON-LD priceCurrency (most reliable), fallback to TLD heuristic
            _source_currency = result.detected_currency or detect_source_currency(
                url, [p.get("price") for p in products_raw]
            )
            if _source_currency != store_currency:
                logger.info(
                    f"Currency conversion: {_source_currency} → {store_currency} "
                    f"for {len(products_raw)} products"
                )
                products_raw = convert_prices(products_raw, _source_currency, store_currency)
                _prices_converted = True

            # 2. Generate AI descriptions ONLY if user opted in
            if generate_ai_descriptions:
                needs_desc_before = sum(
                    1 for p in products_raw
                    if not p.get("description") or len((p.get("description") or "").strip()) < 30
                )
                try:
                    products_raw = generate_missing_descriptions(products_raw, store_currency, source_url=url)
                    needs_desc_after = sum(
                        1 for p in products_raw
                        if not p.get("description") or len((p.get("description") or "").strip()) < 30
                    )
                    _ai_descs = needs_desc_before - needs_desc_after
                except Exception as e:
                    logger.error(f"AI description generation failed (non-fatal): {e}")

        # Convert to schema objects
        products = [ScrapedProductSchema(**p) for p in products_raw]

        design = ScrapedDesignSchema(
            logo_url=result.design.logo_url,
            favicon_url=result.design.favicon_url,
            primary_color=result.design.primary_color,
            secondary_color=result.design.secondary_color,
            background_color=result.design.background_color,
            text_color=result.design.text_color,
            font_heading=result.design.font_heading,
            font_body=result.design.font_body,
        )

        sections = [
            ScrapedSectionSchema(
                type=s.type,
                images=s.images,
                texts=s.texts,
            )
            for s in result.sections
        ]

        all_images = sum(len(p.image_urls) for p in products)
        all_images += sum(len(s.images) for s in result.sections)

        return AnalyzeResponse(
            store_name=result.store_name or "Tienda",
            products=products,
            design=design,
            sections=sections,
            product_count=len(products),
            image_count=all_images,
            source_currency=_source_currency,
            target_currency=_target_currency,
            prices_converted=_prices_converted,
            ai_descriptions_generated=_ai_descs,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Response conversion failed for {url}: {e}", exc_info=True)
        raise HTTPException(
            500,
            f"Error procesando los datos del sitio: {type(e).__name__}: {str(e)[:200]}",
        )


@router.post("/preview", response_model=AnalyzeResponse)
def analyze_preview(
    data: AnalyzeRequest,
    user: User = Depends(get_current_user),
):
    """
    Analiza una URL sin necesitar store (para onboarding).
    Solo requiere autenticación.
    """
    return _scrape_to_response(data.url)


@router.post("/accept-legal")
def accept_import_legal(
    data: LegalAcceptRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Registra la aceptación de los términos legales de importación.
    Genera un registro de auditoría con validez de documento legal.
    """
    ip, user_agent = get_client_info(request)
    now = datetime.now(timezone.utc).isoformat()

    log_action(
        db,
        action="import.legal_acceptance",
        user_id=user.id,
        store_id=store.id,
        resource_type="import_legal",
        details={
            "accepted_at": now,
            "url_to_analyze": data.url,
            "user_email": user.email,
            "user_name": getattr(user, "name", None) or getattr(user, "full_name", None),
            "store_name": store.name,
            "legal_version": "1.0",
            "legal_text_hash": str(hash(IMPORT_LEGAL_TEXT)),
            "terms_summary": (
                "El propietario de la cuenta acepta total responsabilidad "
                "sobre el contenido importado. Nexora actúa como intermediario "
                "tecnológico sin responsabilidad sobre el uso de los datos."
            ),
        },
        ip_address=ip,
        user_agent=user_agent,
    )

    logger.info(
        f"Legal acceptance logged: user={user.id} store={store.id} "
        f"url={data.url} ip={ip}"
    )

    return {
        "accepted": True,
        "logged_at": now,
        "message": "Aceptación registrada. Este registro tiene validez de documento legal.",
    }


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_url(
    data: AnalyzeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Analiza una URL y retorna preview de productos, diseño y secciones."""
    # Registrar la acción de análisis en auditoría
    ip, user_agent = get_client_info(request)
    log_action(
        db,
        action="import.analyze_url",
        user_id=user.id,
        store_id=store.id,
        resource_type="import",
        details={"url": data.url},
        ip_address=ip,
        user_agent=user_agent,
    )
    return _scrape_to_response(
        data.url,
        store=store,
        generate_ai_descriptions=data.generate_ai_descriptions,
    )


@router.post("/execute", response_model=ImportResult)
def execute_import(
    data: ImportRequest,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Ejecuta la importación de datos confirmados por el usuario."""
    result = ImportResult()
    errors: list[str] = []

    if data.import_products and data.products:
        try:
            selected = [p.model_dump() for p in data.products if p.selected]
            created, downloaded = import_products(db, store.id, selected)
            result.products_imported = created
            result.images_downloaded = downloaded
        except Exception as e:
            logger.error(f"Product import failed: {e}")
            errors.append(f"Error importando productos: {str(e)}")

    if (data.import_design or data.import_sections) and (data.design or data.sections):
        try:
            design_dict = data.design.model_dump() if data.design else {}
            sections_list = [s.model_dump() for s in data.sections if s.selected] if data.import_sections else []
            applied = import_design(db, store.id, design_dict, sections_list)
            result.design_applied = applied
            result.sections_created = len(sections_list)
        except Exception as e:
            logger.error(f"Design import failed: {e}")
            errors.append(f"Error importando diseño: {str(e)}")

    result.errors = errors
    return result
