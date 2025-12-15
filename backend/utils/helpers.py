"""
Helper utilities for the vocabulary application.

This module provides various helper functions used throughout
the application.
"""

import re
import unicodedata
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta


def normalize_text(text: str) -> str:
    """
    Normalize text by removing extra whitespace and normalizing unicode.
    
    Args:
        text: Input text to normalize
        
    Returns:
        Normalized text string
    """
    if not text:
        return ""
    
    # Normalize unicode
    text = unicodedata.normalize("NFKC", text)
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """
    Truncate text to a maximum length.
    
    Args:
        text: Input text to truncate
        max_length: Maximum length including suffix
        suffix: String to append when truncating
        
    Returns:
        Truncated text string
    """
    if not text or len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix


def format_number(number: int) -> str:
    """
    Format a number with thousand separators.
    
    Args:
        number: Integer to format
        
    Returns:
        Formatted string with commas
    """
    return f"{number:,}"


def format_duration(seconds: float) -> str:
    """
    Format duration in seconds to human-readable string.
    
    Args:
        seconds: Duration in seconds
        
    Returns:
        Formatted duration string (e.g., "2h 34m")
    """
    if seconds < 60:
        return f"{seconds:.1f}s"
    
    minutes = seconds / 60
    if minutes < 60:
        return f"{minutes:.1f}m"
    
    hours = minutes / 60
    remaining_minutes = minutes % 60
    
    if hours < 24:
        return f"{int(hours)}h {int(remaining_minutes)}m"
    
    days = hours / 24
    remaining_hours = hours % 24
    return f"{int(days)}d {int(remaining_hours)}h"


def format_eta(seconds: float) -> str:
    """
    Format estimated time to completion.
    
    Args:
        seconds: Estimated seconds remaining
        
    Returns:
        Formatted ETA string
    """
    if seconds <= 0:
        return "Complete"
    
    return f"~{format_duration(seconds)}"


def calculate_progress(current: int, total: int) -> Dict[str, Any]:
    """
    Calculate progress percentage and create progress info.
    
    Args:
        current: Current count
        total: Total count
        
    Returns:
        Dictionary with progress information
    """
    if total <= 0:
        return {"current": current, "total": total, "percent": 0, "remaining": 0}
    
    percent = min(100, (current / total) * 100)
    
    return {
        "current": current,
        "total": total,
        "percent": round(percent, 2),
        "remaining": total - current
    }


def create_search_pattern(search_term: str) -> str:
    """
    Create a SQL LIKE pattern from a search term.
    
    Args:
        search_term: User's search input
        
    Returns:
        SQL LIKE pattern string
    """
    # Escape special characters
    search_term = search_term.replace("%", "\\%").replace("_", "\\_")
    return f"%{search_term}%"


def parse_rank_range(range_str: str) -> tuple:
    """
    Parse a rank range string like "1-1000" or "1000+".
    
    Args:
        range_str: Range string to parse
        
    Returns:
        Tuple of (min_rank, max_rank)
    """
    range_str = range_str.strip()
    
    if "-" in range_str:
        parts = range_str.split("-")
        try:
            return (int(parts[0]), int(parts[1]))
        except (ValueError, IndexError):
            return (1, 5000)
    
    if range_str.endswith("+"):
        try:
            return (int(range_str[:-1]), 5000)
        except ValueError:
            return (1, 5000)
    
    try:
        rank = int(range_str)
        return (rank, rank)
    except ValueError:
        return (1, 5000)


def is_valid_theme(theme: str) -> bool:
    """
    Check if a theme key is valid.
    
    Args:
        theme: Theme key to validate
        
    Returns:
        True if valid, False otherwise
    """
    from config import THEMES
    return theme in THEMES


def is_valid_pos(pos: str) -> bool:
    """
    Check if a part of speech code is valid.
    
    Args:
        pos: POS code to validate
        
    Returns:
        True if valid, False otherwise
    """
    from config import POS_MAPPING
    return pos in POS_MAPPING


def get_complexity_badge(rank: int) -> Dict[str, str]:
    """
    Get a complexity badge based on word rank.
    
    Args:
        rank: Word frequency rank
        
    Returns:
        Dictionary with badge label and color
    """
    if rank <= 1000:
        return {"label": "Basic", "color": "#4CAF50", "level": "simple"}
    elif rank <= 3000:
        return {"label": "Intermediate", "color": "#FF9800", "level": "moderate"}
    else:
        return {"label": "Advanced", "color": "#F44336", "level": "advanced"}


def chunk_list(lst: List, chunk_size: int) -> List[List]:
    """
    Split a list into chunks of specified size.
    
    Args:
        lst: List to split
        chunk_size: Size of each chunk
        
    Returns:
        List of chunks
    """
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a string for use as a filename.
    
    Args:
        filename: Input string
        
    Returns:
        Safe filename string
    """
    # Remove or replace invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    filename = re.sub(r'\s+', '_', filename)
    filename = filename[:100]  # Limit length
    return filename or "unnamed"


def merge_dicts(base: Dict, update: Dict) -> Dict:
    """
    Deep merge two dictionaries.
    
    Args:
        base: Base dictionary
        update: Dictionary with updates
        
    Returns:
        Merged dictionary
    """
    result = base.copy()
    
    for key, value in update.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_dicts(result[key], value)
        else:
            result[key] = value
    
    return result
