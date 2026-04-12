"""
Schemas de temas.
"""

from typing import Any

from pydantic import BaseModel


class ThemeConfigColors(BaseModel):
    primary: str = "#6366F1"
    secondary: str = "#8B5CF6"
    accent: str = "#22C55E"
    background: str = "#0F172A"
    text: str = "#F8FAFC"


class ThemeConfigTypography(BaseModel):
    font_family: str = "Outfit"
    heading_scale: str = "normal"


class ThemeUpdate(BaseModel):
    """Actualización parcial del tema."""

    template_name: str | None = None
    custom_config: dict[str, Any] | None = None
