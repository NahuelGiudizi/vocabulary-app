"""
Export router for vocabulary API.

This module provides endpoints for exporting vocabulary data:
- PDF export
- Anki CSV export
- Audio ZIP export
- JSON/TXT export
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
import io
from pathlib import Path

from database import get_db
from models.word import Word
from models.sentence import Sentence
from services.export_service import get_export_service, ExportError
from config import THEMES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])


class ExportRequest(BaseModel):
    """Request model for export operations."""
    word_ids: Optional[List[int]] = Field(default=None, description="Specific word IDs to export")
    rank_min: int = Field(default=1, ge=1, description="Minimum rank")
    rank_max: int = Field(default=100, ge=1, description="Maximum rank")
    theme: str = Field(default="qa_manager", description="Theme for sentences")
    include_audio: bool = Field(default=False, description="Include audio file references")


def get_words_for_export(
    db: Session,
    word_ids: Optional[List[int]] = None,
    rank_min: int = 1,
    rank_max: int = 100,
    theme: Optional[str] = None
) -> List[dict]:
    """
    Helper function to get words for export.
    
    Args:
        db: Database session
        word_ids: Specific word IDs (optional)
        rank_min: Minimum rank
        rank_max: Maximum rank
        theme: Theme filter for sentences
        
    Returns:
        List of word dictionaries ready for export
    """
    query = db.query(Word)
    
    if word_ids:
        query = query.filter(Word.id.in_(word_ids))
    else:
        query = query.filter(
            Word.rank >= rank_min,
            Word.rank <= rank_max
        )
    
    query = query.order_by(Word.rank.asc())
    words = query.all()
    
    result = []
    for word in words:
        word_dict = word.to_dict(include_sentences=True, theme=theme)
        result.append(word_dict)
    
    return result


@router.post("/pdf")
async def export_pdf(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """
    Export vocabulary to PDF format.
    
    Creates a formatted PDF document with words, sentences,
    and frequency information.
    
    Returns:
        PDF file download
    """
    try:
        if request.theme not in THEMES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid theme. Available: {list(THEMES.keys())}"
            )
        
        words = get_words_for_export(
            db,
            request.word_ids,
            request.rank_min,
            request.rank_max,
            request.theme
        )
        
        if not words:
            raise HTTPException(
                status_code=404,
                detail="No words found for export"
            )
        
        export_service = get_export_service()
        pdf_bytes = export_service.generate_pdf(
            words,
            theme=request.theme,
            include_charts=True
        )
        
        theme_name = THEMES[request.theme]["name"].replace(" ", "_")
        filename = f"vocabulary_{theme_name}_{request.rank_min}-{request.rank_max}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except ExportError as e:
        logger.error(f"PDF export error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected PDF export error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anki")
async def export_anki(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """
    Export vocabulary to Anki-compatible CSV format.
    
    Creates a CSV file that can be imported into Anki
    for flashcard-based learning.
    
    Returns:
        CSV file download
    """
    try:
        if request.theme not in THEMES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid theme. Available: {list(THEMES.keys())}"
            )
        
        words = get_words_for_export(
            db,
            request.word_ids,
            request.rank_min,
            request.rank_max,
            request.theme
        )
        
        if not words:
            raise HTTPException(
                status_code=404,
                detail="No words found for export"
            )
        
        export_service = get_export_service()
        csv_content = export_service.generate_anki_csv(
            words,
            theme=request.theme,
            include_audio_tags=request.include_audio
        )
        
        theme_name = THEMES[request.theme]["name"].replace(" ", "_")
        filename = f"anki_{theme_name}_{request.rank_min}-{request.rank_max}.csv"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Anki export error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audio-batch")
async def export_audio_batch(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """
    Export audio files as ZIP archive.
    
    Creates a ZIP file containing audio files for words
    and their example sentences.
    
    Returns:
        ZIP file download
    """
    try:
        words = get_words_for_export(
            db,
            request.word_ids,
            request.rank_min,
            request.rank_max,
            request.theme
        )
        
        if not words:
            raise HTTPException(
                status_code=404,
                detail="No words found for export"
            )
        
        export_service = get_export_service()
        
        # Get audio directory from config
        from backend.config import AUDIO_DIR
        audio_dir = Path(AUDIO_DIR)
        
        zip_bytes = export_service.generate_audio_zip(words, audio_dir)
        
        theme_name = THEMES.get(request.theme, {}).get("name", "general").replace(" ", "_")
        filename = f"audio_{theme_name}_{request.rank_min}-{request.rank_max}.zip"
        
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audio export error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/json")
async def export_json(
    request: ExportRequest,
    db: Session = Depends(get_db),
    pretty: bool = Query(default=True, description="Format JSON with indentation")
):
    """
    Export vocabulary to JSON format.
    
    Creates a JSON file with complete word and sentence data.
    
    Returns:
        JSON file download
    """
    try:
        words = get_words_for_export(
            db,
            request.word_ids,
            request.rank_min,
            request.rank_max,
            request.theme
        )
        
        if not words:
            raise HTTPException(
                status_code=404,
                detail="No words found for export"
            )
        
        export_service = get_export_service()
        json_content = export_service.generate_json_export(
            words,
            theme=request.theme,
            pretty=pretty
        )
        
        theme_name = THEMES.get(request.theme, {}).get("name", "general").replace(" ", "_")
        filename = f"vocabulary_{theme_name}_{request.rank_min}-{request.rank_max}.json"
        
        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"JSON export error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/txt")
async def export_text(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """
    Export vocabulary to plain text format.
    
    Creates a readable text file with words and sentences.
    
    Returns:
        TXT file download
    """
    try:
        words = get_words_for_export(
            db,
            request.word_ids,
            request.rank_min,
            request.rank_max,
            request.theme
        )
        
        if not words:
            raise HTTPException(
                status_code=404,
                detail="No words found for export"
            )
        
        export_service = get_export_service()
        txt_content = export_service.generate_txt_export(
            words,
            theme=request.theme
        )
        
        theme_name = THEMES.get(request.theme, {}).get("name", "general").replace(" ", "_")
        filename = f"vocabulary_{theme_name}_{request.rank_min}-{request.rank_max}.txt"
        
        return Response(
            content=txt_content,
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Text export error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/formats")
async def list_export_formats():
    """
    List available export formats and their descriptions.
    
    Returns:
        List of export format options
    """
    return {
        "formats": [
            {
                "id": "pdf",
                "name": "PDF Document",
                "description": "Formatted PDF with words, sentences, and frequency charts",
                "mime_type": "application/pdf",
                "extension": ".pdf"
            },
            {
                "id": "anki",
                "name": "Anki Flashcards",
                "description": "CSV format for importing into Anki spaced repetition software",
                "mime_type": "text/csv",
                "extension": ".csv"
            },
            {
                "id": "json",
                "name": "JSON Data",
                "description": "Complete vocabulary data in JSON format for developers",
                "mime_type": "application/json",
                "extension": ".json"
            },
            {
                "id": "txt",
                "name": "Plain Text",
                "description": "Simple text file for reading and printing",
                "mime_type": "text/plain",
                "extension": ".txt"
            },
            {
                "id": "audio-batch",
                "name": "Audio Files (ZIP)",
                "description": "ZIP archive with MP3 audio files for words and sentences",
                "mime_type": "application/zip",
                "extension": ".zip"
            }
        ]
    }
