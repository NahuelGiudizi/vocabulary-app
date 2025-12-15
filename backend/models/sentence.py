"""
Sentence model for vocabulary database.

This module defines the Sentence SQLAlchemy model representing
example sentences generated for vocabulary words.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from typing import Dict, Any

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base


class Sentence(Base):
    """
    Sentence model representing an example sentence for a vocabulary word.
    
    Attributes:
        id: Primary key
        word_id: Foreign key to associated word
        sentence_text: The example sentence text
        theme: Theme context used for generation (e.g., 'qa_manager')
        audio_path: Path to pre-generated audio file (optional)
        created_at: Timestamp of record creation
        word: Relationship to associated word
    """
    
    __tablename__ = "sentences"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign key to word
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False)
    
    # Sentence data
    sentence_text = Column(Text, nullable=False)
    theme = Column(String(50), nullable=False, index=True)
    audio_path = Column(String(255), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationship
    word = relationship("Word", back_populates="sentences")
    
    # Composite index for efficient queries
    __table_args__ = (
        Index('idx_word_theme', 'word_id', 'theme'),
    )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert sentence to dictionary representation.
        
        Returns:
            Dictionary containing sentence data
        """
        return {
            "id": self.id,
            "word_id": self.word_id,
            "sentence_text": self.sentence_text,
            "theme": self.theme,
            "audio_path": self.audio_path,
            "has_audio": self.audio_path is not None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self) -> str:
        preview = self.sentence_text[:50] + "..." if len(self.sentence_text) > 50 else self.sentence_text
        return f"<Sentence(id={self.id}, theme='{self.theme}', text='{preview}')>"
