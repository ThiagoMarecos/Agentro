"""
Endpoint de subida de archivos (imágenes y videos).
Valida extensión + magic bytes para evitar bypasses de tipo de contenido.
SVG no está permitido por riesgo de XSS.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.user import User

router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
MAX_IMAGE_MB = 5
MAX_VIDEO_MB = 100

# Extensiones permitidas — SVG excluido intencionalmente (riesgo XSS)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS

# Magic bytes para validación de contenido real del archivo
_MAGIC: dict[bytes, set[str]] = {
    b"\xff\xd8\xff":                {".jpg", ".jpeg"},
    b"\x89PNG\r\n\x1a\n":           {".png"},
    b"GIF87a":                      {".gif"},
    b"GIF89a":                      {".gif"},
    b"RIFF":                        {".webp"},   # RIFF....WEBP
    b"\x00\x00\x00\x18ftyp":        {".mp4"},
    b"\x00\x00\x00\x1cftyp":        {".mp4"},
    b"\x00\x00\x00\x20ftyp":        {".mp4"},
    b"ftyp":                        {".mp4", ".mov"},
    b"\x1aE\xdf\xa3":               {".webm"},
}


def _check_magic_bytes(content: bytes, ext: str) -> bool:
    """
    Verifica que los magic bytes del archivo coincidan con la extensión declarada.
    Retorna True si el contenido es consistente con la extensión.
    """
    for magic, valid_exts in _MAGIC.items():
        if content.startswith(magic):
            return ext in valid_exts
        # ftyp puede aparecer a offset 4 en algunos MP4/MOV
        if magic == b"ftyp" and len(content) > 8 and content[4:8] == magic:
            return ext in valid_exts
    # WEBP específico: RIFF + 4 bytes + WEBP
    if content[:4] == b"RIFF" and len(content) > 11 and content[8:12] == b"WEBP":
        return ext in {".webp"}
    return False


def _has_dangerous_content(content: bytes) -> bool:
    """Detecta contenido potencialmente malicioso en los primeros bytes."""
    head = content[:1024].lower()
    dangerous = [b"<?php", b"<script", b"<html", b"<%", b"#!/"]
    return any(head.startswith(d) or d in head for d in dangerous)


@router.post("", response_model=dict)
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
):
    """Sube una imagen o video y devuelve la URL pública."""
    filename = file.filename or ""

    # El archivo se renombra a {uuid}{ext} más abajo, así que el nombre original
    # se descarta. La protección contra shell.php.jpg viene de:
    #   1) magic bytes deben coincidir con la extensión final
    #   2) renombrado a UUID (el .php intermedio nunca llega al disco)
    # Por eso NO rechazamos archivos con múltiples puntos en el nombre
    # (ej: "WhatsApp Image 2024-09-15 at 4.39.21 PM.jpeg" debe ser válido).

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            "Formato no permitido. Use JPG, PNG, GIF o WebP para imágenes; MP4, WebM o MOV para videos. SVG no está permitido.",
        )

    is_video = ext in VIDEO_EXTENSIONS
    max_mb = MAX_VIDEO_MB if is_video else MAX_IMAGE_MB

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > max_mb:
        raise HTTPException(400, f"Archivo demasiado grande. Máximo {max_mb}MB.")

    # Validar magic bytes: el contenido debe coincidir con la extensión declarada
    if not is_video and not _check_magic_bytes(content, ext):
        raise HTTPException(400, "El contenido del archivo no coincide con la extensión declarada.")

    # Bloquear contenido claramente malicioso
    if _has_dangerous_content(content):
        raise HTTPException(400, "Contenido no permitido detectado en el archivo.")

    sub_dir = "videos" if is_video else ""
    store_dir = UPLOAD_DIR / store.id
    if sub_dir:
        store_dir = store_dir / sub_dir
    store_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = f"{uuid.uuid4().hex}{ext}"
    filepath = store_dir / safe_filename
    filepath.write_bytes(content)

    url_path = f"/uploads/{store.id}/{sub_dir + '/' if sub_dir else ''}{safe_filename}"
    return {"url": url_path, "type": "video" if is_video else "image"}
