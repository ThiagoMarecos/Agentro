"""
Servicio de importación: materializa los datos scrapeados en la base de datos.
Descarga imágenes en paralelo, crea productos y aplica diseño/secciones.
"""

import uuid
import re
import json
import logging
from decimal import Decimal
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx
from sqlalchemy.orm import Session

from app.models.product import Product, ProductImage
from app.models.store import Store, StoreTheme
from app.services.web_scraper import ScrapedProduct, ScrapedDesign, ScrapedSection, REQUEST_HEADERS
from app.services.theme_service import update_store_theme, get_theme_config, get_store_theme

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
MAX_IMAGE_DOWNLOAD_MB = 5
MAX_IMAGES_PER_PRODUCT = 10
MAX_IMAGES_TOTAL = 200
IMAGE_DOWNLOAD_TIMEOUT = 8  # seconds per image
MAX_PARALLEL_DOWNLOADS = 6  # concurrent downloads


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug[:100] or "producto"


def _unique_slug(db: Session, store_id: str, base_slug: str) -> str:
    slug = base_slug
    counter = 0
    while db.query(Product).filter(Product.store_id == store_id, Product.slug == slug).first():
        counter += 1
        slug = f"{base_slug}-{counter}"
    return slug


def _download_single_image(url: str, store_dir: Path, store_id: str) -> str | None:
    """Download one image. Returns local path or None. Thread-safe."""
    if not url or url.startswith("data:"):
        return None
    try:
        # Build Referer from the image URL's origin (helps bypass hotlink protection)
        from urllib.parse import urlparse
        parsed = urlparse(url)
        referer = f"{parsed.scheme}://{parsed.netloc}/"

        headers = {
            **REQUEST_HEADERS,
            "Referer": referer,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        }

        with httpx.Client(
            headers=headers,
            follow_redirects=True,
            timeout=IMAGE_DOWNLOAD_TIMEOUT,
            verify=False,
        ) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                logger.debug(f"Image download HTTP {resp.status_code}: {url}")
                return None

            # Relaxed content-type check: accept anything that looks like an image
            # Many CDNs return wrong content-types (text/html, application/octet-stream, etc.)
            content_type = resp.headers.get("content-type", "").lower()
            body = resp.content

            # Check if response is too small (likely an error page or pixel)
            if len(body) < 500:
                logger.debug(f"Image too small ({len(body)} bytes): {url}")
                return None

            if len(body) > MAX_IMAGE_DOWNLOAD_MB * 1024 * 1024:
                return None

            # Determine file extension from content-type, URL, or magic bytes
            ext = ".jpg"  # default
            if "png" in content_type or url.lower().endswith(".png"):
                ext = ".png"
            elif "webp" in content_type or url.lower().endswith(".webp"):
                ext = ".webp"
            elif "gif" in content_type or url.lower().endswith(".gif"):
                ext = ".gif"
            elif "svg" in content_type or url.lower().endswith(".svg"):
                ext = ".svg"
            elif "avif" in content_type or url.lower().endswith(".avif"):
                ext = ".avif"

            # Detect by magic bytes if content-type is unhelpful
            if "image" not in content_type and "octet-stream" not in content_type:
                # Check magic bytes to verify it's actually an image
                if body[:4] == b'\x89PNG':
                    ext = ".png"
                elif body[:3] == b'\xff\xd8\xff':
                    ext = ".jpg"
                elif body[:4] == b'RIFF' and body[8:12] == b'WEBP':
                    ext = ".webp"
                elif body[:6] in (b'GIF87a', b'GIF89a'):
                    ext = ".gif"
                elif b'<svg' in body[:200]:
                    ext = ".svg"
                else:
                    # Not a recognizable image format
                    logger.debug(f"Unknown content-type '{content_type}' and no image magic bytes: {url}")
                    return None

            filename = f"{uuid.uuid4().hex}{ext}"
            filepath = store_dir / filename
            filepath.write_bytes(body)

            return f"/uploads/{store_id}/{filename}"
    except Exception as e:
        logger.debug(f"Failed to download image {url}: {e}")
        return None


