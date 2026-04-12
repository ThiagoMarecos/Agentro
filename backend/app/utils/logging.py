"""
Configuración de logging para Nexora.
Base para logs estructurados y auditoría.
"""

import logging
import sys
from typing import Optional


def setup_logging(
    level: str = "INFO",
    format_string: Optional[str] = None,
) -> None:
    """
    Configura el logging de la aplicación.
    En producción, considerar enviar a servicio externo (Datadog, etc.).
    """
    if format_string is None:
        format_string = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format=format_string,
        handlers=[logging.StreamHandler(sys.stdout)],
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def get_logger(name: str) -> logging.Logger:
    """Obtiene un logger con el nombre del módulo."""
    return logging.getLogger(name)
