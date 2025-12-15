"""
Generation router for vocabulary API.

This module provides endpoints for sentence generation:
- Starting batch generation jobs
- Checking generation status
- Regenerating sentences for specific words
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
import asyncio
import time
from datetime import datetime
import uuid

from database import get_db
from models.word import Word
from models.sentence import Sentence
from models.generation_log import GenerationLog
from services.ollama_service import (
    get_ollama_service, 
    OllamaService, 
    WordInfo,
    OllamaConnectionError,
    InvalidResponseError
)
from config import settings, THEMES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generate", tags=["generation"])

# In-memory job tracking (for production, use Redis or database)
generation_jobs: Dict[str, Dict[str, Any]] = {}


class BatchGenerateRequest(BaseModel):
    """Request model for batch generation."""
    theme: str = Field(default="qa_manager", description="Theme for sentence generation")
    word_ids: Optional[List[int]] = Field(default=None, description="Specific word IDs to generate")
    rank_min: int = Field(default=1, ge=1, description="Minimum rank to generate")
    rank_max: int = Field(default=5000, ge=1, description="Maximum rank to generate")
    batch_size: int = Field(default=50, ge=1, le=100, description="Words per batch")
    regenerate: bool = Field(default=False, description="Regenerate existing sentences")


class SingleWordRequest(BaseModel):
    """Request model for single word generation."""
    word_id: int = Field(..., description="Word ID to generate sentences for")
    theme: str = Field(default="qa_manager", description="Theme for sentence generation")
    sentences_count: int = Field(default=3, ge=1, le=5, description="Number of sentences")


async def process_generation_batch(
    job_id: str,
    db: Session,
    words: List[Word],
    theme: str,
    batch_size: int = 50
):
    """
    Background task to process generation batches.
    
    Args:
        job_id: Unique job identifier
        db: Database session
        words: List of Word objects to generate sentences for
        theme: Theme for sentence generation
        batch_size: Number of words per Ollama call
    """
    ollama = get_ollama_service()
    total_words = len(words)
    processed = 0
    errors = []
    start_time = time.time()
    
    try:
        generation_jobs[job_id]["status"] = "processing"
        generation_jobs[job_id]["started_at"] = datetime.now().isoformat()
        
        # Process in batches
        for batch_start in range(0, total_words, batch_size):
            batch_end = min(batch_start + batch_size, total_words)
            batch_words = words[batch_start:batch_end]
            batch_number = (batch_start // batch_size) + 1
            total_batches = (total_words + batch_size - 1) // batch_size
            
            generation_jobs[job_id]["current_batch"] = batch_number
            generation_jobs[job_id]["total_batches"] = total_batches
            
            # Convert to WordInfo objects
            word_infos = [
                WordInfo(
                    lemma=w.lemma,
                    pos=w.pos,
                    rank=w.rank,
                    word_id=w.id
                )
                for w in batch_words
            ]
            
            try:
                # Generate sentences
                results = await ollama.generate_sentences_batch(word_infos, theme)
                
                # Store sentences in database
                for result in results:
                    lemma = result.get("lemma", "").lower()
                    sentences = result.get("sentences", [])
                    
                    # Find matching word
                    matching_word = next(
                        (w for w in batch_words if w.lemma.lower() == lemma),
                        None
                    )
                    
                    if matching_word and sentences:
                        # Delete existing sentences for this theme
                        db.query(Sentence).filter(
                            Sentence.word_id == matching_word.id,
                            Sentence.theme == theme
                        ).delete()
                        
                        # Add new sentences
                        for sentence_text in sentences:
                            sentence = Sentence(
                                word_id=matching_word.id,
                                sentence_text=sentence_text,
                                theme=theme
                            )
                            db.add(sentence)
                        
                        processed += 1
                
                db.commit()
                
                # Log batch completion
                log_entry = GenerationLog(
                    batch_number=batch_number,
                    words_processed=len(batch_words),
                    theme=theme,
                    status="completed",
                    duration_seconds=time.time() - start_time,
                    start_word_id=batch_words[0].id if batch_words else None,
                    end_word_id=batch_words[-1].id if batch_words else None
                )
                db.add(log_entry)
                db.commit()
                
            except (OllamaConnectionError, InvalidResponseError) as e:
                error_msg = f"Batch {batch_number} failed: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                
                # Log failure
                log_entry = GenerationLog(
                    batch_number=batch_number,
                    words_processed=0,
                    theme=theme,
                    status="failed",
                    errors=str(e)
                )
                db.add(log_entry)
                db.commit()
            
            # Update progress
            progress = (batch_end / total_words) * 100
            elapsed = time.time() - start_time
            words_per_second = processed / elapsed if elapsed > 0 else 0
            remaining_words = total_words - batch_end
            eta_seconds = remaining_words / words_per_second if words_per_second > 0 else 0
            
            generation_jobs[job_id]["progress"] = round(progress, 2)
            generation_jobs[job_id]["processed"] = processed
            generation_jobs[job_id]["elapsed_seconds"] = round(elapsed, 2)
            generation_jobs[job_id]["eta_seconds"] = round(eta_seconds, 2)
            generation_jobs[job_id]["words_per_minute"] = round(words_per_second * 60, 2)
        
        # Job completed
        generation_jobs[job_id]["status"] = "completed"
        generation_jobs[job_id]["completed_at"] = datetime.now().isoformat()
        generation_jobs[job_id]["errors"] = errors
        generation_jobs[job_id]["final_count"] = processed
        
    except Exception as e:
        logger.error(f"Generation job {job_id} failed: {str(e)}")
        generation_jobs[job_id]["status"] = "failed"
        generation_jobs[job_id]["error"] = str(e)
        generation_jobs[job_id]["errors"] = errors


@router.post("/batch")
async def start_batch_generation(
    request: BatchGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start a batch generation job.
    
    This endpoint starts an asynchronous generation job that processes
    words in batches using Ollama for sentence generation.
    
    Returns:
        Job ID and initial status for tracking progress
    """
    try:
        # Validate theme
        if request.theme not in THEMES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid theme. Available: {list(THEMES.keys())}"
            )
        
        # Check Ollama connection
        ollama = get_ollama_service()
        if not await ollama.check_connection():
            raise HTTPException(
                status_code=503,
                detail="Ollama service is not available. Please ensure Ollama is running."
            )
        
        # Build word query
        query = db.query(Word)
        
        if request.word_ids:
            query = query.filter(Word.id.in_(request.word_ids))
        else:
            query = query.filter(
                Word.rank >= request.rank_min,
                Word.rank <= request.rank_max
            )
        
        # Filter out words that already have sentences (unless regenerating)
        if not request.regenerate:
            query = query.filter(
                ~Word.sentences.any(Sentence.theme == request.theme)
            )
        
        query = query.order_by(Word.rank.asc())
        words = query.all()
        
        if not words:
            return {
                "status": "no_work",
                "message": "No words to generate. All words in range already have sentences for this theme.",
                "theme": request.theme
            }
        
        # Create job
        job_id = str(uuid.uuid4())
        generation_jobs[job_id] = {
            "job_id": job_id,
            "status": "pending",
            "theme": request.theme,
            "total_words": len(words),
            "processed": 0,
            "progress": 0,
            "current_batch": 0,
            "total_batches": (len(words) + request.batch_size - 1) // request.batch_size,
            "created_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
            "errors": [],
            "batch_size": request.batch_size
        }
        
        # Start background task
        background_tasks.add_task(
            process_generation_batch,
            job_id,
            db,
            words,
            request.theme,
            request.batch_size
        )
        
        return {
            "job_id": job_id,
            "status": "started",
            "total_words": len(words),
            "theme": request.theme,
            "message": f"Generation job started for {len(words)} words"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}")
