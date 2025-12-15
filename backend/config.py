"""
Application configuration module.

This module contains all configuration settings for the vocabulary learning application.
Settings can be overridden using environment variables.
"""

import os
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"
AUDIO_DIR = STATIC_DIR / "audio"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


class Settings:
    """Application settings configuration class."""
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/vocabulary.db")
    
    # Ollama Configuration
    OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:14b")
    OLLAMA_TIMEOUT: int = int(os.getenv("OLLAMA_TIMEOUT", "300"))
    
    # Generation Configuration
    BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "50"))
    SENTENCES_PER_WORD: int = int(os.getenv("SENTENCES_PER_WORD", "3"))
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "3"))
    
    # TTS Configuration
    TTS_MODE: str = os.getenv("TTS_MODE", "edge")  # "edge", "offline" or "online"
    TTS_VOICE: str = os.getenv("TTS_VOICE", "en-US-GuyNeural")  # Edge TTS voice
    TTS_RATE: int = int(os.getenv("TTS_RATE", "150"))
    AUDIO_CACHE_DIR: str = os.getenv("AUDIO_CACHE_DIR", str(AUDIO_DIR))
    
    # API Configuration
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # CORS Configuration
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    RATE_LIMIT_PERIOD: int = int(os.getenv("RATE_LIMIT_PERIOD", "60"))


# Theme configuration with detailed descriptions
THEMES: Dict[str, Dict[str, Any]] = {
    "qa_manager": {
        "name": "IT QA Manager",
        "emoji": "🔍",
        "description": "Quality Assurance Manager in a software company",
        "context": """You are generating example sentences for an IT Quality Assurance Manager. 
        The sentences should relate to:
        - Software testing (manual and automated)
        - Test case management and test plans
        - Bug tracking and defect reports
        - Sprint planning and agile ceremonies
        - QA team leadership and coordination
        - Regression testing and release validation
        - Performance and load testing
        - Test automation frameworks (Selenium, Cypress, Jest)
        - CI/CD pipeline testing
        - Quality metrics and reporting""",
        "examples": [
            "The regression suite detected three critical defects.",
            "We need to update the test cases for the new feature.",
            "The QA team completed the smoke tests successfully."
        ]
    },
    "software_dev": {
        "name": "Software Development",
        "emoji": "💻",
        "description": "Software Developer or Engineer",
        "context": """You are generating example sentences for a Software Developer.
        The sentences should relate to:
        - Programming and coding practices
        - Code reviews and pull requests
        - Software architecture and design patterns
        - API development and integration
        - Database operations and queries
        - Version control (Git, branches, commits)
        - Debugging and troubleshooting
        - Documentation and technical writing
        - IDE and development tools
        - Clean code principles""",
        "examples": [
            "The function returns an array of validated objects.",
            "We should refactor this method to improve readability.",
            "The API endpoint handles authentication properly."
        ]
    },
    "agile_scrum": {
        "name": "Agile & Scrum",
        "emoji": "📋",
        "description": "Agile/Scrum Team Member or Scrum Master",
        "context": """You are generating example sentences for an Agile/Scrum practitioner.
        The sentences should relate to:
        - Scrum ceremonies (daily standup, sprint planning, retrospective)
        - User stories and acceptance criteria
        - Sprint backlog and product backlog
        - Story points and velocity
        - Kanban boards and task management
        - Continuous improvement
        - Stakeholder communication
        - Agile principles and values
        - Cross-functional team collaboration
        - Release planning and roadmaps""",
        "examples": [
            "The team completed five story points this sprint.",
            "We discussed blockers during the daily standup.",
            "The retrospective revealed areas for improvement."
        ]
    },
    "devops": {
        "name": "DevOps & CI/CD",
        "emoji": "🚀",
        "description": "DevOps Engineer or SRE",
        "context": """You are generating example sentences for a DevOps Engineer.
        The sentences should relate to:
        - CI/CD pipelines and automation
        - Container orchestration (Docker, Kubernetes)
        - Infrastructure as Code (Terraform, Ansible)
        - Cloud platforms (AWS, Azure, GCP)
        - Monitoring and alerting
        - Log management and analysis
        - Security and compliance
        - Deployment strategies (blue-green, canary)
        - Configuration management
        - Site reliability and uptime""",
        "examples": [
            "The pipeline automatically deploys to staging.",
            "We configured the Kubernetes cluster for high availability.",
            "The monitoring dashboard shows increased latency."
        ]
    },
    "general_business": {
        "name": "General Business",
        "emoji": "💼",
        "description": "Professional Business Communication",
        "context": """You are generating example sentences for general business communication.
        The sentences should relate to:
        - Professional email communication
        - Meeting management and presentations
        - Project management and timelines
        - Team collaboration and coordination
        - Client and stakeholder relations
        - Reports and documentation
        - Strategic planning
        - Performance reviews
        - Budget and resource allocation
        - Professional development""",
        "examples": [
            "Please review the document before the meeting.",
            "The project deadline has been extended by one week.",
            "We need to schedule a follow-up call with the client."
        ]
    }
}


# Part of Speech mapping
POS_MAPPING: Dict[str, Dict[str, str]] = {
    "a": {"name": "Article", "description": "the, a, your", "color": "#E3F2FD"},
    "c": {"name": "Conjunction", "description": "if, because, whereas", "color": "#FFF3E0"},
    "d": {"name": "Determiner", "description": "this, most, either", "color": "#E8F5E9"},
    "e": {"name": "Existential", "description": "there", "color": "#F3E5F5"},
    "g": {"name": "Genitive", "description": "'", "color": "#FBE9E7"},
    "i": {"name": "Preposition", "description": "with, instead, except", "color": "#E0F7FA"},
    "j": {"name": "Adjective", "description": "shy, risky, tender", "color": "#FFFDE7"},
    "m": {"name": "Number", "description": "seven, fifth, two-thirds", "color": "#F1F8E9"},
    "n": {"name": "Noun", "description": "bulb, tolerance, slot", "color": "#E8EAF6"},
    "p": {"name": "Pronoun", "description": "we, somebody, mine", "color": "#FCE4EC"},
    "r": {"name": "Adverb", "description": "up, seldom, fortunately", "color": "#EFEBE9"},
    "t": {"name": "Infinitive", "description": "to + infinitive", "color": "#ECEFF1"},
    "u": {"name": "Interjection", "description": "yeah, hi, wow", "color": "#FFF8E1"},
    "v": {"name": "Verb", "description": "modify, scan, govern", "color": "#E1F5FE"},
    "x": {"name": "Negation", "description": "not, n't", "color": "#FFEBEE"},
}


# Complexity levels based on word rank
def get_complexity_level(rank: int) -> str:
    """
    Determine the complexity level based on word rank.
    
    Args:
        rank: Word frequency rank (1-5000)
        
    Returns:
        Complexity level string for prompt generation
    """
    if rank <= 1000:
        return "simple"
    elif rank <= 3000:
        return "moderate"
    else:
        return "advanced"


def get_complexity_description(rank: int) -> str:
    """
    Get detailed complexity description for sentence generation.
    
    Args:
        rank: Word frequency rank (1-5000)
        
    Returns:
        Detailed description for the AI prompt
    """
    if rank <= 1000:
        return "Use simple, everyday language. Short sentences (10-15 words). Common vocabulary."
    elif rank <= 3000:
        return "Use moderate complexity. Standard professional sentences (15-20 words). Mix common and specific vocabulary."
    else:
        return "Use advanced language appropriate for educated professionals. Complex sentences (20-25 words). Technical or specialized vocabulary is acceptable."


settings = Settings()
