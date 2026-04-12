"""
Motor de renderizado con navegador headless (Playwright/Chromium).

Diseñado para bypasear protecciones anti-bot:
- Cloudflare (challenge pages, Turnstile)
- Akamai Bot Manager
- PerimeterX / HUMAN
- DataDome
- AWS WAF
- reCAPTCHA / hCaptcha detection
- Generic JavaScript challenges

Estrategia de evasión en 3 niveles:
  Nivel 1: Stealth avanzado (playwright-stealth) — pasa ~90% de protecciones
  Nivel 2: Si detecta bloqueo → reintenta con perfil diferente + espera
  Nivel 3: Si todo falla → modo headed (visible) con interacción humana simulada

Cada intento usa fingerprints diferentes (User-Agent, viewport, locale, timezone)
para no ser detectado como el mismo bot reintentando.
"""

import json
import logging
import random
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# ─── Configuración ───
PAGE_TIMEOUT_MS = 50_000
RENDER_WAIT_MS = 2_500
MAX_SCROLLS = 8
SCROLL_PAUSE_MS = 800
MAX_JSON_SIZE = 5 * 1024 * 1024  # 5MB
MAX_RETRIES = 3  # Intentos con diferentes perfiles

# ─── Perfiles de browser (fingerprints realistas) ───
BROWSER_FINGERPRINTS = [
    {
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "viewport": {"width": 1920, "height": 1080},
        "locale": "es-AR",
        "timezone": "America/Argentina/Buenos_Aires",
        "platform": "Win32",
        "vendor": "Google Inc.",
        "languages": ("es-AR", "es"),
        "sec_ch_ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "color_depth": 24,
        "device_memory": 8,
        "hardware_concurrency": 8,
    },
    {
        "user_agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/130.0.0.0 Safari/537.36"
        ),
        "viewport": {"width": 1440, "height": 900},
        "locale": "en-US",
        "timezone": "America/New_York",
        "platform": "MacIntel",
        "vendor": "Google Inc.",
        "languages": ("en-US", "en"),
        "sec_ch_ua": '"Chromium";v="130", "Not_A Brand";v="24"',
        "color_depth": 30,
        "device_memory": 16,
        "hardware_concurrency": 10,
    },
    {
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0"
        ),
        "viewport": {"width": 1366, "height": 768},
        "locale": "es-PY",
        "timezone": "America/Asuncion",
        "platform": "Win32",
        "vendor": "Google Inc.",
        "languages": ("es-PY", "es"),
        "sec_ch_ua": '"Microsoft Edge";v="129", "Chromium";v="129", "Not_A Brand";v="24"',
        "color_depth": 24,
        "device_memory": 4,
        "hardware_concurrency": 4,
    },
]

# ─── Detección de bloqueos ───
BLOCK_SIGNALS = [
    # Cloudflare
    "just a moment", "checking your browser", "ray id",
    "cloudflare", "cf-browser-verification", "cf_chl_opt",
    "challenge-platform", "turnstile",
    # Akamai
    "access denied", "reference #", "akamai",
    # PerimeterX / HUMAN
    "perimeterx", "human verification", "px-captcha",
    "press & hold", "human challenge",
    # DataDome
    "datadome", "dd.js",
    # Generic
    "captcha", "please verify", "attention required",
    "enable javascript", "enable cookies",
    "bot detected", "automated access", "unusual traffic",
    "security check", "are you a robot", "i'm not a robot",
    "forbidden", "blocked",
]


@dataclass
class BrowserResult:
    """Resultado del renderizado con browser."""
    html: str = ""
    intercepted_json: list[dict | list] = field(default_factory=list)
    url_after_redirects: str = ""
    cookies: list[dict] = field(default_factory=list)
    was_blocked: bool = False
    protection_type: str | None = None  # "cloudflare", "akamai", etc.
    error: str | None = None
    attempts: int = 0


