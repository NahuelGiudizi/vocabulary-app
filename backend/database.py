"""
Database configuration and session management.

This module provides the SQLAlchemy engine, session, and base model configuration.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os

# Get database URL from environment or use default
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/vocabulary.db")

# SQLite-specific configuration
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    
    # Enable foreign key support for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_engine(DATABASE_URL, echo=False)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()


def get_db():
    """
    Dependency for FastAPI to get database session.
    
    Yields:
        Session: SQLAlchemy database session
        
    Example:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize the database by creating all tables.
    
    This function should be called once at application startup
    or when setting up a new database.
    """
    from models.word import Word
    from models.sentence import Sentence
    from models.generation_log import GenerationLog
    
    Base.metadata.create_all(bind=engine)


def reset_db():
    """
    Reset the database by dropping and recreating all tables.
    
    WARNING: This will delete all data! Use with caution.
    """
    from models.word import Word
    from models.sentence import Sentence
    from models.generation_log import GenerationLog
    
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
