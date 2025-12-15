"""
Text-to-Speech service for audio generation.

This module provides TTS functionality using Edge TTS (Microsoft voices),
with fallback to pyttsx3 (offline) and gTTS.
"""

import os
import logging
import hashlib
from pathlib import Path
from typing import Optional, Tuple
import base64
import io
from concurrent.futures import ThreadPoolExecutor
import asyncio

from config import settings

logger = logging.getLogger(__name__)


class TTSError(Exception):
    """Exception raised for TTS-related errors."""
    pass


class TTSService:
    """
    Text-to-Speech service supporting multiple engines.
    
    Supports three modes:
    - edge: Uses Edge TTS for high quality Microsoft voices (recommended)
    - offline: Uses pyttsx3 for instant local playback
    - online: Uses gTTS for cloud-based synthesis
    
    Audio files are cached to avoid regenerating the same content.
    
    Attributes:
        mode: TTS mode ('edge', 'offline' or 'online')
        rate: Speech rate (words per minute)
        cache_dir: Directory for cached audio files
        voice: Edge TTS voice name
    """
    
    # High quality English voices for Edge TTS
    EDGE_VOICES = {
        'en-US-GuyNeural': 'American Male (Guy)',
        'en-US-JennyNeural': 'American Female (Jenny)',
        'en-US-AriaNeural': 'American Female (Aria)',
        'en-GB-RyanNeural': 'British Male (Ryan)',
        'en-GB-SoniaNeural': 'British Female (Sonia)',
        'en-AU-WilliamNeural': 'Australian Male (William)',
    }
    
    def __init__(
        self,
        mode: Optional[str] = None,
        rate: Optional[int] = None,
        cache_dir: Optional[str] = None,
        voice: Optional[str] = None
    ):
        """
        Initialize TTSService.
        
        Args:
            mode: TTS mode ('edge', 'offline' or 'online')
            rate: Speech rate (default from settings)
            cache_dir: Directory for cached audio files
            voice: Edge TTS voice name (default from settings)
        """
        self.mode = mode or settings.TTS_MODE
        self.rate = rate or settings.TTS_RATE
        self.cache_dir = Path(cache_dir or settings.AUDIO_CACHE_DIR)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.voice = voice or getattr(settings, 'TTS_VOICE', 'en-US-GuyNeural')
        
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._engine = None
    
    def _get_cache_path(self, text: str, voice: Optional[str] = None, format: str = "mp3") -> Path:
        """
        Generate cache path for audio file.
        
        Args:
            text: Text to be synthesized
            voice: Voice used for synthesis (included in cache key)
            format: Audio format (mp3, wav)
            
        Returns:
            Path object for the cached file
        """
        # Use current voice if not specified
        voice = voice or self.voice
        # Create hash of text + voice for filename (so different voices have different cache)
        cache_key = f"{text}_{voice}"
        text_hash = hashlib.md5(cache_key.encode('utf-8')).hexdigest()[:16]
        # Also include first few words for readability
        safe_prefix = "".join(c for c in text[:30] if c.isalnum() or c == " ").strip()
        safe_prefix = safe_prefix.replace(" ", "_")[:20]
        # Include voice abbreviation in filename for clarity
        voice_abbrev = voice.split('-')[-1][:4] if voice else "dflt"
        
        filename = f"{safe_prefix}_{voice_abbrev}_{text_hash}.{format}"
        return self.cache_dir / filename
    
    def _check_cache(self, text: str, voice: Optional[str] = None) -> Optional[Path]:
        """
        Check if audio is already cached.
        
        Args:
            text: Text to check
            voice: Voice to check cache for
            
        Returns:
            Path to cached file if exists, None otherwise
        """
        cache_path = self._get_cache_path(text, voice)
        if cache_path.exists():
            logger.debug(f"Cache hit for: {text[:50]}... (voice: {voice or self.voice})")
            return cache_path
        return None
    
    def _generate_pyttsx3(self, text: str, output_path: Path) -> bool:
        """
        Generate audio using pyttsx3 (offline).
        
        Args:
            text: Text to synthesize
            output_path: Path to save audio file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import pyttsx3
            
            engine = pyttsx3.init()
            engine.setProperty('rate', self.rate)
            
            # Try to set English voice
            voices = engine.getProperty('voices')
            for voice in voices:
                if 'english' in voice.name.lower() or 'en' in voice.id.lower():
                    engine.setProperty('voice', voice.id)
                    break
            
            # Save to file
            engine.save_to_file(text, str(output_path))
            engine.runAndWait()
            
            return output_path.exists()
            
        except Exception as e:
            logger.error(f"pyttsx3 generation failed: {str(e)}")
            return False
    
    def _generate_gtts(self, text: str, output_path: Path) -> bool:
        """
        Generate audio using gTTS (online).
        
        Args:
            text: Text to synthesize
            output_path: Path to save audio file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            from gtts import gTTS
            
            tts = gTTS(text=text, lang='en', slow=False)
            tts.save(str(output_path))
            
            return output_path.exists()
            
        except Exception as e:
            logger.error(f"gTTS generation failed: {str(e)}")
            return False
    
    def _generate_edge_tts_sync(self, text: str, output_path: Path) -> bool:
        """
        Generate audio using Edge TTS (high quality Microsoft voices).
        
        This runs the async Edge TTS in a sync context.
        
        Args:
            text: Text to synthesize
            output_path: Path to save audio file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import edge_tts
            logger.info(f"Edge TTS: Starting generation with voice {self.voice}")
            
            async def _generate():
                communicate = edge_tts.Communicate(text, self.voice)
                await communicate.save(str(output_path))
            
            # Run the async function in a new event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(_generate())
            finally:
                loop.close()
            
            exists = output_path.exists()
            logger.info(f"Edge TTS: Generation complete, file exists: {exists}")
            return exists
            
        except Exception as e:
            logger.error(f"Edge TTS generation failed: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return False
            return False
    
    async def _generate_edge_tts(self, text: str, output_path: Path) -> bool:
        """
        Generate audio using Edge TTS asynchronously.
        
        Args:
            text: Text to synthesize
            output_path: Path to save audio file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import edge_tts
            
            communicate = edge_tts.Communicate(text, self.voice)
            await communicate.save(str(output_path))
            
            return output_path.exists()
            
        except Exception as e:
            logger.error(f"Edge TTS async generation failed: {str(e)}")
            return False
    
    def generate_audio_sync(
        self,
        text: str,
        mode: Optional[str] = None,
        force_regenerate: bool = False
    ) -> Optional[Path]:
        """
        Generate audio synchronously.
        
        Args:
            text: Text to synthesize
            mode: Override TTS mode for this call
            force_regenerate: Force regeneration even if cached
            
        Returns:
            Path to audio file if successful, None otherwise
        """
        if not text or not text.strip():
            return None
        
        text = text.strip()
        mode = mode or self.mode
        
        # Check cache first (includes voice in cache key)
        if not force_regenerate:
            cached = self._check_cache(text, self.voice)
            if cached:
                return cached
        
        # Generate new audio (includes voice in cache path)
        output_path = self._get_cache_path(text, self.voice)
        
        logger.info(f"TTS Mode: {mode}, Voice: {self.voice}, Text: {text[:30]}...")
        
        if mode == "offline":
            logger.info("Using pyttsx3 (offline mode)")
            success = self._generate_pyttsx3(text, output_path)
        elif mode == "edge":
            logger.info("Using Edge TTS")
            success = self._generate_edge_tts_sync(text, output_path)
        else:
            logger.info("Using gTTS (online mode)")
            success = self._generate_gtts(text, output_path)
        
        if success:
            logger.info(f"Generated audio: {output_path.name}")
            return output_path
        
        return None
    
    async def generate_audio(
        self,
        text: str,
        mode: Optional[str] = None,
        force_regenerate: bool = False
    ) -> Optional[Path]:
        """
        Generate audio asynchronously.
        
        Args:
            text: Text to synthesize
            mode: Override TTS mode for this call
            force_regenerate: Force regeneration even if cached
            
        Returns:
            Path to audio file if successful, None otherwise
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor,
            lambda: self.generate_audio_sync(text, mode, force_regenerate)
        )
    
    async def get_audio_base64(
        self,
        text: str,
        mode: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate audio and return as base64 string.
        
        Args:
            text: Text to synthesize
            mode: Override TTS mode for this call
            
        Returns:
            Base64-encoded audio data if successful, None otherwise
        """
        audio_path = await self.generate_audio(text, mode)
        
        if audio_path and audio_path.exists():
            with open(audio_path, 'rb') as f:
                audio_data = f.read()
            return base64.b64encode(audio_data).decode('utf-8')
        
        return None
    
    async def pregenerate_word_audio(
        self,
        lemma: str,
        sentences: list,
        word_rank: int
    ) -> dict:
        """
        Pre-generate audio for a word and its sentences.
        
        Args:
            lemma: The word lemma
            sentences: List of example sentences
            word_rank: Word rank for directory organization
            
        Returns:
            Dictionary with paths to generated audio files
        """
        result = {
            "word": None,
            "sentences": []
        }
        
        # Create word-specific directory
        word_dir = self.cache_dir / f"word_{word_rank:04d}_{lemma}"
        word_dir.mkdir(exist_ok=True)
        
        # Generate word audio
        word_audio_path = word_dir / f"{lemma}.mp3"
        if not word_audio_path.exists():
            audio_path = await self.generate_audio(lemma)
            if audio_path:
                # Move to word directory
                audio_path.rename(word_audio_path)
                result["word"] = str(word_audio_path)
        else:
            result["word"] = str(word_audio_path)
        
        # Generate sentence audio
        for idx, sentence in enumerate(sentences, 1):
            sentence_path = word_dir / f"sentence_{idx}.mp3"
            if not sentence_path.exists():
                audio_path = await self.generate_audio(sentence)
                if audio_path:
                    audio_path.rename(sentence_path)
                    result["sentences"].append(str(sentence_path))
            else:
                result["sentences"].append(str(sentence_path))
        
        return result
    
    def get_audio_duration(self, audio_path: Path) -> float:
        """
        Get duration of an audio file in seconds.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Duration in seconds, 0 if unable to determine
        """
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(str(audio_path))
            return len(audio) / 1000.0
        except Exception as e:
            logger.warning(f"Could not get audio duration: {str(e)}")
            return 0.0
    
    def cleanup_cache(self, max_age_days: int = 30) -> int:
        """
        Remove old cached audio files.
        
        Args:
            max_age_days: Maximum age of files to keep
            
        Returns:
            Number of files removed
        """
        import time
        
        max_age_seconds = max_age_days * 24 * 60 * 60
        current_time = time.time()
        removed = 0
        
        for audio_file in self.cache_dir.glob("**/*.mp3"):
            file_age = current_time - audio_file.stat().st_mtime
            if file_age > max_age_seconds:
                audio_file.unlink()
                removed += 1
        
        logger.info(f"Cleaned up {removed} old audio files")
        return removed


# Singleton instance
_tts_service: Optional[TTSService] = None


def get_tts_service() -> TTSService:
    """
    Get the singleton TTSService instance.
    
    Returns:
        TTSService instance
    """
    global _tts_service
    if _tts_service is None:
        _tts_service = TTSService()
    return _tts_service