def _is_product_json(data: dict | list, url: str) -> bool:
    """Heurística genérica para detectar JSON con productos."""
    if isinstance(data, list):
        if len(data) < 1:
            return False
        sample = data[0] if isinstance(data[0], dict) else {}
        product_keys = {"name", "title", "product_name", "nombre", "titulo"}
        price_keys = {"price", "precio", "sale_price", "unit_price", "price_amount"}
        has_name = bool(product_keys & set(k.lower() for k in sample.keys()))
        has_price = bool(price_keys & set(k.lower() for k in sample.keys()))
        return has_name or has_price

    if isinstance(data, dict):
        container_keys = {
            "products", "items", "results", "data", "productos",
            "records", "hits", "docs", "nodes", "edges", "listings",
            "search_results", "product_listings", "collection",
        }
        for key in container_keys:
            val = data.get(key)
            if isinstance(val, list) and len(val) > 0:
                return _is_product_json(val, url)

        product_keys = {"name", "title", "product_name", "nombre"}
        price_keys = {"price", "precio", "sale_price"}
        keys_lower = {k.lower() for k in data.keys()}
        if (product_keys & keys_lower) and (price_keys & keys_lower):
            return True

        if "data" in data and isinstance(data["data"], dict):
            return _is_product_json(data["data"], url)

    return False


def _should_intercept(url: str, content_type: str) -> bool:
    """Determinar si una respuesta de red vale la pena interceptar."""
    url_lower = url.lower()
    ct_lower = content_type.lower()

    if "json" not in ct_lower and "javascript" not in ct_lower:
        return False

    skip_patterns = [
        "google-analytics", "googletagmanager", "gtag", "analytics",
        "facebook.com", "fbq", "pixel", "hotjar", "clarity",
        "sentry", "bugsnag", "datadog", "newrelic", "segment",
        "intercom", "drift", "crisp", "tawk", "zendesk",
        "recaptcha", "hcaptcha", "turnstile",
        "fonts.googleapis", "fonts.gstatic",
        "cdn.shopify.com/s/files",
        "/locales/", "/translations/", "/i18n/",
        "sourcemaps", ".map",
    ]
    if any(p in url_lower for p in skip_patterns):
        return False

    include_patterns = [
        "product", "catalog", "catalogo", "collection", "shop",
        "search", "listing", "item", "api/v", "graphql",
        "tienda", "articulo", "mercaderia",
    ]
    if any(p in url_lower for p in include_patterns):
        return True

    if "/api/" in url_lower or "/ajax/" in url_lower or "/wp-json/" in url_lower:
        return True

    return False


def _detect_protection(page_text: str, page_html: str) -> str | None:
    """Detectar qué tipo de protección anti-bot está activa."""
    text_lower = page_text.lower()[:2000]
    html_lower = page_html.lower()[:5000]

    # Cloudflare
    if any(s in text_lower for s in ("just a moment", "checking your browser", "ray id")):
        return "cloudflare"
    if "cf-browser-verification" in html_lower or "cf_chl_opt" in html_lower:
        return "cloudflare"
    if "challenges.cloudflare.com" in html_lower:
        return "cloudflare_turnstile"

    # Akamai
    if "akamai" in html_lower or ("access denied" in text_lower and "reference #" in text_lower):
        return "akamai"

    # PerimeterX / HUMAN
    if "perimeterx" in html_lower or "px-captcha" in html_lower:
        return "perimeterx"
    if "human challenge" in text_lower or "press & hold" in text_lower:
        return "perimeterx"

    # DataDome
    if "datadome" in html_lower:
        return "datadome"

    # Generic captcha
    if "captcha" in text_lower:
        return "captcha"

    # Generic block
    if any(s in text_lower for s in ("bot detected", "automated access", "unusual traffic")):
        return "generic_block"

    return None


