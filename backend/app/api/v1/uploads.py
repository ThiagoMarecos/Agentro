"""
Endpoint de subida de archivos (imágenes y videos).
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.v1.auth import get_current_user
from app.config import get_settings
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.user import User

router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
MAX_IMAGE_MB = 5
MAX_VIDEO_MB = 100


@router.post("", response_model=dict)
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
):
    """Sube una imagen o video y devuelve la URL pública."""
    settings = get_settings()
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            "Formato no permitido. Use JPG, PNG, GIF, WebP para imágenes o MP4, WebM, MOV para videos.",
        )

    is_video = ext in VIDEO_EXTENSIONS
    max_mb = MAX_VIDEO_MB if is_video else MAX_IMAGE_MB

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > max_mb:
        raise HTTPException(400, f"Archivo demasiado grande. Máximo {max_mb}MB.")

    sub_dir = "videos" if is_video else ""
    store_dir = UPLOAD_DIR / store.id
    if sub_dir:
        store_dir = store_dir / sub_dir
    store_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = store_dir / filename
    filepath.write_bytes(content)

    url_path = f"/uploads/{store.id}/{sub_dir + '/' if sub_dir else ''}{filename}"
    return {"url": url_path, "type": "video" if is_video else "image"}