async def get_generation_status(job_id: str):
    """
    Get the status of a generation job.
    
    Args:
        job_id: The unique job identifier
        
    Returns:
        Current job status including progress, ETA, and any errors
    """
    if job_id not in generation_jobs:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} not found"
        )
    
    return generation_jobs[job_id]


@router.get("/jobs")
async def list_generation_jobs(
    status: Optional[str] = None,
    limit: int = 20
):
    """
    List all generation jobs.
    
    Args:
        status: Filter by job status (pending, processing, completed, failed)
        limit: Maximum number of jobs to return
        
    Returns:
        List of generation jobs
    """
    jobs = list(generation_jobs.values())
    
    if status:
        jobs = [j for j in jobs if j["status"] == status]
    
    # Sort by creation time (newest first)
    jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {
        "jobs": jobs[:limit],
        "total": len(generation_jobs)
    }


@router.post("/single")
async def generate_single_word(
    request: SingleWordRequest,
    db: Session = Depends(get_db)
):
    """
    Generate sentences for a single word immediately.
    
    This is a synchronous endpoint that waits for generation to complete.
    Use for individual word regeneration or on-demand generation.
    
    Returns:
        Generated sentences for the word
    """
    try:
        # Get word
        word = db.query(Word).filter(Word.id == request.word_id).first()
        
        if not word:
            raise HTTPException(
                status_code=404,
                detail=f"Word with ID {request.word_id} not found"
            )
        
        # Validate theme
        if request.theme not in THEMES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid theme. Available: {list(THEMES.keys())}"
            )
        
        # Generate sentences
        ollama = get_ollama_service()
        
        if not await ollama.check_connection():
            raise HTTPException(
                status_code=503,
                detail="Ollama service is not available"
            )
        
        word_info = WordInfo(
            lemma=word.lemma,
            pos=word.pos,
            rank=word.rank,
            word_id=word.id
        )
        
        results = await ollama.generate_sentences_batch(
            [word_info],
            request.theme,
            request.sentences_count
        )
        
        if not results or not results[0].get("sentences"):
            raise HTTPException(
                status_code=500,
                detail="Failed to generate sentences"
            )
        
        sentences = results[0]["sentences"]
        
        # Delete existing sentences for this theme
        db.query(Sentence).filter(
            Sentence.word_id == word.id,
            Sentence.theme == request.theme
        ).delete()
        
        # Add new sentences
        new_sentences = []
        for sentence_text in sentences:
            sentence = Sentence(
                word_id=word.id,
                sentence_text=sentence_text,
                theme=request.theme
            )
            db.add(sentence)
            new_sentences.append(sentence)
        
        db.commit()
        
        return {
            "word_id": word.id,
            "lemma": word.lemma,
            "pos": word.pos,
            "theme": request.theme,
            "sentences": [s.to_dict() for s in new_sentences],
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate for word {request.word_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sentences/{word_id}")
async def delete_word_sentences(
    word_id: int,
    db: Session = Depends(get_db),
    theme: Optional[str] = None
):
    """
    Delete sentences for a word.
    
    Args:
        word_id: The word ID
        theme: Optional theme filter (delete only sentences for this theme)
        
    Returns:
        Number of sentences deleted
    """
    try:
        query = db.query(Sentence).filter(Sentence.word_id == word_id)
        
        if theme:
            query = query.filter(Sentence.theme == theme)
        
        count = query.count()
        query.delete()
        db.commit()
        
        return {
            "word_id": word_id,
            "deleted": count,
            "theme": theme
        }
        
    except Exception as e:
        logger.error(f"Failed to delete sentences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
async def get_generation_logs(
    db: Session = Depends(get_db),
    limit: int = 100,
    theme: Optional[str] = None
):
    """
    Get generation history from database logs.
    
    Args:
        limit: Maximum number of logs to return
        theme: Filter by theme
        
    Returns:
        List of generation log entries
    """
    try:
        query = db.query(GenerationLog)
        
        if theme:
            query = query.filter(GenerationLog.theme == theme)
        
        logs = query.order_by(GenerationLog.created_at.desc()).limit(limit).all()
        
        return {
            "logs": [log.to_dict() for log in logs],
            "count": len(logs)
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch generation logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ollama/status")
async def check_ollama_status():
    """
    Check Ollama service availability and list models.
    
    Returns:
        Ollama connection status and available models
    """
    try:
        ollama = get_ollama_service()
        is_connected = await ollama.check_connection()
        
        if is_connected:
            models = await ollama.list_models()
            return {
                "status": "connected",
                "host": ollama.host,
                "current_model": ollama.model,
                "available_models": models
            }
        else:
            return {
                "status": "disconnected",
                "host": ollama.host,
                "message": "Cannot connect to Ollama. Ensure Ollama is running."
            }
            
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
