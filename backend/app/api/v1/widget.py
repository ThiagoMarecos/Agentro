"""
Widget endpoint: sirve un archivo JavaScript embebible que crea
una burbuja de chat flotante en sitios externos.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.store import Store
from app.config import get_settings

router = APIRouter()


@router.get("/{store_id}.js")
def get_widget_script(
    store_id: str,
    db: Session = Depends(get_db),
):
    """Sirve el JavaScript del widget de chat para embeber en sitios externos."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        return Response(
            content="/* Nexora: tienda no encontrada */",
            media_type="application/javascript",
            status_code=404,
        )

    if not store.is_active:
        return Response(
            content="/* Nexora: tienda suspendida */",
            media_type="application/javascript",
            status_code=403,
        )

    settings = get_settings()
    # In production, use actual domain. In dev, use localhost:5000
    base_url = f"http://localhost:5000" if settings.debug else "https://nexora.app"
    chat_url = f"{base_url}/chat/{store.slug}"

    js = _build_widget_js(store_id, store.slug, store.name, chat_url)

    return Response(
        content=js,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )


def _build_widget_js(store_id: str, slug: str, name: str, chat_url: str) -> str:
    """Genera el JavaScript del widget de chat."""
    # Escape for JS string safety
    safe_name = (name or "Chat").replace("'", "\\'").replace('"', '\\"')

    return f"""(function(){{
  if(window.__nexoraWidget) return;
  window.__nexoraWidget = true;

  var CHAT_URL = '{chat_url}';
  var STORE_NAME = '{safe_name}';

  // Styles
  var style = document.createElement('style');
  style.textContent = `
    #nexora-widget-btn {{
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #6366f1;
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(99,102,241,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      transition: transform 0.2s, box-shadow 0.2s;
    }}
    #nexora-widget-btn:hover {{
      transform: scale(1.05);
      box-shadow: 0 6px 24px rgba(99,102,241,0.5);
    }}
    #nexora-widget-btn svg {{
      width: 24px;
      height: 24px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }}
    #nexora-widget-frame {{
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 400px;
      height: 600px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 120px);
      border: none;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      z-index: 99998;
      display: none;
      background: white;
    }}
    @media (max-width: 480px) {{
      #nexora-widget-frame {{
        bottom: 0;
        right: 0;
        width: 100vw;
        height: 100vh;
        max-width: 100vw;
        max-height: 100vh;
        border-radius: 0;
      }}
      #nexora-widget-btn {{
        bottom: 16px;
        right: 16px;
      }}
    }}
  `;
  document.head.appendChild(style);

  // Chat icon SVG
  var chatIcon = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  var closeIcon = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  // Button
  var btn = document.createElement('button');
  btn.id = 'nexora-widget-btn';
  btn.innerHTML = chatIcon;
  btn.title = 'Chat con ' + STORE_NAME;
  document.body.appendChild(btn);

  // Iframe
  var frame = document.createElement('iframe');
  frame.id = 'nexora-widget-frame';
  frame.title = 'Chat con ' + STORE_NAME;
  frame.allow = 'clipboard-write';
  document.body.appendChild(frame);

  var isOpen = false;
  var loaded = false;

  btn.addEventListener('click', function() {{
    isOpen = !isOpen;
    if (isOpen) {{
      if (!loaded) {{
        frame.src = CHAT_URL + '?embed=1';
        loaded = true;
      }}
      frame.style.display = 'block';
      btn.innerHTML = closeIcon;
    }} else {{
      frame.style.display = 'none';
      btn.innerHTML = chatIcon;
    }}
  }});
}})();"""
