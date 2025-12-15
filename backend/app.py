"""
Main FastAPI application for the Vocabulary Learning App.

This module initializes the FastAPI application with all routers,
middleware, and configuration for the vocabulary learning API.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from config import settings, THEMES, POS_MAPPING
from database import init_db, engine
from routers import words_router, generation_router, tts_router, export_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("vocabulary_app.log")
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    
    Handles startup and shutdown events for the application.
    """
    # Startup
    logger.info("Starting Vocabulary Learning Application...")
    
    # Initialize database
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
    
    # Ensure static directories exist
    from config import STATIC_DIR, AUDIO_DIR, DATA_DIR
    for directory in [STATIC_DIR, AUDIO_DIR, DATA_DIR]:
        directory.mkdir(parents=True, exist_ok=True)
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Vocabulary Learning Application...")
    
    # Close database connections
    engine.dispose()
    
    # Close Ollama service client
    from services.ollama_service import get_ollama_service
    ollama = get_ollama_service()
    await ollama.close()
    
    logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Vocabulary Learning API",
    description="""
    A professional English vocabulary learning application 
    that helps IT professionals learn the 5,000 most frequent 
    English words through contextually relevant, industry-themed 
    example sentences.
    
    ## Features
    
    - **5,000 Most Frequent Words**: Based on the COCA corpus
    - **AI-Generated Sentences**: Using Ollama for contextual examples
    - **Multiple Themes**: QA Manager, Software Development, Agile, DevOps, Business
    - **Text-to-Speech**: Pronunciation support with offline and online modes
    - **Export Options**: PDF, Anki CSV, JSON, Audio ZIP
    
    ## API Sections
    
    - `/api/words`: Word data and search
    - `/api/generate`: AI sentence generation
    - `/api/tts`: Text-to-Speech operations
    - `/api/export`: Data export functionality
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for unhandled errors.
    """
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )


# Include routers
app.include_router(words_router)
app.include_router(generation_router)
app.include_router(tts_router)
app.include_router(export_router)


# Mount static files for audio
from config import STATIC_DIR
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """
    Root endpoint with application info.
    """
    return {
        "name": "Vocabulary Learning API",
        "version": "1.0.0",
        "description": "Professional English vocabulary learning for IT professionals",
        "documentation": "/docs",
        "endpoints": {
            "words": "/api/words",
            "stats": "/api/words/stats",
            "themes": "/api/words/themes",
            "generate": "/api/generate",
            "tts": "/api/tts",
            "export": "/api/export"
        }
    }


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint for monitoring.
    """
    from sqlalchemy import text
    from backend.database import SessionLocal
    
    health_status = {
        "status": "healthy",
        "database": "unknown",
        "ollama": "unknown"
    }
    
    # Check database
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health_status["database"] = "connected"
    except Exception as e:
        health_status["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check Ollama
    try:
        from backend.services.ollama_service import get_ollama_service
        ollama = get_ollama_service()
        if await ollama.check_connection():
            health_status["ollama"] = "connected"
        else:
            health_status["ollama"] = "disconnected"
    except Exception as e:
        health_status["ollama"] = f"error: {str(e)}"
    
    return health_status


# Configuration info endpoint
@app.get("/api/config", tags=["config"])
async def get_config():
    """
    Get application configuration (non-sensitive).
    """
    return {
        "themes": {
            key: {
                "name": val["name"],
                "emoji": val["emoji"],
                "description": val["description"]
            }
            for key, val in THEMES.items()
        },
        "pos_types": {
            key: {
                "name": val["name"],
                "description": val["description"]
            }
            for key, val in POS_MAPPING.items()
        },
        "generation": {
            "batch_size": settings.BATCH_SIZE,
            "sentences_per_word": settings.SENTENCES_PER_WORD,
            "ollama_model": settings.OLLAMA_MODEL
        },
        "tts": {
            "mode": settings.TTS_MODE,
            "rate": settings.TTS_RATE
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )
