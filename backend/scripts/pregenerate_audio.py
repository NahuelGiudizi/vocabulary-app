#!/usr/bin/env python3
"""
Audio pre-generation script.

This script pre-generates TTS audio files for vocabulary words
and their example sentences for faster playback.

Usage:
    python scripts/pregenerate_audio.py --top 1000
    python scripts/pregenerate_audio.py --theme qa_manager --all
"""

import argparse
import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from tqdm import tqdm
except ImportError:
    print("Installing tqdm...")
    import os
    os.system(f"{sys.executable} -m pip install tqdm")
    from tqdm import tqdm

from database import SessionLocal
from models.word import Word
from models.sentence import Sentence
from services.tts_service import TTSService
from config import settings


def print_header():
    """Print script header."""
    print()
    print("=" * 60)
    print("  Audio Pre-generation Script")
    print("=" * 60)
    print()


async def pregenerate_audio(
    db,
    tts: TTSService,
    theme: str = None,
    top_n: int = None,
    all_words: bool = False,
    mode: str = "offline"
):
    """
    Pre-generate audio files for words and sentences.
    
    Args:
        db: Database session
        tts: TTS service instance
        theme: Theme filter for sentences
        top_n: Only process top N words by rank
        all_words: Process all words regardless of rank
        mode: TTS mode to use
    """
    # Build query
    query = db.query(Word).order_by(Word.rank.asc())
    
    if top_n and not all_words:
        query = query.limit(top_n)
    
    words = query.all()
    
    print(f"Processing {len(words)} words...")
    print(f"TTS Mode: {mode}")
    print(f"Theme filter: {theme or 'all'}")
    print()
    
    stats = {
        "words_processed": 0,
        "word_audio_generated": 0,
        "sentences_processed": 0,
        "sentence_audio_generated": 0,
        "errors": 0
    }
    
    start_time = datetime.now()
    
    with tqdm(total=len(words), desc="Generating audio", unit="words") as pbar:
        for word in words:
            try:
                # Get sentences
                sentence_query = db.query(Sentence).filter(Sentence.word_id == word.id)
                if theme:
                    sentence_query = sentence_query.filter(Sentence.theme == theme)
                sentences = sentence_query.all()
                
                sentence_texts = [s.sentence_text for s in sentences]
                
                # Generate audio
                result = await tts.pregenerate_word_audio(
                    word.lemma,
                    sentence_texts,
                    word.rank
                )
                
                stats["words_processed"] += 1
                
                if result.get("word"):
                    stats["word_audio_generated"] += 1
                
                stats["sentences_processed"] += len(sentences)
                stats["sentence_audio_generated"] += len(result.get("sentences", []))
                
                # Update sentence audio paths in database
                for idx, sentence in enumerate(sentences):
                    if idx < len(result.get("sentences", [])):
                        sentence.audio_path = result["sentences"][idx]
                
                db.commit()
                
            except Exception as e:
                stats["errors"] += 1
                tqdm.write(f"Error processing '{word.lemma}': {str(e)}")
            
            pbar.update(1)
    
    duration = (datetime.now() - start_time).total_seconds()
    
    print()
    print("=" * 60)
    print("Audio Pre-generation Complete!")
    print()
    print(f"  Words processed: {stats['words_processed']}")
    print(f"  Word audio files: {stats['word_audio_generated']}")
    print(f"  Sentences processed: {stats['sentences_processed']}")
    print(f"  Sentence audio files: {stats['sentence_audio_generated']}")
    print(f"  Errors: {stats['errors']}")
    print(f"  Duration: {duration:.1f} seconds")
    print()
    
    # Calculate cache size
    cache_dir = Path(tts.cache_dir)
    audio_files = list(cache_dir.glob("**/*.mp3"))
    total_size = sum(f.stat().st_size for f in audio_files)
    
    print(f"  Total audio files: {len(audio_files)}")
    print(f"  Total cache size: {total_size / (1024 * 1024):.1f} MB")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Pre-generate TTS audio files for vocabulary"
    )
    parser.add_argument(
        "--top",
        type=int,
        default=1000,
        help="Process top N words by frequency rank (default: 1000)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all words (overrides --top)"
    )
    parser.add_argument(
        "--theme",
        type=str,
        default=None,
        help="Filter sentences by theme"
    )
    parser.add_argument(
        "--mode",
        type=str,
        choices=["offline", "online"],
        default=settings.TTS_MODE,
        help=f"TTS mode (default: {settings.TTS_MODE})"
    )
    
    args = parser.parse_args()
    
    print_header()
    
    # Create services
    db = SessionLocal()
    tts = TTSService(mode=args.mode)
    
    try:
        asyncio.run(pregenerate_audio(
            db,
            tts,
            theme=args.theme,
            top_n=args.top,
            all_words=args.all,
            mode=args.mode
        ))
    except KeyboardInterrupt:
        print("\nAudio generation interrupted.")
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
