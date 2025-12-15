#!/usr/bin/env python3
"""
Batch sentence generation script.

This script generates example sentences for all vocabulary words
using Ollama with detailed progress tracking, checkpointing, and error handling.

Usage:
    python scripts/generate_all.py --theme qa_manager
    python scripts/generate_all.py --theme software_dev --model llama3.1:8b
    python scripts/generate_all.py --theme qa_manager --rank-min 1 --rank-max 100
    python scripts/generate_all.py --resume  # Resume from last checkpoint
"""

import argparse
import asyncio
import sys
import os
import json
import time
from pathlib import Path
from datetime import datetime
from typing import List, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from tqdm import tqdm
except ImportError:
    print("Installing tqdm...")
    os.system(f"{sys.executable} -m pip install tqdm")
    from tqdm import tqdm

from database import SessionLocal
from models.word import Word
from models.sentence import Sentence
from models.generation_log import GenerationLog
from services.ollama_service import (
    OllamaService, 
    WordInfo, 
    OllamaConnectionError,
    InvalidResponseError
)
from config import THEMES, POS_MAPPING, settings

# Checkpoint file path
CHECKPOINT_FILE = Path(__file__).parent / ".generation_checkpoint.json"


def print_banner():
    """Print application banner."""
    print()
    print("=" * 65)
    print("  English Vocabulary Generator v1.0")
    print("  Powered by Ollama")
    print("=" * 65)
    print()


def print_config(theme: str, model: str, total_words: int, batch_size: int, sentences: int):
    """Print generation configuration."""
    theme_config = THEMES.get(theme, {})
    
    print("Configuration:")
    print(f"  Theme: {theme_config.get('name', theme)} {theme_config.get('emoji', '')}")
    print(f"  Model: {model}")
    print(f"  Total words: {total_words:,}")
    print(f"  Batch size: {batch_size}")
    print(f"  Sentences per word: {sentences}")
    print()


def save_checkpoint(
    theme: str,
    model: str,
    last_batch: int,
    last_word_id: int,
    processed: int,
    errors: List[dict]
):
    """Save generation checkpoint for resume functionality."""
    checkpoint = {
        "theme": theme,
        "model": model,
        "last_batch": last_batch,
        "last_word_id": last_word_id,
        "processed": processed,
        "errors": errors,
        "timestamp": datetime.now().isoformat()
    }
    
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(checkpoint, f, indent=2)


def load_checkpoint() -> Optional[dict]:
    """Load checkpoint if exists."""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return None


def clear_checkpoint():
    """Clear checkpoint file after completion."""
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()


async def check_ollama_connection(service: OllamaService) -> bool:
    """Check Ollama connection and display status."""
    print("Checking Ollama connection...")
    
    if await service.check_connection():
        models = await service.list_models()
        print(f"  ✓ Connected to {service.host}")
        print(f"  ✓ Available models: {', '.join(models[:5])}")
        
        if service.model in models or any(m.startswith(service.model.split(':')[0]) for m in models):
            print(f"  ✓ Model '{service.model}' is available")
            return True
        else:
            print(f"  ✗ Model '{service.model}' not found")
            print(f"    Run: ollama pull {service.model}")
            return False
    else:
        print(f"  ✗ Cannot connect to Ollama at {service.host}")
        print("    Ensure Ollama is running: ollama serve")
        return False


async def generate_batch(
    service: OllamaService,
    words: List[Word],
    theme: str,
    sentences_per_word: int,
    max_retries: int = 3
) -> tuple:
    """
    Generate sentences for a batch of words.
    
    Returns:
        Tuple of (results list, error count)
    """
    word_infos = [
        WordInfo(
            lemma=w.lemma,
            pos=w.pos,
            rank=w.rank,
            word_id=w.id
        )
        for w in words
    ]
    
    for attempt in range(max_retries):
        try:
            results = await service.generate_sentences_batch(
                word_infos,
                theme,
                sentences_per_word
            )
            return results, 0
            
        except (OllamaConnectionError, InvalidResponseError) as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** (attempt + 1)
                print(f"\n  Retry {attempt + 1}/{max_retries} in {wait_time}s: {str(e)[:50]}...")
                await asyncio.sleep(wait_time)
            else:
                return [], 1
        except Exception as e:
            print(f"\n  Unexpected error: {str(e)}")
            return [], 1


async def main_async(args):
    """Main async generation function."""
    print_banner()
    
    # Validate theme
    if args.theme not in THEMES:
        print(f"Error: Invalid theme '{args.theme}'")
        print(f"Available themes: {', '.join(THEMES.keys())}")
        sys.exit(1)
    
    # Create Ollama service
    service = OllamaService(model=args.model)
    
    # Check connection
    if not await check_ollama_connection(service):
        sys.exit(1)
    
    print()
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Build word query
        query = db.query(Word).filter(
            Word.rank >= args.rank_min,
            Word.rank <= args.rank_max
        )
        
        # Skip words with existing sentences (unless regenerating)
        if not args.regenerate:
            query = query.filter(
                ~Word.sentences.any(Sentence.theme == args.theme)
            )
        
        # Handle resume
        start_word_id = 0
        if args.resume:
            checkpoint = load_checkpoint()
            if checkpoint and checkpoint.get("theme") == args.theme:
                start_word_id = checkpoint.get("last_word_id", 0)
                print(f"Resuming from word ID {start_word_id}...")
                query = query.filter(Word.id > start_word_id)
        
        query = query.order_by(Word.rank.asc())
        words = query.all()
        
        total_words = len(words)
        
        if total_words == 0:
            print("No words to generate.")
            print("All words in range already have sentences for this theme.")
            print()
            print("Use --regenerate to regenerate existing sentences.")
            return
        
        print_config(
            args.theme,
            args.model,
            total_words,
            args.batch_size,
            args.sentences
        )
        
        # Statistics
        processed = 0
        errors = 0
        error_details = []
        start_time = time.time()
        
        # Calculate batches
        total_batches = (total_words + args.batch_size - 1) // args.batch_size
        
        print("Starting generation...")
        print("-" * 65)
        print()
        
        # Progress bar
        with tqdm(total=total_words, desc="Generating", unit="words") as pbar:
            for batch_num in range(total_batches):
                batch_start = batch_num * args.batch_size
                batch_end = min(batch_start + args.batch_size, total_words)
                batch_words = words[batch_start:batch_end]
                
                # Generate sentences
                results, batch_errors = await generate_batch(
                    service,
                    batch_words,
                    args.theme,
                    args.sentences,
                    args.retries
                )
                
                errors += batch_errors
                
                # Store sentences in database
                if results:
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
                                Sentence.theme == args.theme
                            ).delete()
                            
                            # Add new sentences
                            for sentence_text in sentences:
                                sentence = Sentence(
                                    word_id=matching_word.id,
                                    sentence_text=sentence_text,
                                    theme=args.theme
                                )
                                db.add(sentence)
                            
                            processed += 1
                    
                    db.commit()
                    
                    # Log batch
                    log_entry = GenerationLog(
                        batch_number=batch_num + 1,
                        words_processed=len(batch_words),
                        theme=args.theme,
                        status="completed",
                        duration_seconds=time.time() - start_time,
                        start_word_id=batch_words[0].id if batch_words else None,
                        end_word_id=batch_words[-1].id if batch_words else None
                    )
                    db.add(log_entry)
                    db.commit()
                
                # Save checkpoint
                if batch_words:
                    save_checkpoint(
                        args.theme,
                        args.model,
                        batch_num + 1,
                        batch_words[-1].id,
                        processed,
                        error_details
                    )
                
                # Update progress
                pbar.update(len(batch_words))
                
                # Calculate ETA
                elapsed = time.time() - start_time
                words_per_second = processed / elapsed if elapsed > 0 else 0
                remaining_words = total_words - batch_end
                eta_seconds = remaining_words / words_per_second if words_per_second > 0 else 0
                
                pbar.set_postfix({
                    "batch": f"{batch_num + 1}/{total_batches}",
                    "processed": processed,
                    "errors": errors,
                    "speed": f"{words_per_second * 60:.1f}/min",
                    "ETA": f"{eta_seconds / 60:.0f}m"
                })
                
                # Small delay between batches to avoid overwhelming Ollama
                if batch_num < total_batches - 1:
                    await asyncio.sleep(0.5)
        
        # Final statistics
        total_time = time.time() - start_time
        
        print()
        print("=" * 65)
        print()
        print("✓ Generation complete!")
        print()
        print(f"  Total words: {total_words:,}")
        print(f"  Successfully processed: {processed:,}")
        print(f"  Total sentences: {processed * args.sentences:,}")
        print(f"  Errors: {errors}")
        print(f"  Total time: {total_time / 60:.1f} minutes")
        print(f"  Average speed: {processed / total_time * 60:.1f} words/min")
        print(f"  Theme: {THEMES[args.theme]['name']}")
        print()
        
        # Clear checkpoint on success
        clear_checkpoint()
        
        print("-" * 65)
        print("Next steps:")
        print("  1. Start the web app: uvicorn backend.app:app --reload")
        print("  2. Optionally pregenerate audio: python scripts/pregenerate_audio.py")
        print()
        
    except KeyboardInterrupt:
        print("\n\nGeneration interrupted.")
        print("Use --resume to continue from last checkpoint.")
        sys.exit(1)
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    finally:
        await service.close()
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Generate example sentences for vocabulary words using Ollama"
    )
    parser.add_argument(
        "--theme",
        type=str,
        default="qa_manager",
        choices=list(THEMES.keys()),
        help=f"Theme for sentence generation (default: qa_manager)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=settings.OLLAMA_MODEL,
        help=f"Ollama model to use (default: {settings.OLLAMA_MODEL})"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=settings.BATCH_SIZE,
        help=f"Words per batch (default: {settings.BATCH_SIZE})"
    )
    parser.add_argument(
        "--sentences",
        type=int,
        default=settings.SENTENCES_PER_WORD,
        help=f"Sentences per word (default: {settings.SENTENCES_PER_WORD})"
    )
    parser.add_argument(
        "--rank-min",
        type=int,
        default=1,
        help="Minimum word rank to process (default: 1)"
    )
    parser.add_argument(
        "--rank-max",
        type=int,
        default=5000,
        help="Maximum word rank to process (default: 5000)"
    )
    parser.add_argument(
        "--regenerate",
        action="store_true",
        help="Regenerate sentences even if they already exist"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last checkpoint"
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=settings.MAX_RETRIES,
        help=f"Max retries for failed batches (default: {settings.MAX_RETRIES})"
    )
    
    args = parser.parse_args()
    
    # Run async main
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
