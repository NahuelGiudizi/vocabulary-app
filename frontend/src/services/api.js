/**
 * API service for vocabulary learning application.
 * 
 * This module provides all API calls to the FastAPI backend.
 */

import axios from 'axios';

// API base URL - uses Vite proxy in development
const API_BASE = '/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const message = error.response?.data?.detail || error.message || 'An error occurred';
        console.error('API Error:', message);
        return Promise.reject(new Error(message));
    }
);

/**
 * Words API
 */
export const wordsApi = {
    /**
     * Get paginated list of words with filtering
     * @param {Object} params - Query parameters
     * @param {number} params.page - Page number (default: 1)
     * @param {number} params.per_page - Items per page (default: 50)
     * @param {string} params.search - Search term
     * @param {string} params.pos - Part of speech filter
     * @param {number} params.rank_min - Minimum rank
     * @param {number} params.rank_max - Maximum rank
     * @param {string} params.theme - Theme for sentences
     * @param {boolean} params.has_sentences - Filter by sentence availability
     * @returns {Promise<Object>} Paginated word list
     */
    getWords: (params = {}) => api.get('/words', { params }),

    /**
     * Get a single word by ID
     * @param {number} wordId - Word ID
     * @param {string} theme - Theme filter for sentences
     * @returns {Promise<Object>} Word data
     */
    getWord: (wordId, theme = null) =>
        api.get(`/words/${wordId}`, { params: { theme } }),

    /**
     * Get word(s) by lemma
     * @param {string} lemma - Word lemma
     * @param {string} pos - Part of speech filter
     * @param {string} theme - Theme filter
     * @returns {Promise<Object>} Matching words
     */
    getWordByLemma: (lemma, pos = null, theme = null) =>
        api.get(`/words/by-lemma/${lemma}`, { params: { pos, theme } }),

    /**
     * Get word(s) at a specific rank
     * @param {number} rank - Word rank
     * @param {string} theme - Theme filter
     * @returns {Promise<Object>} Words at that rank
     */
    getWordByRank: (rank, theme = null) =>
        api.get(`/words/rank/${rank}`, { params: { theme } }),

    /**
     * Get vocabulary statistics
     * @param {string} theme - Theme filter
     * @returns {Promise<Object>} Statistics
     */
    getStats: (theme = null) =>
        api.get('/words/stats', { params: { theme } }),

    /**
     * Get available part of speech types
     * @returns {Promise<Object>} POS types
     */
    getPosTypes: () => api.get('/words/pos-types'),

    /**
     * Get available themes
     * @returns {Promise<Object>} Themes list
     */
    getThemes: () => api.get('/words/themes'),
};

/**
 * Generation API
 */
export const generationApi = {
    /**
     * Start batch generation job
     * @param {Object} request - Generation request
     * @param {string} request.theme - Theme for generation
     * @param {number[]} request.word_ids - Specific word IDs
     * @param {number} request.rank_min - Minimum rank
     * @param {number} request.rank_max - Maximum rank
     * @param {number} request.batch_size - Words per batch
     * @param {boolean} request.regenerate - Regenerate existing
     * @returns {Promise<Object>} Job info
     */
    startBatch: (request) => api.post('/generate/batch', request),

    /**
     * Get generation job status
     * @param {string} jobId - Job ID
     * @returns {Promise<Object>} Job status
     */
    getStatus: (jobId) => api.get(`/generate/status/${jobId}`),

    /**
     * List all generation jobs
     * @param {string} status - Status filter
     * @param {number} limit - Max results
     * @returns {Promise<Object>} Job list
     */
    listJobs: (status = null, limit = 20) =>
        api.get('/generate/jobs', { params: { status, limit } }),

    /**
     * Generate sentences for a single word
     * @param {number} wordId - Word ID
     * @param {string} theme - Theme
     * @param {number} sentencesCount - Number of sentences
     * @returns {Promise<Object>} Generated sentences
     */
    generateSingle: (wordId, theme = 'qa_manager', sentencesCount = 3) =>
        api.post('/generate/single', {
            word_id: wordId,
            theme,
            sentences_count: sentencesCount,
        }),

    /**
     * Delete sentences for a word
     * @param {number} wordId - Word ID
     * @param {string} theme - Theme filter
     * @returns {Promise<Object>} Deletion result
     */
    deleteSentences: (wordId, theme = null) =>
        api.delete(`/generate/sentences/${wordId}`, { params: { theme } }),

    /**
     * Get generation logs
     * @param {number} limit - Max results
     * @param {string} theme - Theme filter
     * @returns {Promise<Object>} Logs
     */
    getLogs: (limit = 100, theme = null) =>
        api.get('/generate/logs', { params: { limit, theme } }),

    /**
     * Check Ollama status
     * @returns {Promise<Object>} Ollama status
     */
    checkOllama: () => api.get('/generate/ollama/status'),
};

