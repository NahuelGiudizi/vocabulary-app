"""
Export SQLite database to static JSON files for GitHub Pages deployment.

This script exports all words and sentences to JSON files that can be
served statically without a backend.

Usage:
    python export_to_static.py

Output:
    frontend/public/data/words.json      - All words with sentences
    frontend/public/data/config.json     - App configuration
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Database path
DB_PATH = Path(__file__).parent.parent / "data" / "vocabulary.db"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "frontend" / "public" / "data"

# Config from backend
POS_MAPPING = {
    "a": {"name": "Article", "color": "gray"},
    "c": {"name": "Conjunction", "color": "purple"},
    "d": {"name": "Determiner", "color": "pink"},
    "e": {"name": "Existential there", "color": "gray"},
    "i": {"name": "Preposition", "color": "cyan"},
    "j": {"name": "Adjective", "color": "green"},
    "m": {"name": "Number", "color": "orange"},
    "n": {"name": "Noun", "color": "blue"},
    "p": {"name": "Pronoun", "color": "indigo"},
    "r": {"name": "Adverb", "color": "yellow"},
    "t": {"name": "Infinitive marker", "color": "gray"},
    "u": {"name": "Interjection", "color": "red"},
    "v": {"name": "Verb", "color": "emerald"},
    "x": {"name": "Negation", "color": "rose"},
}

THEMES = {
    "qa_manager": {
        "name": "QA Manager",
        "emoji": "🧪",
        "description": "Software quality assurance and testing"
    },
    "general_business": {
        "name": "General Business",
        "emoji": "💼",
        "description": "Professional business communication"
    },
    "daily_life": {
        "name": "Daily Life",
        "emoji": "🏠",
        "description": "Everyday situations and conversations"
    },
    "academic": {
        "name": "Academic",
        "emoji": "📚",
        "description": "Educational and scholarly contexts"
    },
    "technology": {
        "name": "Technology",
        "emoji": "💻",
        "description": "Tech industry and computing"
    },
}

def get_complexity_level(rank: int) -> str:
    """Get complexity level based on rank."""
    if rank <= 1000:
        return "Basic"
    elif rank <= 2000:
        return "Intermediate"
    elif rank <= 3500:
        return "Upper-Intermediate"
    else:
        return "Advanced"


def export_words():
    """Export all words with sentences to JSON."""
    print(f"📂 Database: {DB_PATH}")
    print(f"📁 Output: {OUTPUT_DIR}")
    
    if not DB_PATH.exists():
        print(f"❌ Database not found: {DB_PATH}")
        return False
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Connect to database
    engine = create_engine(f"sqlite:///{DB_PATH}")
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Query all words with sentences
        from sqlalchemy import text
        
        # Get all words
        words_result = session.execute(text("""
            SELECT 
                id, rank, lemma, pos, freq, per_mil,
                caps_percent, all_caps_percent, range_value, dispersion,
                blog, web, tvm, spok, fic, mag, news, acad,
                blog_pm, web_pm, tvm_pm, spok_pm, fic_pm, mag_pm, news_pm, acad_pm
            FROM words
            ORDER BY rank ASC
        """))
        
        words = []
        word_ids = []
        
        for row in words_result:
            word = {
                "id": row.id,
                "rank": row.rank,
                "lemma": row.lemma,
                "pos": row.pos,
                "pos_name": POS_MAPPING.get(row.pos, {}).get("name", "Unknown"),
                "freq": row.freq,
                "per_mil": row.per_mil,
                "complexity": get_complexity_level(row.rank),
                "sentences": []  # Will be filled later
            }
            words.append(word)
            word_ids.append(row.id)
        
        print(f"✅ Loaded {len(words)} words")
        
        # Get all sentences
        sentences_result = session.execute(text("""
            SELECT id, word_id, sentence_text, theme
            FROM sentences
            ORDER BY word_id, theme, id
        """))
        
        # Group sentences by word_id
        sentences_by_word = {}
        sentence_count = 0
        for row in sentences_result:
            if row.word_id not in sentences_by_word:
                sentences_by_word[row.word_id] = []
            sentences_by_word[row.word_id].append({
                "id": row.id,
                "text": row.sentence_text,
                "theme": row.theme
            })
            sentence_count += 1
        
        print(f"✅ Loaded {sentence_count} sentences")
        
        # Merge sentences into words
        for word in words:
            word["sentences"] = sentences_by_word.get(word["id"], [])
        
        # Calculate stats
        words_with_sentences = sum(1 for w in words if w["sentences"])
        
        # Export main words file
        words_file = OUTPUT_DIR / "words.json"
        with open(words_file, 'w', encoding='utf-8') as f:
            json.dump({
                "words": words,
                "meta": {
                    "total_words": len(words),
                    "total_sentences": sentence_count,
                    "words_with_sentences": words_with_sentences,
                    "exported_at": datetime.now().isoformat(),
                    "version": "1.0.0"
                }
            }, f, ensure_ascii=False)
        
        file_size = words_file.stat().st_size / 1024
        print(f"✅ Exported words.json ({file_size:.1f} KB)")
        
        # Export config file
        config_file = OUTPUT_DIR / "config.json"
        config = {
            "pos_mapping": POS_MAPPING,
            "themes": THEMES,
            "voices": {
                "en-US": [
                    {"id": "en-US-AriaNeural", "name": "Aria", "gender": "Female"},
                    {"id": "en-US-GuyNeural", "name": "Guy", "gender": "Male"},
                    {"id": "en-US-JennyNeural", "name": "Jenny", "gender": "Female"},
                    {"id": "en-US-ChristopherNeural", "name": "Christopher", "gender": "Male"},
                ],
                "en-GB": [
                    {"id": "en-GB-SoniaNeural", "name": "Sonia", "gender": "Female"},
                    {"id": "en-GB-RyanNeural", "name": "Ryan", "gender": "Male"},
                ],
                "en-AU": [
                    {"id": "en-AU-NatashaNeural", "name": "Natasha", "gender": "Female"},
                    {"id": "en-AU-WilliamNeural", "name": "William", "gender": "Male"},
                ]
            },
            "tts_worker_url": "https://your-worker.workers.dev/tts",
            "version": "1.0.0"
        }
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Exported config.json")
        
        # Print summary
        print("\n" + "="*50)
        print("📊 EXPORT SUMMARY")
        print("="*50)
        print(f"   Words: {len(words):,}")
        print(f"   Sentences: {sentence_count:,}")
        print(f"   Words with sentences: {words_with_sentences:,}")
        print(f"   Coverage: {words_with_sentences/len(words)*100:.1f}%")
        print(f"   File size: {file_size:.1f} KB")
        print("="*50)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        session.close()


if __name__ == "__main__":
    print("\n🚀 Exporting database to static JSON...\n")
    success = export_words()
    if success:
        print("\n✅ Export complete!")
    else:
        print("\n❌ Export failed!")
        sys.exit(1)