def _download_images_batch(
    urls: list[str],
    store_id: str,
) -> dict[str, str | None]:
    """
    Download multiple images in parallel.
    Returns dict mapping original URL -> local path (or None if failed).
    """
    store_dir = UPLOAD_DIR / store_id
    store_dir.mkdir(parents=True, exist_ok=True)

    results: dict[str, str | None] = {}

    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_DOWNLOADS) as pool:
        future_to_url = {
            pool.submit(_download_single_image, url, store_dir, store_id): url
            for url in urls
        }
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                results[url] = future.result()
            except Exception:
                results[url] = None

    return results


def download_image(url: str, store_id: str) -> str | None:
    """Download a single remote image. For backward compatibility."""
    store_dir = UPLOAD_DIR / store_id
    store_dir.mkdir(parents=True, exist_ok=True)
    return _download_single_image(url, store_dir, store_id)


def import_products(
    db: Session,
    store_id: str,
    products: list[dict],
) -> tuple[int, int]:
    """
    Import scraped products into the store.
    Downloads all images in parallel first, then creates DB records.
    Returns (products_created, images_downloaded).
    """
    # ── Phase 1: Collect all image URLs to download ──
    all_image_urls: list[str] = []
    product_image_map: list[tuple[int, list[str]]] = []  # (product_index, [urls])

    valid_products: list[dict] = []
    for p_data in products:
        if not p_data.get("selected", True):
            continue
        name = (p_data.get("name") or "").strip()
        if not name:
            continue
        valid_products.append(p_data)

        urls = (p_data.get("image_urls") or [])[:MAX_IMAGES_PER_PRODUCT]
        product_image_map.append((len(valid_products) - 1, urls))
        for url in urls:
            if len(all_image_urls) < MAX_IMAGES_TOTAL and url not in all_image_urls:
                all_image_urls.append(url)

    # ── Phase 2: Download all images in parallel ──
    downloaded_map: dict[str, str | None] = {}
    if all_image_urls:
        logger.info(f"Downloading {len(all_image_urls)} images in parallel...")
        downloaded_map = _download_images_batch(all_image_urls, store_id)
        success_count = sum(1 for v in downloaded_map.values() if v)
        logger.info(f"Downloaded {success_count}/{len(all_image_urls)} images")

    # ── Phase 3: Create products + associate images ──
    products_created = 0
    images_downloaded = 0

    for idx, p_data in enumerate(valid_products):
        name = p_data["name"].strip()
        price = p_data.get("price")
        if price is None or price <= 0:
            price = 0.01

        base_slug = _slugify(name)
        slug = _unique_slug(db, store_id, base_slug)

        # Stock quantity (if available from scraping)
        stock_qty = p_data.get("stock_quantity")
        if stock_qty is not None:
            try:
                stock_qty = int(stock_qty)
            except (ValueError, TypeError):
                stock_qty = 0
        else:
            stock_qty = 0

        product = Product(
            id=str(uuid.uuid4()),
            store_id=store_id,
            name=name[:255],
            slug=slug,
            description=(p_data.get("description") or "")[:2000] or None,
            sku=p_data.get("sku"),
            price=Decimal(str(round(price, 2))),
            compare_at_price=(
                Decimal(str(round(p_data["compare_at_price"], 2)))
                if p_data.get("compare_at_price")
                else None
            ),
            status="active",
            is_active=True,
            product_type="simple",
            stock_quantity=stock_qty,
            track_inventory=stock_qty > 0,  # Enable tracking if we found stock data
        )
        db.add(product)
        db.flush()

        # Associate downloaded images
        _, img_urls = product_image_map[idx]
        img_order = 0
        for img_url in img_urls:
            local_path = downloaded_map.get(img_url)
            if local_path:
                img = ProductImage(
                    id=str(uuid.uuid4()),
                    product_id=product.id,
                    store_id=store_id,
                    url=local_path,
                    alt_text=name,
                    sort_order=img_order,
                    is_cover=(img_order == 0),
                )
                db.add(img)
                images_downloaded += 1
                if img_order == 0:
                    product.cover_image_url = local_path
                img_order += 1

        products_created += 1

    db.commit()
    return products_created, images_downloaded


