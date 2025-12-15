"""
CSV Loader utility for importing COCA corpus data.

This module provides functionality to parse and load the
COCA word frequency CSV file into the database.
"""

import csv
import logging
from pathlib import Path
from typing import Optional, Generator, Dict, Any
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def parse_float(value: str, default: float = 0.0) -> float:
    """
    Safely parse a float value from string.
    
    Args:
        value: String value to parse
        default: Default value if parsing fails
        
    Returns:
        Parsed float or default value
    """
    try:
        return float(value) if value else default
    except (ValueError, TypeError):
        return default


def parse_int(value: str, default: int = 0) -> int:
    """
    Safely parse an integer value from string.
    
    Args:
        value: String value to parse
        default: Default value if parsing fails
        
    Returns:
        Parsed integer or default value
    """
    try:
        return int(float(value)) if value else default
    except (ValueError, TypeError):
        return default


def read_coca_csv(
    csv_path: Path,
    skip_header: bool = True
) -> Generator[Dict[str, Any], None, None]:
    """
    Read and parse COCA CSV file.
    
    Expected CSV columns:
    rank, lemma, PoS, freq, perMil, %caps, %allC, range, disp,
    blog, web, TVM, spok, fic, mag, news, acad,
    blogPM, webPM, TVMPM, spokPM, ficPM, magPM, newsPM, acadPM
    
    Args:
        csv_path: Path to the CSV file
        skip_header: Whether to skip the first row
        
    Yields:
        Dictionary with parsed word data
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        if skip_header:
            next(reader, None)
        
        for row in reader:
            if len(row) < 25:
                logger.warning(f"Skipping row with insufficient columns: {row[:3]}")
                continue
            
            try:
                yield {
                    # Core data
                    "rank": parse_int(row[0]),
                    "lemma": row[1].strip(),
                    "pos": row[2].strip().lower(),
                    
                    # Frequency statistics
                    "freq": parse_int(row[3]),
                    "per_mil": parse_float(row[4]),
                    "caps_percent": parse_float(row[5]),
                    "all_caps_percent": parse_float(row[6]),
                    "range_value": parse_int(row[7]),
                    "dispersion": parse_float(row[8]),
                    
                    # Genre frequencies (absolute)
                    "blog": parse_int(row[9]),
                    "web": parse_int(row[10]),
                    "tvm": parse_int(row[11]),
                    "spok": parse_int(row[12]),
                    "fic": parse_int(row[13]),
                    "mag": parse_int(row[14]),
                    "news": parse_int(row[15]),
                    "acad": parse_int(row[16]),
                    
                    # Genre frequencies (per million)
                    "blog_pm": parse_float(row[17]),
                    "web_pm": parse_float(row[18]),
                    "tvm_pm": parse_float(row[19]),
                    "spok_pm": parse_float(row[20]),
                    "fic_pm": parse_float(row[21]),
                    "mag_pm": parse_float(row[22]),
                    "news_pm": parse_float(row[23]),
                    "acad_pm": parse_float(row[24])
                }
            except Exception as e:
                logger.error(f"Error parsing row {row[:3]}: {str(e)}")
                continue


def load_words_to_db(
    csv_path: Path,
    db: Session,
    batch_size: int = 100,
    skip_existing: bool = True
) -> Dict[str, int]:
    """
    Load words from CSV into the database.
    
    Args:
        csv_path: Path to the COCA CSV file
        db: SQLAlchemy database session
        batch_size: Number of records to commit at once
        skip_existing: Whether to skip words that already exist
        
    Returns:
        Dictionary with loading statistics
    """
    from models.word import Word
    
    stats = {
        "total_rows": 0,
        "inserted": 0,
        "skipped": 0,
        "errors": 0
    }
    
    batch = []
    
    for word_data in read_coca_csv(csv_path):
        stats["total_rows"] += 1
        
        try:
            # Check if word exists
            if skip_existing:
                existing = db.query(Word).filter(
                    Word.lemma == word_data["lemma"],
                    Word.pos == word_data["pos"]
                ).first()
                
                if existing:
                    stats["skipped"] += 1
                    continue
            
            # Create word object
            word = Word(**word_data)
            batch.append(word)
            
            # Commit batch
            if len(batch) >= batch_size:
                db.add_all(batch)
                db.commit()
                stats["inserted"] += len(batch)
                batch = []
                
                if stats["inserted"] % 500 == 0:
                    logger.info(f"Loaded {stats['inserted']} words...")
        
        except Exception as e:
            logger.error(f"Error loading word '{word_data.get('lemma', '?')}': {str(e)}")
            stats["errors"] += 1
            db.rollback()
    
    # Commit remaining batch
    if batch:
        db.add_all(batch)
        db.commit()
        stats["inserted"] += len(batch)
    
    logger.info(f"CSV loading complete: {stats}")
    return stats


def get_csv_info(csv_path: Path) -> Dict[str, Any]:
    """
    Get information about a COCA CSV file without loading it.
    
    Args:
        csv_path: Path to the CSV file
        
    Returns:
        Dictionary with file information
    """
    if not csv_path.exists():
        return {"error": "File not found", "path": str(csv_path)}
    
    info = {
        "path": str(csv_path),
        "size_bytes": csv_path.stat().st_size,
        "size_mb": round(csv_path.stat().st_size / (1024 * 1024), 2),
        "row_count": 0,
        "columns": [],
        "sample_rows": []
    }
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        # Get header
        header = next(reader, None)
        if header:
            info["columns"] = header
        
        # Count rows and get sample
        for idx, row in enumerate(reader):
            info["row_count"] += 1
            if idx < 5:
                info["sample_rows"].append(row[:5])  # First 5 columns only
    
    return info
