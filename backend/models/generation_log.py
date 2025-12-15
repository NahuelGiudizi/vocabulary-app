"""
Generation Log model for tracking batch generation progress.

This module defines the GenerationLog SQLAlchemy model for
tracking sentence generation batches and their results.
"""

from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func
from typing import Dict, Any, Optional
import json

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base


class GenerationLog(Base):
    """
    GenerationLog model for tracking sentence generation batches.
    
    Attributes:
        id: Primary key
        batch_number: Sequential batch number
        words_processed: Number of words processed in this batch
        theme: Theme used for generation
        duration_seconds: Time taken for batch generation
        errors: JSON string of any errors encountered
        status: Current status (pending, processing, completed, failed)
        start_word_id: First word ID in the batch
        end_word_id: Last word ID in the batch
        created_at: Timestamp of record creation
    """
    
    __tablename__ = "generation_log"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Batch information
    batch_number = Column(Integer, nullable=False, index=True)
    words_processed = Column(Integer, default=0)
    theme = Column(String(50), nullable=False)
    
    # Timing
    duration_seconds = Column(Float, default=0.0)
    
    # Status and errors
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    errors = Column(Text, nullable=True)  # JSON string of errors
    
    # Word range
    start_word_id = Column(Integer, nullable=True)
    end_word_id = Column(Integer, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert generation log to dictionary representation.
        
        Returns:
            Dictionary containing log data
        """
        return {
            "id": self.id,
            "batch_number": self.batch_number,
            "words_processed": self.words_processed,
            "theme": self.theme,
            "duration_seconds": self.duration_seconds,
            "status": self.status,
            "errors": json.loads(self.errors) if self.errors else None,
            "start_word_id": self.start_word_id,
            "end_word_id": self.end_word_id,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    def add_error(self, error_message: str, word_id: Optional[int] = None) -> None:
        """
        Add an error to the log.
        
        Args:
            error_message: Description of the error
            word_id: ID of the word that caused the error (optional)
        """
        current_errors = json.loads(self.errors) if self.errors else []
        current_errors.append({
            "message": error_message,
            "word_id": word_id,
            "timestamp": func.now()
        })
        self.errors = json.dumps(current_errors)
    
    def mark_completed(self, duration: float) -> None:
        """
        Mark the batch as completed.
        
        Args:
            duration: Time taken in seconds
        """
        self.status = "completed"
        self.duration_seconds = duration
    
    def mark_failed(self, error_message: str) -> None:
        """
        Mark the batch as failed.
        
        Args:
            error_message: Description of the failure
        """
        self.status = "failed"
        self.add_error(error_message)
    
    def __repr__(self) -> str:
        return f"<GenerationLog(batch={self.batch_number}, status='{self.status}', words={self.words_processed})>"
