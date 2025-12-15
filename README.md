# Professional English Vocabulary Learning Application

A production-ready web application that helps IT professionals learn the 5,000 most frequent English words through contextually relevant, industry-themed example sentences.

## Features

- **5,000 Word Vocabulary** - Based on COCA (Corpus of Contemporary American English) word frequency data
- **AI-Generated Sentences** - Uses Ollama with customizable models for context-aware sentence generation
- **Professional Themes** - 5 IT industry themes (QA Manager, Software Dev, Agile/Scrum, DevOps, Business)
- **Text-to-Speech** - Both offline (pyttsx3) and online (gTTS) pronunciation support
- **Virtual Scrolling** - Smooth performance with 5,000+ words using react-window
- **Multiple Export Formats** - PDF, Anki flashcards, JSON, TXT, and Audio ZIP
- **POS-Aware Generation** - Sentences correctly use words based on their part of speech

## Tech Stack

### Backend

- **FastAPI** - High-performance Python web framework
- **SQLAlchemy** - ORM with SQLite database
- **Ollama** - Local LLM for sentence generation
- **pyttsx3 / gTTS** - Text-to-speech engines

### Frontend

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool
- **TailwindCSS** - Utility-first CSS
- **react-window** - Virtual scrolling
- **Recharts** - Data visualization

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.ai/) installed and running

### Backend Setup

1. Navigate to the backend directory:

   ```powershell
   cd vocabulary-app\backend
   ```

2. Create and activate a virtual environment:

   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

3. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

4. Create `.env` file (copy from example):

   ```powershell
   Copy-Item .env.example .env
   ```

5. Initialize the database with COCA vocabulary:

   ```powershell
   python scripts\init_db.py --csv ..\..\COCA_WordFrequency.csv
   ```

6. Start the backend server:

   ```powershell
   uvicorn app:app --reload --port 8000
   ```

### Frontend Setup

1. Navigate to the frontend directory:

   ```powershell
   cd vocabulary-app\frontend
   ```

2. Install dependencies:

   ```powershell
   npm install
   ```

3. Start the development server:

   ```powershell
   npm run dev
   ```

4. Open <http://localhost:3000> in your browser

### Ollama Setup

1. Install Ollama from <https://ollama.ai/>

2. Pull a model (default is llama3.2):

   ```powershell
   ollama pull llama3.2
   ```

3. Ensure Ollama is running (default port 11434)

## Generating Sentences

### Single Word Generation

Use the UI to generate sentences for individual words by clicking the "Generate Examples" button on any word card.

### Batch Generation

Use the CLI script for bulk generation:

```powershell
cd vocabulary-app\backend
python scripts\generate_all.py --theme qa_manager --rank-max 1000 --batch-size 10
```

Options:

- `--theme` - Theme for sentences (qa_manager, software_dev, agile_scrum, devops, general_business)
- `--rank-min` / `--rank-max` - Word rank range (1-5000)
- `--batch-size` - Words per batch
- `--limit` - Maximum words to process
- `--regenerate` - Regenerate existing sentences
- `--checkpoint-file` - Resume from checkpoint

## API Endpoints

### Words

- `GET /api/words` - List words with pagination and filters
- `GET /api/words/{id}` - Get single word
- `GET /api/words/stats` - Get vocabulary statistics
- `GET /api/words/pos-types` - List part of speech types
- `GET /api/words/themes` - List available themes

### Generation

- `POST /api/generate/batch` - Start batch generation job
- `POST /api/generate/single` - Generate for single word
- `GET /api/generate/status/{job_id}` - Check job status
- `GET /api/generate/ollama/status` - Check Ollama connection

### TTS

- `POST /api/tts/play` - Generate audio for text
- `GET /api/tts/word/{id}` - Get word pronunciation
- `GET /api/tts/sentence/{id}` - Get sentence audio

### Export

- `POST /api/export/pdf` - Export to PDF
- `POST /api/export/anki` - Export Anki flashcards
- `POST /api/export/json` - Export to JSON
- `POST /api/export/audio-batch` - Export audio ZIP

## Professional Themes

| Theme | Description | Example Context |
|-------|-------------|-----------------|
| QA Manager | Quality Assurance | Test automation, defect tracking, quality metrics |
| Software Dev | Development | Code reviews, debugging, architecture discussions |
| Agile/Scrum | Methodology | Sprint planning, retrospectives, backlog management |
| DevOps | Operations | CI/CD pipelines, infrastructure, monitoring |
| General Business | Professional | Meetings, presentations, stakeholder communication |

## POS-Aware Generation

The system generates sentences that correctly use words based on their grammatical function:

- **Nouns (n)** - Used as subject, object, or complement
- **Verbs (v)** - Conjugated appropriately for tense and subject
- **Adjectives (j)** - Used to modify nouns or as predicates
- **Adverbs (r)** - Used to modify verbs, adjectives, or sentences
- **Prepositions (i)** - Used with appropriate objects
- **And more...** - 15 POS types supported

## Project Structure

```
vocabulary-app/
├── backend/
│   ├── app.py                 # FastAPI application
│   ├── config.py              # Settings and configuration
│   ├── database.py            # SQLAlchemy setup
│   ├── models/                # Database models
│   │   ├── word.py
│   │   ├── sentence.py
│   │   └── generation_log.py
│   ├── routers/               # API routes
│   │   ├── words.py
│   │   ├── generation.py
│   │   ├── tts.py
│   │   └── export.py
│   ├── services/              # Business logic
│   │   ├── ollama_service.py
│   │   ├── tts_service.py
│   │   └── export_service.py
│   ├── scripts/               # CLI scripts
│   │   ├── init_db.py
│   │   ├── generate_all.py
│   │   └── pregenerate_audio.py
│   └── utils/                 # Utilities
│       ├── csv_loader.py
│       └── helpers.py
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # API client
│   │   ├── App.jsx            # Main app
│   │   └── index.css          # Styles
│   ├── package.json
│   └── vite.config.js
└── COCA_WordFrequency.csv     # Source vocabulary data
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_URL=sqlite:///./vocabulary.db

# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT=120

# TTS
TTS_MODE=offline
AUDIO_CACHE_DIR=static/audio

# Development
DEBUG=true
```

### Customizing Themes

Edit `backend/config.py` to add or modify themes:

```python
THEMES = {
    "my_theme": {
        "name": "My Custom Theme",
        "description": "Description here",
        "context": "You are a ... professional",
        "example_topics": ["topic1", "topic2"]
    }
}
```

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- COCA Corpus for word frequency data
- Ollama for local LLM capabilities
- All the open source libraries used in this project
