#!/usr/bin/env python3
"""
Database initialization script.

This script initializes the database and loads COCA corpus data
from the CSV file into the vocabulary database.

Usage:
    python scripts/init_db.py --csv ../data/COCA_WordFrequency.csv
    python scripts/init_db.py --csv ../data/COCA_WordFrequency.csv --reset
"""

import argparse
import sys
import os
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import engine, SessionLocal, Base, init_db, reset_db
from models.word import Word
from models.sentence import Sentence
from models.generation_log import GenerationLog
from utils.csv_loader import load_words_to_db, get_csv_info


def print_header():
    """Print script header."""
    print()
    print("=" * 60)
    print("  Vocabulary Database Initialization Script")
    print("=" * 60)
    print()


def print_stats(db):
    """Print current database statistics."""
    word_count = db.query(Word).count()
    sentence_count = db.query(Sentence).count()
    
    print("\nCurrent Database Statistics:")
    print(f"  Words: {word_count:,}")
    print(f"  Sentences: {sentence_count:,}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Initialize vocabulary database and load COCA data"
    )
    parser.add_argument(
        "--csv",
        type=str,
        required=True,
        help="Path to COCA CSV file"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset database before loading (WARNING: deletes all data)"
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip words that already exist in database"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of records to commit at once"
    )
    parser.add_argument(
        "--info-only",
        action="store_true",
        help="Only show CSV info, don't load data"
    )
    
    args = parser.parse_args()
    
    print_header()
    
    # Validate CSV path
    csv_path = Path(args.csv).resolve()
    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)
    
    print(f"CSV File: {csv_path}")
    print()
    
    # Show CSV info
    print("Analyzing CSV file...")
    info = get_csv_info(csv_path)
    
    if "error" in info:
        print(f"Error: {info['error']}")
        sys.exit(1)
    
    print(f"  Size: {info['size_mb']} MB")
    print(f"  Rows: {info['row_count']:,}")
    print(f"  Columns: {len(info['columns'])}")
    print()
    
    if args.info_only:
        print("Column names:")
        for col in info['columns']:
            print(f"  - {col}")
        print()
        print("Sample data (first 3 rows):")
        for row in info['sample_rows'][:3]:
            print(f"  {row}")
        return
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Reset database if requested
        if args.reset:
            print("WARNING: Resetting database...")
            confirm = input("This will delete ALL data. Continue? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Aborted.")
                sys.exit(0)
            
            reset_db()
            print("Database reset complete.")
        else:
            # Just initialize (create tables if needed)
            init_db()
            print("Database tables initialized.")
        
        print_stats(db)
        
        # Load words
        print("Loading words from CSV...")
        print(f"  Batch size: {args.batch_size}")
        print(f"  Skip existing: {args.skip_existing}")
        print()
        
        start_time = datetime.now()
        
        stats = load_words_to_db(
            csv_path,
            db,
            batch_size=args.batch_size,
            skip_existing=args.skip_existing
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        print()
        print("Loading Complete!")
        print(f"  Total rows processed: {stats['total_rows']:,}")
        print(f"  Words inserted: {stats['inserted']:,}")
        print(f"  Words skipped: {stats['skipped']:,}")
        print(f"  Errors: {stats['errors']}")
        print(f"  Duration: {duration:.1f} seconds")
        print()
        
        print_stats(db)
        
        print("-" * 60)
        print("Database initialization complete!")
        print()
        print("Next steps:")
        print("  1. Start the API server: uvicorn backend.app:app --reload")
        print("  2. Generate sentences: python scripts/generate_all.py --theme qa_manager")
        print()
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
