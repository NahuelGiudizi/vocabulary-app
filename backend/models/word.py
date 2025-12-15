"""
Word model for vocabulary database.

This module defines the Word SQLAlchemy model representing
vocabulary entries from the COCA corpus.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from typing import Dict, Any, List, Optional

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base


class Word(Base):
    """
    Word model representing a vocabulary entry from COCA corpus.
    
    Attributes:
        id: Primary key
        rank: Word frequency rank (1-5000)
        lemma: Base form of the word
        pos: Part of speech code
        freq: Absolute frequency in corpus
        per_mil: Frequency per million words
        caps_percent: Percentage with first letter capitalized
        all_caps_percent: Percentage in all caps
        range_value: Number of subcorpora appearances (max 20)
        dispersion: Dispersion statistic (0-1)
        blog, web, tvm, spok, fic, mag, news, acad: Genre frequencies
        blog_pm, web_pm, tvm_pm, spok_pm, fic_pm, mag_pm, news_pm, acad_pm: Per-million frequencies
        created_at: Timestamp of record creation
        sentences: Relationship to associated sentences
    """
    
    __tablename__ = "words"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Core word data
    rank = Column(Integer, nullable=False, index=True)
    lemma = Column(String(100), nullable=False, index=True)
    pos = Column(String(10), nullable=False, index=True)
    
    # Frequency statistics
    freq = Column(Integer)
    per_mil = Column(Float)
    caps_percent = Column(Float)
    all_caps_percent = Column(Float)
    range_value = Column(Integer)
    dispersion = Column(Float)
    
    # Genre frequencies (absolute)
    blog = Column(Integer)
    web = Column(Integer)
    tvm = Column(Integer)
    spok = Column(Integer)
    fic = Column(Integer)
    mag = Column(Integer)
    news = Column(Integer)
    acad = Column(Integer)
    
    # Genre frequencies (per million)
    blog_pm = Column(Float)
    web_pm = Column(Float)
    tvm_pm = Column(Float)
    spok_pm = Column(Float)
    fic_pm = Column(Float)
    mag_pm = Column(Float)
    news_pm = Column(Float)
    acad_pm = Column(Float)
    
    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    sentences = relationship("Sentence", back_populates="word", cascade="all, delete-orphan")
    
    # Unique constraint on lemma + pos combination
    __table_args__ = (
        Index('idx_lemma_pos', 'lemma', 'pos', unique=True),
    )
    
    def to_dict(self, include_sentences: bool = True, theme: Optional[str] = None) -> Dict[str, Any]:
        """
        Convert word to dictionary representation.
        
        Args:
            include_sentences: Whether to include associated sentences
            theme: Filter sentences by theme (optional)
            
        Returns:
            Dictionary containing word data
        """
        result = {
            "id": self.id,
            "rank": self.rank,
            "lemma": self.lemma,
            "pos": self.pos,
            "freq": self.freq,
            "per_mil": self.per_mil,
            "caps_percent": self.caps_percent,
            "all_caps_percent": self.all_caps_percent,
            "range_value": self.range_value,
            "dispersion": self.dispersion,
            "genres": {
                "blog": {"count": self.blog, "per_mil": self.blog_pm},
                "web": {"count": self.web, "per_mil": self.web_pm},
                "tvm": {"count": self.tvm, "per_mil": self.tvm_pm},
                "spok": {"count": self.spok, "per_mil": self.spok_pm},
                "fic": {"count": self.fic, "per_mil": self.fic_pm},
                "mag": {"count": self.mag, "per_mil": self.mag_pm},
                "news": {"count": self.news, "per_mil": self.news_pm},
                "acad": {"count": self.acad, "per_mil": self.acad_pm},
            },
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        
        if include_sentences and self.sentences:
            if theme:
                result["sentences"] = [
                    s.to_dict() for s in self.sentences if s.theme == theme
                ]
            else:
                result["sentences"] = [s.to_dict() for s in self.sentences]
        
        return result
    
    def get_pos_name(self) -> str:
        """Get the full name of the part of speech."""
        from config import POS_MAPPING
        return POS_MAPPING.get(self.pos, {}).get("name", "Unknown")
    
    def get_complexity_level(self) -> str:
        """Get the complexity level based on word rank."""
        from config import get_complexity_level
        return get_complexity_level(self.rank)
    
    def __repr__(self) -> str:
        return f"<Word(rank={self.rank}, lemma='{self.lemma}', pos='{self.pos}')>"
