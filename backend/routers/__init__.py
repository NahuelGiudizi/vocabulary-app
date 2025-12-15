"""
Routers package for vocabulary application.

This package contains all API routers for the FastAPI application.
"""

from routers.words import router as words_router
from routers.generation import router as generation_router
from routers.tts import router as tts_router
from routers.export import router as export_router

__all__ = [
    "words_router",
    "generation_router",
    "tts_router",
    "export_router"
]