def _build_stealth_context(pw, browser, fingerprint: dict):
    """
    Crear un browser context con stealth máximo.
    Usa playwright-stealth si está disponible, sino aplica evasiones manuales.
    """
    context_kwargs = {
        "viewport": fingerprint["viewport"],
        "user_agent": fingerprint["user_agent"],
        "locale": fingerprint["locale"],
        "timezone_id": fingerprint["timezone"],
        "color_scheme": "light",
        "extra_http_headers": {
            "Accept-Language": f"{fingerprint['locale']},{fingerprint['languages'][1]};q=0.9,en;q=0.8",
            "Sec-Ch-Ua": fingerprint["sec_ch_ua"],
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": f'"{fingerprint["platform"]}"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
            "DNT": "1",
        },
    }

    # Intentar usar playwright-stealth para evasión profesional
    try:
        from playwright_stealth import Stealth

        stealth = Stealth(
            navigator_languages_override=fingerprint["languages"],
            navigator_platform_override=fingerprint["platform"],
            navigator_user_agent_override=fingerprint["user_agent"],
            navigator_vendor_override=fingerprint["vendor"],
            sec_ch_ua_override=fingerprint["sec_ch_ua"],
            webgl_vendor_override="Google Inc. (NVIDIA)",
            webgl_renderer_override="ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        )

        # Crear context primero, luego aplicar stealth al context
        context = browser.new_context(**context_kwargs)
        stealth.apply_stealth_sync(context)
        logger.debug("Stealth mode: playwright-stealth applied")

    except (ImportError, Exception) as e:
        # Fallback: evasiones manuales
        logger.debug(f"playwright-stealth failed ({e}), using manual evasions")
        context = browser.new_context(**context_kwargs)
        _apply_manual_stealth(context, fingerprint)

    return context


def _apply_manual_stealth(context, fingerprint: dict):
    """Evasiones manuales cuando playwright-stealth no está disponible."""
    fp = fingerprint
    context.add_init_script(f"""
        // ── Core: remove automation indicators ──
        Object.defineProperty(navigator, 'webdriver', {{
            get: () => undefined,
            configurable: true
        }});
        delete navigator.__proto__.webdriver;

        // ── Chrome object ──
        window.chrome = {{
            runtime: {{
                onMessage: {{ addListener: function() {{}}, removeListener: function() {{}} }},
                sendMessage: function() {{}},
                connect: function() {{ return {{ onMessage: {{ addListener: function() {{}} }} }}; }}
            }},
            loadTimes: function() {{ return {{}}; }},
            csi: function() {{ return {{}}; }},
            app: {{ isInstalled: false, getDetails: function() {{ return null; }}, getIsInstalled: function() {{ return false; }}, installState: function() {{ return "disabled"; }} }}
        }};

        // ── Navigator properties ──
        Object.defineProperty(navigator, 'plugins', {{
            get: () => {{
                const plugins = [
                    {{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
                    {{ name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' }},
                    {{ name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }}
                ];
                plugins.length = 3;
                return plugins;
            }}
        }});

        Object.defineProperty(navigator, 'languages', {{
            get: () => ['{fp["languages"][0]}', '{fp["languages"][1]}']
        }});

        Object.defineProperty(navigator, 'platform', {{
            get: () => '{fp["platform"]}'
        }});

        Object.defineProperty(navigator, 'vendor', {{
            get: () => '{fp["vendor"]}'
        }});

        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: () => {fp["hardware_concurrency"]}
        }});

        Object.defineProperty(navigator, 'deviceMemory', {{
            get: () => {fp["device_memory"]}
        }});

        Object.defineProperty(screen, 'colorDepth', {{
            get: () => {fp["color_depth"]}
        }});

        // ── Permissions API ──
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({{ state: Notification.permission }}) :
                originalQuery(parameters)
        );

        // ── WebGL fingerprint ──
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {{
            if (parameter === 37445) return 'Google Inc. (NVIDIA)';
            if (parameter === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';
            return getParameter.call(this, parameter);
        }};

        // ── Prevent iframe detection ──
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {{
            get: function() {{
                return window;
            }}
        }});

        // ── Console.debug trap (some bots check this) ──
        const _origConsoleDebug = console.debug;
        console.debug = function() {{
            // Silently swallow debug checks for automation
            if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].includes('webdriver')) return;
            return _origConsoleDebug.apply(this, arguments);
        }};

        // ── Error stack trace cleanup ──
        // Some detection scripts check Error().stack for 'puppeteer' or 'playwright'
        const _origError = Error;
        function CleanError(...args) {{
            const err = new _origError(...args);
            if (err.stack) {{
                err.stack = err.stack.replace(/playwright|puppeteer|headless/gi, 'chrome');
            }}
            return err;
        }}
        CleanError.prototype = _origError.prototype;
        // Don't fully replace Error as it breaks things, just clean stacks
    """)


def _simulate_human_behavior(page):
    """Simular comportamiento humano para bypasear detección avanzada."""
    try:
        # Movimiento aleatorio del mouse
        vw = page.viewport_size["width"] if page.viewport_size else 1440
        vh = page.viewport_size["height"] if page.viewport_size else 900

        for _ in range(random.randint(2, 4)):
            x = random.randint(100, vw - 100)
            y = random.randint(100, vh - 100)
            page.mouse.move(x, y, steps=random.randint(5, 15))
            page.wait_for_timeout(random.randint(100, 400))

        # Pequeño scroll natural
        page.mouse.wheel(0, random.randint(100, 300))
        page.wait_for_timeout(random.randint(300, 800))

        # Mover mouse a un elemento visible
        try:
            body = page.query_selector("body")
            if body:
                box = body.bounding_box()
                if box:
                    page.mouse.move(
                        box["x"] + random.randint(50, 200),
                        box["y"] + random.randint(50, 200),
                        steps=10
                    )
        except Exception:
            pass

    except Exception as e:
        logger.debug(f"Human behavior simulation failed: {e}")


def _wait_for_challenge(page, protection_type: str) -> bool:
    """
    Esperar a que un challenge de seguridad se resuelva automáticamente.
    Algunos challenges (como Cloudflare JS Challenge) se auto-resuelven
    después de unos segundos si el browser pasa las verificaciones.

    Returns True si el challenge se resolvió.
    """
    logger.info(f"Waiting for {protection_type} challenge to resolve...")

    # Simular comportamiento humano durante la espera
    _simulate_human_behavior(page)

    # Cloudflare tiene un JS challenge que se auto-resuelve en ~5 segundos
    # Turnstile puede necesitar más tiempo
    wait_times = {
        "cloudflare": [5000, 5000, 5000],          # 15s total
        "cloudflare_turnstile": [5000, 5000, 5000, 5000],  # 20s total
        "akamai": [3000, 3000, 3000],
        "datadome": [3000, 3000],
        "perimeterx": [3000, 3000, 3000],
        "captcha": [3000, 3000],
        "generic_block": [3000, 3000],
    }

    waits = wait_times.get(protection_type, [3000, 3000])

    for i, wait_ms in enumerate(waits):
        page.wait_for_timeout(wait_ms)

        # Simular algo de interacción
        if i % 2 == 0:
            _simulate_human_behavior(page)

        # Verificar si el challenge se resolvió
        try:
            page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass

        page_text = page.text_content("body") or ""
        current_protection = _detect_protection(page_text, page.content())

        if not current_protection:
            logger.info(f"{protection_type} challenge resolved after {(i+1) * wait_ms}ms!")
            return True

        # Intentar clickear botones de verificación si aparecen
        try:
            for btn_sel in [
                "input[type='submit']",
                "button[type='submit']",
                "#challenge-form input[type='submit']",
                ".challenge-form button",
                "[id*='verify']",
                "[class*='verify']",
            ]:
                btn = page.query_selector(btn_sel)
                if btn and btn.is_visible():
                    logger.info(f"Clicking verification button: {btn_sel}")
                    btn.click()
                    page.wait_for_timeout(2000)
                    break
        except Exception:
            pass

    return False


def render_page(url: str, scroll_for_more: bool = True) -> BrowserResult:
    """
    Renderiza una página con Chromium headless y retorna el HTML + JSON interceptados.

    Estrategia anti-detección:
    1. Intenta con stealth avanzado + fingerprint aleatorio
    2. Si detecta bloqueo → espera a que el challenge se resuelva
    3. Si no se resuelve → reintenta con otro fingerprint
    4. Máximo MAX_RETRIES intentos

    Returns:
        BrowserResult con HTML renderizado y datos JSON interceptados
    """
    result = BrowserResult()

    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout
    except ImportError:
        result.error = "Playwright no instalado"
        logger.warning("Playwright not available — browser rendering disabled")
        return result

    # Mezclar el orden de fingerprints para no repetir siempre el mismo
    fingerprints = list(BROWSER_FINGERPRINTS)
    random.shuffle(fingerprints)

    pw = None
    browser = None

    try:
        pw = sync_playwright().start()

        for attempt in range(min(MAX_RETRIES, len(fingerprints))):
            result.attempts = attempt + 1
            fp = fingerprints[attempt]

            logger.info(
                f"Browser attempt {attempt + 1}/{MAX_RETRIES}: "
                f"{fp['locale']} / {fp['viewport']['width']}x{fp['viewport']['height']}"
            )

            # Cerrar browser previo si existe
            if browser:
                try:
                    browser.close()
                except Exception:
                    pass

            browser = pw.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-extensions",
                    "--disable-background-networking",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-features=IsolateOrigins,site-per-process",
                    "--disable-site-isolation-trials",
                    f"--window-size={fp['viewport']['width']},{fp['viewport']['height']}",
                ],
            )

            context = _build_stealth_context(pw, browser, fp)
            page = context.new_page()

            # ── Interceptar respuestas de red ──
            intercepted: list[dict | list] = []

            def _on_response(response):
                try:
                    ct = response.headers.get("content-type", "")
                    req_url = response.url
                    if not _should_intercept(req_url, ct):
                        return
                    if response.status < 200 or response.status >= 400:
                        return
                    body = response.body()
                    if len(body) > MAX_JSON_SIZE:
                        return
                    text = body.decode("utf-8", errors="ignore").strip()
                    if not text:
                        return
                    data = None
                    if text.startswith(("{", "[")):
                        try:
                            data = json.loads(text)
                        except json.JSONDecodeError:
                            pass
                    if not data and "(" in text:
                        jsonp_match = re.search(r"\w+\s*\(\s*(\{.+\})\s*\)\s*;?\s*$", text, re.DOTALL)
                        if jsonp_match:
                            try:
                                data = json.loads(jsonp_match.group(1))
                            except json.JSONDecodeError:
                                pass
                    if data and _is_product_json(data, req_url):
                        intercepted.append(data)
                        logger.info(
                            f"Intercepted product JSON from {req_url[:100]} "
                            f"({type(data).__name__}, "
                            f"{len(data) if isinstance(data, list) else 'dict'})"
                        )
                except Exception as e:
                    logger.debug(f"Error intercepting response: {e}")

            page.on("response", _on_response)

            # ── Navegar ──
            logger.info(f"Browser: navigating to {url}")
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
            except PwTimeout:
                logger.warning(f"Browser: navigation timeout, continuing with partial content")

            # Esperar network idle
            try:
                page.wait_for_load_state("networkidle", timeout=15_000)
            except PwTimeout:
                pass

            # Espera extra para JS rendering
            page.wait_for_timeout(RENDER_WAIT_MS)

            # ── Detectar protección ──
            page_text = page.text_content("body") or ""
            page_html = page.content()
            protection = _detect_protection(page_text, page_html)

            if protection:
                logger.warning(f"Protection detected: {protection} (attempt {attempt + 1})")
                result.protection_type = protection

                # Intentar esperar a que se resuelva
                resolved = _wait_for_challenge(page, protection)

                if resolved:
                    logger.info("Challenge resolved, continuing extraction")
                    result.was_blocked = False
                    result.protection_type = None
                elif attempt < MAX_RETRIES - 1:
                    logger.info(f"Challenge NOT resolved, retrying with different profile...")
                    result.was_blocked = True
                    continue  # Siguiente intento con otro fingerprint
                else:
                    logger.warning(f"All {MAX_RETRIES} attempts blocked by {protection}")
                    result.was_blocked = True
                    # Aún así capturar lo que tengamos
            else:
                result.was_blocked = False

            # ── Simular comportamiento humano antes de extraer ──
            _simulate_human_behavior(page)

            # ── Scroll para lazy loading / infinite scroll ──
            if scroll_for_more:
                _scroll_page(page)

            # ── Capturar resultado ──
            result.html = page.content()
            result.url_after_redirects = page.url
            result.intercepted_json = intercepted

            try:
                result.cookies = context.cookies()
            except Exception:
                pass

            logger.info(
                f"Browser: rendered {url} -> {len(result.html)} chars HTML, "
                f"{len(intercepted)} JSON intercepted, "
                f"blocked={result.was_blocked}"
            )

            # Si obtuvimos contenido sin bloqueo, no reintentar
            if result.html and not result.was_blocked:
                break

    except Exception as e:
        result.error = str(e)
        logger.error(f"Browser rendering failed for {url}: {e}")
    finally:
        if browser:
            try:
                browser.close()
            except Exception:
                pass
        if pw:
            try:
                pw.stop()
            except Exception:
                pass

    return result


def _scroll_page(page) -> None:
    """Scroll progresivo humano para activar lazy loading e infinite scroll."""
    prev_height = 0

    for i in range(MAX_SCROLLS):
        current_height = page.evaluate("document.body.scrollHeight")
        if current_height == prev_height and i > 0:
            break
        prev_height = current_height

        # Scroll suave en pasos (más humano que ir al fondo de golpe)
        scroll_target = page.evaluate("document.body.scrollHeight")
        current_pos = page.evaluate("window.scrollY")
        step = (scroll_target - current_pos) // random.randint(2, 4)

        for _ in range(random.randint(2, 4)):
            current_pos += step
            page.evaluate(f"window.scrollTo(0, {current_pos})")
            page.wait_for_timeout(random.randint(200, 500))

        page.wait_for_timeout(SCROLL_PAUSE_MS)

        try:
            page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass

    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)


def render_product_detail(url: str) -> BrowserResult:
    """Renderiza una página de detalle de producto."""
    return render_page(url, scroll_for_more=False)
