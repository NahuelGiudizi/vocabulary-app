"""
Words router for vocabulary API.

This module provides endpoints for word-related operations:
- Listing words with pagination, filtering, and search
- Getting individual word details
- Statistics and aggregations
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
import logging

from database import get_db
from models.word import Word
from models.sentence import Sentence
from config import POS_MAPPING, THEMES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/words", tags=["words"])


@router.get("")
async def get_words(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=10000, description="Items per page (max 10000 for loading all words)"),
    search: Optional[str] = Query(None, description="Search term for word lemma"),
    pos: Optional[str] = Query(None, description="Filter by part of speech"),
    rank_min: int = Query(1, ge=1, description="Minimum rank"),
    rank_max: int = Query(5050, ge=1, description="Maximum rank"),
    theme: Optional[str] = Query(None, description="Filter sentences by theme"),
    has_sentences: Optional[bool] = Query(None, description="Filter by sentence availability"),
    sort_by: Optional[str] = Query("rank", description="Sort by: rank, alpha, alpha_desc")
):
    """
    Get paginated list of words with optional filtering.
    
    Supports:
    - Text search on lemma
    - Part of speech filtering
    - Rank range filtering
    - Theme-specific sentence filtering
    - Pagination with configurable page size
    
    Returns:
        Dictionary with words, pagination info, and filters applied
    """
    try:
        query = db.query(Word)
        
        # Apply filters
        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(func.lower(Word.lemma).like(search_term))
        
        if pos:
            query = query.filter(Word.pos == pos.lower())
        
        query = query.filter(Word.rank >= rank_min, Word.rank <= rank_max)
        
        # Filter by sentence availability
        if has_sentences is not None:
            if has_sentences:
                query = query.filter(Word.sentences.any())
            else:
                query = query.filter(~Word.sentences.any())
        
        # Get total count before pagination
        total = query.count()
        
        # Apply ordering based on sort_by parameter
        if sort_by == "alpha":
            query = query.order_by(Word.lemma.asc())
        elif sort_by == "alpha_desc":
            query = query.order_by(Word.lemma.desc())
        else:  # default: rank
            query = query.order_by(Word.rank.asc())
        
        # Apply pagination
        query = query.offset((page - 1) * per_page).limit(per_page)
        
        words = query.all()
        
        # Convert to dictionaries
        result_words = []
        for word in words:
            word_dict = word.to_dict(include_sentences=True, theme=theme)
            word_dict["pos_name"] = POS_MAPPING.get(word.pos, {}).get("name", "Unknown")
            result_words.append(word_dict)
        
        return {
            "words": result_words,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": (total + per_page - 1) // per_page,
                "has_next": page * per_page < total,
                "has_prev": page > 1
            },
            "filters": {
                "search": search,
                "pos": pos,
                "rank_min": rank_min,
                "rank_max": rank_max,
                "theme": theme,
                "has_sentences": has_sentences
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching words: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    theme: Optional[str] = Query(None, description="Filter stats by theme")
):
    """
    Get vocabulary statistics.
    
    Returns:
        Statistics including total words, generated sentences,
        breakdown by part of speech and theme
    """
    try:
        # Total words
        total_words = db.query(Word).count()
        
        # Words with sentences (for specific theme or any)
        if theme:
            words_with_sentences = db.query(Word).filter(
                Word.sentences.any(Sentence.theme == theme)
            ).count()
        else:
            words_with_sentences = db.query(Word).filter(
                Word.sentences.any()
            ).count()
        
        # Total sentences
        sentence_query = db.query(Sentence)
        if theme:
            sentence_query = sentence_query.filter(Sentence.theme == theme)
        total_sentences = sentence_query.count()
        
        # By part of speech
        pos_stats = {}
        pos_counts = db.query(
            Word.pos, func.count(Word.id)
        ).group_by(Word.pos).all()
        
        for pos_code, count in pos_counts:
            pos_info = POS_MAPPING.get(pos_code, {})
            pos_stats[pos_code] = {
                "name": pos_info.get("name", "Unknown"),
                "count": count,
                "color": pos_info.get("color", "#FFFFFF")
            }
        
        # By theme
        theme_stats = {}
        theme_counts = db.query(
            Sentence.theme, func.count(func.distinct(Sentence.word_id))
        ).group_by(Sentence.theme).all()
        
        for theme_key, word_count in theme_counts:
            theme_info = THEMES.get(theme_key, {})
            sentence_count = db.query(Sentence).filter(
                Sentence.theme == theme_key
            ).count()
            theme_stats[theme_key] = {
                "name": theme_info.get("name", theme_key),
                "emoji": theme_info.get("emoji", "📝"),
                "words_generated": word_count,
                "sentences_generated": sentence_count
            }
        
        # Generation progress
        progress = (words_with_sentences / total_words * 100) if total_words > 0 else 0
        
        return {
            "total_words": total_words,
            "words_generated": words_with_sentences,
            "words_pending": total_words - words_with_sentences,
            "total_sentences": total_sentences,
            "generation_progress": round(progress, 2),
            "by_pos": pos_stats,
            "by_theme": theme_stats,
            "current_theme": theme
        }
        
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pos-types")
async def get_pos_types():
    """
    Get available part of speech types.
    
    Returns:
        List of POS types with codes, names, and descriptions
    """
    return {
        "pos_types": [
            {
                "code": code,
                "name": info["name"],
                "description": info["description"],
                "color": info["color"]
            }
            for code, info in POS_MAPPING.items()
        ]
    }


@router.get("/themes")
async def get_themes():
    """
    Get available themes for sentence generation.
    
    Returns:
        List of themes with names, descriptions, and examples
    """
    return {
        "themes": [
            {
                "key": key,
                "name": info["name"],
                "emoji": info["emoji"],
                "description": info["description"],
                "examples": info["examples"]
            }
            for key, info in THEMES.items()
        ]
    }


@router.get("/{word_id}")
async def get_word(
    word_id: int,
    db: Session = Depends(get_db),
    theme: Optional[str] = Query(None, description="Filter sentences by theme")
):
    """
    Get a single word by ID with all its details.
    
    Args:
        word_id: The word's database ID
        theme: Optional theme filter for sentences
        
    Returns:
        Complete word data including all metadata and sentences
    """
    try:
        word = db.query(Word).filter(Word.id == word_id).first()
        
        if not word:
            raise HTTPException(status_code=404, detail=f"Word with ID {word_id} not found")
        
        result = word.to_dict(include_sentences=True, theme=theme)
        result["pos_name"] = POS_MAPPING.get(word.pos, {}).get("name", "Unknown")
        result["pos_description"] = POS_MAPPING.get(word.pos, {}).get("description", "")
        result["complexity_level"] = word.get_complexity_level()
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching word {word_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/by-lemma/{lemma}")
async def get_word_by_lemma(
    lemma: str,
    db: Session = Depends(get_db),
    pos: Optional[str] = Query(None, description="Filter by part of speech"),
    theme: Optional[str] = Query(None, description="Filter sentences by theme")
):
    """
    Get word(s) by lemma.
    
    A lemma may have multiple entries for different parts of speech.
    
    Args:
        lemma: The base form of the word
        pos: Optional part of speech filter
        theme: Optional theme filter for sentences
        
    Returns:
        List of matching word entries
    """
    try:
        query = db.query(Word).filter(func.lower(Word.lemma) == lemma.lower())
        
        if pos:
            query = query.filter(Word.pos == pos.lower())
        
        words = query.order_by(Word.rank.asc()).all()
        
        if not words:
            raise HTTPException(
                status_code=404, 
                detail=f"Word '{lemma}' not found"
            )
        
        result = []
        for word in words:
            word_dict = word.to_dict(include_sentences=True, theme=theme)
            word_dict["pos_name"] = POS_MAPPING.get(word.pos, {}).get("name", "Unknown")
            result.append(word_dict)
        
        return {"words": result, "count": len(result)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching word by lemma '{lemma}': {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rank/{rank}")
async def get_word_by_rank(
    rank: int,
    db: Session = Depends(get_db),
    theme: Optional[str] = Query(None, description="Filter sentences by theme")
):
    """
    Get word(s) at a specific rank.
    
    Args:
        rank: The frequency rank (1-5000)
        theme: Optional theme filter for sentences
        
    Returns:
        List of words at that rank (may be multiple with different POS)
    """
    try:
        if rank < 1 or rank > 5000:
            raise HTTPException(
                status_code=400,
                detail="Rank must be between 1 and 5000"
            )
        
        words = db.query(Word).filter(Word.rank == rank).all()
        
        if not words:
            raise HTTPException(
                status_code=404,
                detail=f"No word found at rank {rank}"
            )
        
        result = []
        for word in words:
            word_dict = word.to_dict(include_sentences=True, theme=theme)
            word_dict["pos_name"] = POS_MAPPING.get(word.pos, {}).get("name", "Unknown")
            result.append(word_dict)
        
        return {"words": result, "rank": rank}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching word at rank {rank}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