def import_design(
    db: Session,
    store_id: str,
    design: dict,
    sections: list[dict],
) -> bool:
    """
    Apply scraped design (colors, fonts) and sections to the store theme.
    Returns True if design was applied.
    """
    theme = get_store_theme(db, store_id)
    current_config = get_theme_config(theme)

    colors = current_config.get("colors", {})
    if design.get("primary_color"):
        colors["primary"] = design["primary_color"]
    if design.get("secondary_color"):
        colors["secondary"] = design["secondary_color"]
    if design.get("background_color"):
        colors["background"] = design["background_color"]
    if design.get("text_color"):
        colors["text"] = design["text_color"]
    current_config["colors"] = colors

    if design.get("font_heading") or design.get("font_body"):
        typography = current_config.get("typography", {})
        if design.get("font_heading"):
            typography["font_family"] = design["font_heading"]
        current_config["typography"] = typography

    store = db.query(Store).filter(Store.id == store_id).first()
    if design.get("logo_url") and store:
        local_logo = download_image(design["logo_url"], store_id)
        if local_logo:
            store.logo_url = local_logo

    if design.get("favicon_url") and store:
        local_fav = download_image(design["favicon_url"], store_id)
        if local_fav:
            store.favicon_url = local_fav

    if sections:
        imported_sections = _build_sections(sections, store_id)
        if imported_sections:
            existing = current_config.get("sections", [])
            current_config["sections"] = imported_sections + existing

    update_store_theme(db, store_id, custom_config=current_config)
    return True


def _build_sections(sections: list[dict], store_id: str) -> list[dict]:
    """Convert scraped sections into Nexora section config format."""
    result = []
    order = 0

    for s in sections:
        if not s.get("selected", True):
            continue

        s_type = s.get("type", "")
        section_id = f"imported-{s_type}-{uuid.uuid4().hex[:8]}"

        if s_type == "hero":
            bg_image = ""
            if s.get("images"):
                local = download_image(s["images"][0], store_id)
                bg_image = local or ""
            config = {
                "style": "centered",
                "title": s["texts"][0] if s.get("texts") else "",
                "subtitle": s["texts"][1] if len(s.get("texts", [])) > 1 else "",
                "cta_text": "Ver catálogo",
                "bg_image": bg_image,
            }
            result.append({"id": section_id, "type": "hero", "enabled": True, "order": order, "config": config})
            order += 1

        elif s_type == "image_slider":
            # Download slider images in parallel
            img_urls = s.get("images", [])[:8]
            if img_urls:
                batch = _download_images_batch(img_urls, store_id)
                downloaded = [batch[u] for u in img_urls if batch.get(u)]
            else:
                downloaded = []
            if downloaded:
                config = {
                    "images": downloaded,
                    "height": "medium",
                    "autoplay": True,
                    "interval": 5000,
                }
                result.append({"id": section_id, "type": "image_slider", "enabled": True, "order": order, "config": config})
                order += 1

        elif s_type == "featured_products":
            config = {"columns": 4, "count": 8, "show_price": True}
            result.append({"id": section_id, "type": "featured_products", "enabled": True, "order": order, "config": config})
            order += 1

        elif s_type == "newsletter":
            config = {
                "title": s["texts"][0] if s.get("texts") else "Suscribite a nuestro newsletter",
                "description": "",
            }
            result.append({"id": section_id, "type": "newsletter", "enabled": True, "order": order, "config": config})
            order += 1

        elif s_type == "banner":
            config = {
                "title": s["texts"][0] if s.get("texts") else "",
                "subtitle": s["texts"][1] if len(s.get("texts", [])) > 1 else "",
            }
            result.append({"id": section_id, "type": "banner", "enabled": True, "order": order, "config": config})
            order += 1

    return result