/**
 * Text-to-Speech API
 */
export const ttsApi = {
    /**
     * Generate TTS audio for text
     * @param {string} text - Text to synthesize
     * @param {string} mode - TTS mode (edge/offline/online)
     * @param {string} voice - Edge TTS voice name
     * @returns {Promise<Object>} Base64 audio
     */
    play: (text, mode = null, voice = null) =>
        api.post('/tts/play', { text, mode, voice }),

    /**
     * Get available TTS voices
     * @returns {Promise<Object>} Available voices
     */
    getVoices: () => api.get('/tts/voices'),

    /**
     * Get audio download URL for text
     * @param {string} text - Text to synthesize
     * @param {string} mode - TTS mode
     * @returns {string} Download URL
     */
    getDownloadUrl: (text, mode = null) => {
        const params = new URLSearchParams({ text });
        if (mode) params.append('mode', mode);
        return `${API_BASE}/tts/download?${params}`;
    },

    /**
     * Get audio for a word
     * @param {number} wordId - Word ID
     * @returns {Promise<Object>} Audio data
     */
    getWordAudio: (wordId) => api.get(`/tts/word/${wordId}`),

    /**
     * Get audio for a sentence
     * @param {number} sentenceId - Sentence ID
     * @returns {Promise<Object>} Audio data
     */
    getSentenceAudio: (sentenceId) => api.get(`/tts/sentence/${sentenceId}`),

    /**
     * Pre-generate audio for a word
     * @param {number} wordId - Word ID
     * @param {string} theme - Theme filter
     * @returns {Promise<Object>} Generation result
     */
    pregenerate: (wordId, theme = null) =>
        api.post('/tts/pregenerate', { word_id: wordId, theme }),

    /**
     * Get TTS service status
     * @returns {Promise<Object>} TTS status
     */
    getStatus: () => api.get('/tts/status'),

    /**
     * Clear old cached audio
     * @param {number} maxAgeDays - Max age in days
     * @returns {Promise<Object>} Cleanup result
     */
    clearCache: (maxAgeDays = 30) =>
        api.delete('/tts/cache', { params: { max_age_days: maxAgeDays } }),
};

/**
 * Export API
 */
export const exportApi = {
    /**
     * Export to PDF
     * @param {Object} request - Export request
     * @returns {Promise<Blob>} PDF file
     */
    exportPdf: async (request) => {
        const response = await axios.post(`${API_BASE}/export/pdf`, request, {
            responseType: 'blob',
        });
        return response.data;
    },

    /**
     * Export to Anki CSV
     * @param {Object} request - Export request
     * @returns {Promise<Blob>} CSV file
     */
    exportAnki: async (request) => {
        const response = await axios.post(`${API_BASE}/export/anki`, request, {
            responseType: 'blob',
        });
        return response.data;
    },

    /**
     * Export audio as ZIP
     * @param {Object} request - Export request
     * @returns {Promise<Blob>} ZIP file
     */
    exportAudio: async (request) => {
        const response = await axios.post(`${API_BASE}/export/audio-batch`, request, {
            responseType: 'blob',
        });
        return response.data;
    },

    /**
     * Export to JSON
     * @param {Object} request - Export request
     * @param {boolean} pretty - Pretty print
     * @returns {Promise<Blob>} JSON file
     */
    exportJson: async (request, pretty = true) => {
        const response = await axios.post(
            `${API_BASE}/export/json?pretty=${pretty}`,
            request,
            { responseType: 'blob' }
        );
        return response.data;
    },

    /**
     * Export to plain text
     * @param {Object} request - Export request
     * @returns {Promise<Blob>} TXT file
     */
    exportText: async (request) => {
        const response = await axios.post(`${API_BASE}/export/txt`, request, {
            responseType: 'blob',
        });
        return response.data;
    },

    /**
     * Get available export formats
     * @returns {Promise<Object>} Format list
     */
    getFormats: () => api.get('/export/formats'),
};

/**
 * Config API
 */
