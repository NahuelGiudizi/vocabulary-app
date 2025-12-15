"""
Text-to-Speech router for vocabulary API.

This module provides endpoints for TTS operations:
- Generating audio for text
- Playing pre-generated audio
- Downloading audio files
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
import logging
from pathlib import Path

from database import get_db
from models.word import Word
from models.sentence import Sentence
from services.tts_service import get_tts_service, TTSError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["text-to-speech"])


# Available Edge TTS voices
EDGE_VOICES = {
    'en-US-GuyNeural': 'American Male (Guy)',
    'en-US-JennyNeural': 'American Female (Jenny)',
    'en-US-AriaNeural': 'American Female (Aria)',
    'en-GB-RyanNeural': 'British Male (Ryan)',
    'en-GB-SoniaNeural': 'British Female (Sonia)',
    'en-AU-WilliamNeural': 'Australian Male (William)',
    'en-AU-NatashaNeural': 'Australian Female (Natasha)',
    'en-IN-NeerjaNeural': 'Indian Female (Neerja)',
    'en-IN-PrabhatNeural': 'Indian Male (Prabhat)',
}


class TTSRequest(BaseModel):
    """Request model for TTS generation."""
    text: str = Field(..., min_length=1, max_length=500, description="Text to synthesize")
    mode: Optional[str] = Field(default=None, description="TTS mode: 'edge', 'offline' or 'online'")
    voice: Optional[str] = Field(default=None, description="Edge TTS voice name")


class TTSPregenRequest(BaseModel):
    """Request model for pre-generating audio."""
    word_id: int = Field(..., description="Word ID to pre-generate audio for")
    theme: Optional[str] = Field(default=None, description="Theme filter for sentences")


@router.post("/play")
async def generate_tts(request: TTSRequest):
    """
    Generate TTS audio for given text.
    
    Returns audio as base64-encoded string for immediate playback.
    
    Args:
        request: TTSRequest with text and optional mode
        
    Returns:
        Base64-encoded audio data with metadata
    """
    try:
        tts_service = get_tts_service()
        
        # Set voice if provided
        if request.voice:
            tts_service.voice = request.voice
        
        audio_base64 = await tts_service.get_audio_base64(
            request.text,
            mode=request.mode
        )
        
        if not audio_base64:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate audio"
            )
        
        return {
            "audio": audio_base64,
            "format": "mp3",
            "text": request.text,
            "mode": request.mode or tts_service.mode
        }
        
    except TTSError as e:
        logger.error(f"TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/voices")
async def get_voices():
    """
    Get available TTS voices.
    
    Returns:
        List of available voices with their display names
    """
    tts_service = get_tts_service()
    return {
        "voices": [
            {"id": voice_id, "name": name}
            for voice_id, name in EDGE_VOICES.items()
        ],
        "current": tts_service.voice,
        "mode": tts_service.mode
    }


@router.get("/download")
async def download_audio(
    text: str = Query(..., min_length=1, max_length=500, description="Text to synthesize"),
    mode: Optional[str] = Query(default=None, description="TTS mode")
):
    """
    Generate and download TTS audio file.
    
    Args:
        text: Text to synthesize
        mode: TTS mode override
        
    Returns:
        MP3 audio file download
    """
    try:
        tts_service = get_tts_service()
        
        audio_path = await tts_service.generate_audio(text, mode=mode)
        
        if not audio_path or not audio_path.exists():
            raise HTTPException(
                status_code=500,
                detail="Failed to generate audio file"
            )
        
        # Generate filename from text
        safe_name = "".join(c for c in text[:30] if c.isalnum() or c == " ").strip()
        safe_name = safe_name.replace(" ", "_")
        filename = f"{safe_name}.mp3"
        
        return FileResponse(
            path=audio_path,
            media_type="audio/mpeg",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audio download error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/word/{word_id}")
async def get_word_audio(
    word_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate audio for a word's lemma.
    
    Args:
        word_id: The word ID
        
    Returns:
        Base64-encoded audio for the word
    """
    try:
        word = db.query(Word).filter(Word.id == word_id).first()
        
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        
        tts_service = get_tts_service()
        audio_base64 = await tts_service.get_audio_base64(word.lemma)
        
        if not audio_base64:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
        
        return {
            "word_id": word_id,
            "lemma": word.lemma,
            "audio": audio_base64,
            "format": "mp3"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Word audio error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentence/{sentence_id}")
async def get_sentence_audio(
    sentence_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate audio for a sentence.
    
    Args:
        sentence_id: The sentence ID
        
    Returns:
        Base64-encoded audio for the sentence
    """
    try:
        sentence = db.query(Sentence).filter(Sentence.id == sentence_id).first()
        
        if not sentence:
            raise HTTPException(status_code=404, detail="Sentence not found")
        
        tts_service = get_tts_service()
        audio_base64 = await tts_service.get_audio_base64(sentence.sentence_text)
        
        if not audio_base64:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
        
        return {
            "sentence_id": sentence_id,
            "word_id": sentence.word_id,
            "text": sentence.sentence_text,
            "audio": audio_base64,
            "format": "mp3"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sentence audio error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/word/{word_id}/{sentence_idx}")
async def download_sentence_audio(
    word_id: int,
    sentence_idx: int,
    db: Session = Depends(get_db),
    theme: Optional[str] = Query(default=None, description="Theme filter")
):
    """
    Download audio file for a specific sentence.
    
    Args:
        word_id: The word ID
        sentence_idx: Sentence index (1-based)
        theme: Optional theme filter
        
    Returns:
        MP3 audio file
    """
    try:
        # Get word
        word = db.query(Word).filter(Word.id == word_id).first()
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        
        # Get sentences
        query = db.query(Sentence).filter(Sentence.word_id == word_id)
        if theme:
            query = query.filter(Sentence.theme == theme)
        
        sentences = query.all()
        
        if not sentences or sentence_idx < 1 or sentence_idx > len(sentences):
            raise HTTPException(
                status_code=404,
                detail=f"Sentence {sentence_idx} not found for word {word_id}"
            )
        
        sentence = sentences[sentence_idx - 1]
        
        tts_service = get_tts_service()
        audio_path = await tts_service.generate_audio(sentence.sentence_text)
        
        if not audio_path or not audio_path.exists():
            raise HTTPException(status_code=500, detail="Failed to generate audio")
        
        filename = f"{word.lemma}_sentence_{sentence_idx}.mp3"
        
        return FileResponse(
            path=audio_path,
            media_type="audio/mpeg",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sentence download error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pregenerate")
async def pregenerate_audio(
    request: TTSPregenRequest,
    db: Session = Depends(get_db)
):
    """
    Pre-generate audio files for a word and its sentences.
    
    This creates cached audio files that can be served quickly later.
    
    Args:
        request: TTSPregenRequest with word_id and optional theme
        
    Returns:
        Paths to generated audio files
    """
    try:
        word = db.query(Word).filter(Word.id == request.word_id).first()
        
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        
        # Get sentences
        query = db.query(Sentence).filter(Sentence.word_id == request.word_id)
        if request.theme:
            query = query.filter(Sentence.theme == request.theme)
        
        sentences = query.all()
        sentence_texts = [s.sentence_text for s in sentences]
        
        tts_service = get_tts_service()
        result = await tts_service.pregenerate_word_audio(
            word.lemma,
            sentence_texts,
            word.rank
        )
        
        # Update sentence audio paths in database
        for idx, sentence in enumerate(sentences):
            if idx < len(result.get("sentences", [])):
                sentence.audio_path = result["sentences"][idx]
        
        db.commit()
        
        return {
            "word_id": word.id,
            "lemma": word.lemma,
            "audio_files": result,
            "sentences_processed": len(sentence_texts)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audio pregeneration error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_tts_status():
    """
    Get TTS service status and configuration.
    
    Returns:
        TTS service configuration and cache statistics
    """
    try:
        tts_service = get_tts_service()
        
        # Count cached files
        cache_dir = Path(tts_service.cache_dir)
        cached_files = list(cache_dir.glob("**/*.mp3"))
        
        # Calculate cache size
        cache_size = sum(f.stat().st_size for f in cached_files)
        
        return {
            "mode": tts_service.mode,
            "rate": tts_service.rate,
            "cache_dir": str(tts_service.cache_dir),
            "cached_files": len(cached_files),
            "cache_size_mb": round(cache_size / (1024 * 1024), 2),
            "status": "ready"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@router.delete("/cache")
async def clear_cache(
    max_age_days: int = Query(default=30, ge=1, description="Clear files older than this many days")
):
    """
    Clear old cached audio files.
    
    Args:
        max_age_days: Maximum age of files to keep
        
    Returns:
        Number of files removed
    """
    try:
        tts_service = get_tts_service()
        removed = tts_service.cleanup_cache(max_age_days)
        
        return {
            "removed": removed,
            "max_age_days": max_age_days
        }
        
    except Exception as e:
        logger.error(f"Cache cleanup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
