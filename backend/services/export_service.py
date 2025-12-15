"""
Export service for PDF, Anki, and audio batch exports.

This module provides functionality to export vocabulary data
in various formats for study and review.
"""

import os
import io
import csv
import zipfile
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, BinaryIO
from datetime import datetime

from config import THEMES, POS_MAPPING

logger = logging.getLogger(__name__)


class ExportError(Exception):
    """Exception raised for export-related errors."""
    pass


class ExportService:
    """
    Service for exporting vocabulary data in various formats.
    
    Supports:
    - PDF export with formatted word cards
    - Anki-compatible CSV export
    - Audio ZIP archive export
    
    Attributes:
        output_dir: Directory for temporary export files
    """
    
    def __init__(self, output_dir: Optional[str] = None):
        """
        Initialize ExportService.
        
        Args:
            output_dir: Directory for temporary export files
        """
        self.output_dir = Path(output_dir or "./exports")
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_pdf(
        self,
        words: List[Dict[str, Any]],
        theme: str = "qa_manager",
        title: Optional[str] = None,
        include_charts: bool = True
    ) -> bytes:
        """
        Generate PDF document with vocabulary words.
        
        Args:
            words: List of word dictionaries with sentences
            theme: Theme used for sentences
            title: Custom title for the PDF
            include_charts: Whether to include frequency charts
            
        Returns:
            PDF file as bytes
            
        Raises:
            ExportError: If PDF generation fails
        """
        try:
            from fpdf import FPDF
            
            theme_config = THEMES.get(theme, THEMES["qa_manager"])
            
            # Create PDF
            pdf = FPDF()
            pdf.set_auto_page_break(auto=True, margin=15)
            
            # Title page
            pdf.add_page()
            pdf.set_font("Arial", "B", 24)
            pdf.cell(0, 20, "", ln=True)  # Spacing
            
            title = title or f"English Vocabulary - {theme_config['name']} Theme"
            pdf.multi_cell(0, 15, title, align="C")
            
            pdf.set_font("Arial", "", 12)
            pdf.cell(0, 10, "", ln=True)
            pdf.multi_cell(0, 8, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", align="C")
            pdf.multi_cell(0, 8, f"Total Words: {len(words)}", align="C")
            
            # Content pages
            for word in words:
                pdf.add_page()
                
                # Word header
                pos_info = POS_MAPPING.get(word.get("pos", ""), {})
                pos_name = pos_info.get("name", "Unknown")
                
                pdf.set_font("Arial", "B", 18)
                pdf.cell(0, 12, f"#{word.get('rank', '?')}  {word.get('lemma', '').upper()}", ln=True)
                
                pdf.set_font("Arial", "I", 12)
                pdf.cell(0, 8, f"Part of Speech: {pos_name}", ln=True)
                
                # Frequency info
                pdf.set_font("Arial", "", 10)
                freq = word.get("freq", 0)
                per_mil = word.get("per_mil", 0)
                pdf.cell(0, 6, f"Frequency: {freq:,} | Per Million: {per_mil:.2f}", ln=True)
                
                pdf.cell(0, 8, "", ln=True)  # Spacing
                
                # Sentences
                pdf.set_font("Arial", "B", 12)
                pdf.cell(0, 8, "Example Sentences:", ln=True)
                
                pdf.set_font("Arial", "", 11)
                sentences = word.get("sentences", [])
                for idx, sentence in enumerate(sentences, 1):
                    if isinstance(sentence, dict):
                        text = sentence.get("sentence_text", "")
                    else:
                        text = str(sentence)
                    
                    pdf.multi_cell(0, 7, f"  {idx}. {text}")
                    pdf.cell(0, 3, "", ln=True)  # Spacing
                
                # Genre frequencies (if include_charts)
                if include_charts and word.get("genres"):
                    pdf.cell(0, 10, "", ln=True)
                    pdf.set_font("Arial", "B", 11)
                    pdf.cell(0, 8, "Frequency by Genre:", ln=True)
                    
                    pdf.set_font("Arial", "", 9)
                    genres = word.get("genres", {})
                    genre_line = []
                    for genre, data in genres.items():
                        if isinstance(data, dict):
                            per_mil = data.get("per_mil", 0)
                            genre_line.append(f"{genre}: {per_mil:.1f}")
                    
                    pdf.multi_cell(0, 6, " | ".join(genre_line))
            
            # Output PDF
            return pdf.output(dest='S').encode('latin-1')
            
        except Exception as e:
            logger.error(f"PDF generation failed: {str(e)}")
            raise ExportError(f"Failed to generate PDF: {str(e)}")
    
    def generate_anki_csv(
        self,
        words: List[Dict[str, Any]],
        theme: str = "qa_manager",
        include_audio_tags: bool = True
    ) -> str:
        """
        Generate Anki-compatible CSV for import.
        
        CSV Format:
        Front: word (part of speech)
        Back: Example sentences (HTML formatted)
        Audio: Sound tag for audio file
        Extra: Word rank and frequency info
        
        Args:
            words: List of word dictionaries with sentences
            theme: Theme used for sentences
            include_audio_tags: Whether to include [sound:] tags
            
        Returns:
            CSV content as string
        """
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)
        
        # Header (optional, Anki can work without it)
        # writer.writerow(["Front", "Back", "Audio", "Extra"])
        
        for word in words:
            lemma = word.get("lemma", "")
            pos = word.get("pos", "")
            pos_name = POS_MAPPING.get(pos, {}).get("name", "Unknown")
            rank = word.get("rank", 0)
            freq = word.get("freq", 0)
            
            # Front card
            front = f"{lemma} ({pos_name.lower()})"
            
            # Back card - sentences formatted with HTML
            sentences = word.get("sentences", [])
            sentence_texts = []
            for idx, sentence in enumerate(sentences, 1):
                if isinstance(sentence, dict):
                    text = sentence.get("sentence_text", "")
                else:
                    text = str(sentence)
                sentence_texts.append(f"{idx}. {text}")
            
            back = "<br>".join(sentence_texts)
            
            # Audio tag
            audio = f"[sound:{lemma}_1.mp3]" if include_audio_tags else ""
            
            # Extra info
            extra = f"Rank: {rank} | Freq: {freq:,}"
            
            writer.writerow([front, back, audio, extra])
        
        return output.getvalue()
    
    def generate_audio_zip(
        self,
        words: List[Dict[str, Any]],
        audio_dir: Path
    ) -> bytes:
        """
        Generate ZIP archive with audio files.
        
        Structure:
        vocabulary_audio_export.zip
        ├── word_0001_the/
        │   ├── word.mp3
        │   ├── sentence_1.mp3
        │   └── sentence_2.mp3
        └── ...
        
        Args:
            words: List of word dictionaries
            audio_dir: Directory containing audio files
            
        Returns:
            ZIP file as bytes
        """
        output = io.BytesIO()
        
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            for word in words:
                lemma = word.get("lemma", "")
                rank = word.get("rank", 0)
                
                # Word directory in ZIP
                word_folder = f"word_{rank:04d}_{lemma}"
                
                # Check for word audio
                word_audio_dir = audio_dir / f"word_{rank:04d}_{lemma}"
                
                if word_audio_dir.exists():
                    # Add word audio
                    word_audio = word_audio_dir / f"{lemma}.mp3"
                    if word_audio.exists():
                        zf.write(word_audio, f"{word_folder}/word.mp3")
                    
                    # Add sentence audio
                    for idx in range(1, 4):
                        sentence_audio = word_audio_dir / f"sentence_{idx}.mp3"
                        if sentence_audio.exists():
                            zf.write(sentence_audio, f"{word_folder}/sentence_{idx}.mp3")
                else:
                    # Try to find cached audio
                    for audio_file in audio_dir.glob(f"{lemma[:20]}*.mp3"):
                        zf.write(audio_file, f"{word_folder}/{audio_file.name}")
        
        return output.getvalue()
    
    def generate_json_export(
        self,
        words: List[Dict[str, Any]],
        theme: str = "qa_manager",
        pretty: bool = True
    ) -> str:
        """
        Generate JSON export of vocabulary data.
        
        Args:
            words: List of word dictionaries
            theme: Theme used for sentences
            pretty: Whether to format JSON with indentation
            
        Returns:
            JSON string
        """
        import json
        
        theme_config = THEMES.get(theme, THEMES["qa_manager"])
        
        export_data = {
            "metadata": {
                "theme": theme,
                "theme_name": theme_config["name"],
                "word_count": len(words),
                "generated_at": datetime.now().isoformat(),
                "version": "1.0"
            },
            "words": words
        }
        
        if pretty:
            return json.dumps(export_data, indent=2, ensure_ascii=False)
        return json.dumps(export_data, ensure_ascii=False)
    
    def generate_txt_export(
        self,
        words: List[Dict[str, Any]],
        theme: str = "qa_manager"
    ) -> str:
        """
        Generate plain text export.
        
        Args:
            words: List of word dictionaries
            theme: Theme used for sentences
            
        Returns:
            Plain text string
        """
        theme_config = THEMES.get(theme, THEMES["qa_manager"])
        lines = []
        
        lines.append("=" * 60)
        lines.append(f"English Vocabulary - {theme_config['name']} Theme")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"Total Words: {len(words)}")
        lines.append("=" * 60)
        lines.append("")
        
        for word in words:
            lemma = word.get("lemma", "")
            pos = word.get("pos", "")
            pos_name = POS_MAPPING.get(pos, {}).get("name", "Unknown")
            rank = word.get("rank", 0)
            freq = word.get("freq", 0)
            per_mil = word.get("per_mil", 0)
            
            lines.append("-" * 60)
            lines.append(f"#{rank} {lemma.upper()} ({pos_name})")
            lines.append(f"Frequency: {freq:,} | Per Million: {per_mil:.2f}")
            lines.append("")
            lines.append("Example Sentences:")
            
            sentences = word.get("sentences", [])
            for idx, sentence in enumerate(sentences, 1):
                if isinstance(sentence, dict):
                    text = sentence.get("sentence_text", "")
                else:
                    text = str(sentence)
                lines.append(f"  {idx}. {text}")
            
            lines.append("")
        
        return "\n".join(lines)


# Singleton instance
_export_service: Optional[ExportService] = None


def get_export_service() -> ExportService:
    """
    Get the singleton ExportService instance.
    
    Returns:
        ExportService instance
    """
    global _export_service
    if _export_service is None:
        _export_service = ExportService()
    return _export_service