export const configApi = {
    /**
     * Get application configuration
     * @returns {Promise<Object>} Config
     */
    getConfig: () => api.get('/config'),

    /**
     * Health check
     * @returns {Promise<Object>} Health status
     */
    healthCheck: () => axios.get('/health').then(r => r.data),
};

/**
 * Helper to download a blob as file
 * @param {Blob} blob - File blob
 * @param {string} filename - Download filename
 */
export const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

/**
 * YouGlish accent options
 */
export const YOUGLISH_ACCENTS = {
    '': { name: 'All English', flag: '🌍' },
    'us': { name: 'American', flag: '🇺🇸' },
    'uk': { name: 'British', flag: '🇬🇧' },
    'aus': { name: 'Australian', flag: '🇦🇺' },
    'ca': { name: 'Canadian', flag: '🇨🇦' },
    'ie': { name: 'Irish', flag: '🇮🇪' },
    'sco': { name: 'Scottish', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
    'nz': { name: 'New Zealand', flag: '🇳🇿' },
};

/**
 * Extract a 3-word context around a target word from a sentence
 * Handles special cases like contractions (n't, 's, 'll, etc.)
 * @param {string} sentence - Full sentence
 * @param {string} targetWord - Word to find and center around
 * @returns {string} 3-word phrase (word before + target + word after)
 */
export const extractWordContext = (sentence, targetWord) => {
    if (!sentence || !targetWord) return targetWord || '';

    // Special handling for negation contraction "n't"
    const isNegationContraction = targetWord.toLowerCase() === "n't" || targetWord.toLowerCase() === "nt";

    // List of valid negative contractions
    const negativeContractions = [
        "don't", "can't", "won't", "shouldn't", "couldn't", "wouldn't",
        "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't",
        "hadn't", "doesn't", "didn't", "mustn't", "needn't", "shan't",
        "daren't", "mightn't", "ain't"
    ];

    // Split sentence into words (keeping punctuation attached)
    const words = sentence.split(/\s+/).filter(w => w);

    let targetIndex = -1;

    if (isNegationContraction) {
        // Find word that is a negative contraction
        targetIndex = words.findIndex(w => {
            const clean = w.toLowerCase().replace(/[.,!?;:"()\[\]]/g, '');
            return negativeContractions.includes(clean);
        });
    } else {
        // Clean words for comparison
        const cleanWords = words.map(w => w.replace(/[.,!?;:"'()\[\]]/g, '').toLowerCase());
        const targetLower = targetWord.toLowerCase();

        // Find exact match first
        targetIndex = cleanWords.findIndex(w => w === targetLower);

        // Try partial match if not found
        if (targetIndex === -1) {
            targetIndex = cleanWords.findIndex(w => w.includes(targetLower));
        }
    }

    if (targetIndex === -1) return targetWord;

    // Get 1 word before and 1 word after, clean punctuation from edges
    const start = Math.max(0, targetIndex - 1);
    const end = Math.min(words.length, targetIndex + 2);

    return words.slice(start, end)
        .map(w => w.replace(/^[.,!?;:"'()\[\]]+|[.,!?;:"'()\[\]]+$/g, ''))
        .join(' ');
};

/**
 * Open YouGlish in a new tab to hear pronunciation in context
 * @param {string} text - Word or phrase to search
 * @param {string} accent - Accent code (us, uk, aus, ca, ie, sco, nz) or empty for all
 */
export const openYouGlish = (text, accent = '') => {
    if (!text) return;

    // Replace spaces with underscores and encode
    const encoded = encodeURIComponent(text.trim().replace(/\s+/g, '_'));
    const accentPath = accent ? `/${accent}` : '';
    const url = `https://youglish.com/pronounce/${encoded}/english${accentPath}`;

    window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Get saved YouGlish accent preference
 * @returns {string} Accent code
 */
export const getYouGlishAccent = () => {
    return localStorage.getItem('youglish_accent') || '';
};

/**
 * Save YouGlish accent preference
 * @param {string} accent - Accent code
 */
export const setYouGlishAccent = (accent) => {
    localStorage.setItem('youglish_accent', accent);
};

export default {
    words: wordsApi,
    generation: generationApi,
    tts: ttsApi,
    export: exportApi,
    config: configApi,
    downloadBlob,
    openYouGlish,
    extractWordContext,
    YOUGLISH_ACCENTS,
    getYouGlishAccent,
    setYouGlishAccent,
};
