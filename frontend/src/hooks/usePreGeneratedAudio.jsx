/**
 * usePreGeneratedAudio hook for pre-computed TTS audio files.
 * 
 * Uses the pre-generated MP3 files from tts-audio-library.
 * Falls back to dynamic TTS if file not found.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Audio library base path
const AUDIO_BASE_PATH = '/tts-audio';

// Voice configurations matching tts-audio-library/config.json
export const VOICE_CONFIGS = {
  'en-US-AriaNeural': { locale: 'en-US', gender: 'female', name: 'Aria', accent: 'American' },
  'en-US-GuyNeural': { locale: 'en-US', gender: 'male', name: 'Guy', accent: 'American' },
  'en-US-JennyNeural': { locale: 'en-US', gender: 'female', name: 'Jenny', accent: 'American' },
  'en-US-ChristopherNeural': { locale: 'en-US', gender: 'male', name: 'Christopher', accent: 'American' },
  'en-GB-SoniaNeural': { locale: 'en-GB', gender: 'female', name: 'Sonia', accent: 'British' },
  'en-GB-RyanNeural': { locale: 'en-GB', gender: 'male', name: 'Ryan', accent: 'British' },
  'en-AU-NatashaNeural': { locale: 'en-AU', gender: 'female', name: 'Natasha', accent: 'Australian' },
  'en-AU-WilliamNeural': { locale: 'en-AU', gender: 'male', name: 'William', accent: 'Australian' },
};

// Default voice
const DEFAULT_VOICE = 'en-US-AriaNeural';

// Voice storage key
const VOICE_STORAGE_KEY = 'vocabulary_voice';

/**
 * Get stored voice preference
 */
function getStoredVoice() {
    try {
        return localStorage.getItem(VOICE_STORAGE_KEY) || DEFAULT_VOICE;
    } catch {
        return DEFAULT_VOICE;
    }
}

/**
 * Sanitize text for use as filename
 */
function sanitizeForFilename(text) {
    return text.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100);
}

/**
 * Custom hook for pre-generated audio playback
 */
export function usePreGeneratedAudio() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentVoice, setCurrentVoice] = useState(getStoredVoice);

    const audioRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Listen for voice changes from other components
    useEffect(() => {
        const handleVoiceChange = (e) => {
            setCurrentVoice(e.detail.voice);
        };

        const handleStorageChange = (e) => {
            if (e.key === VOICE_STORAGE_KEY && e.newValue) {
                setCurrentVoice(e.newValue);
            }
        };

        window.addEventListener('voiceChange', handleVoiceChange);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('voiceChange', handleVoiceChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    /**
     * Stop current playback
     */
    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsPlaying(false);
        setIsLoading(false);
    }, []);

    /**
     * Get audio file path for a word
     */
    const getWordAudioPath = useCallback((word, voice) => {
        const config = VOICE_CONFIGS[voice] || VOICE_CONFIGS[DEFAULT_VOICE];
        const { locale, gender } = config;
        const filename = `${sanitizeForFilename(word)}.mp3`;
        return `${AUDIO_BASE_PATH}/words/${locale}/${gender}/${filename}`;
    }, []);

    /**
     * Get audio file path for a sentence
     */
    const getSentenceAudioPath = useCallback((sentenceId, voice) => {
        const config = VOICE_CONFIGS[voice] || VOICE_CONFIGS[DEFAULT_VOICE];
        const { locale, gender } = config;
        const filename = `${String(sentenceId).padStart(6, '0')}.mp3`;
        return `${AUDIO_BASE_PATH}/sentences/${locale}/${gender}/${filename}`;
    }, []);

    /**
     * Play audio from pre-generated file
     */
    const playAudio = useCallback(async (audioPath) => {
        stop();
        setIsLoading(true);
        setError(null);

        try {
            // Create new audio element
            const audio = new Audio(audioPath);
            audioRef.current = audio;

            // Setup event listeners
            const handleCanPlay = () => {
                setIsLoading(false);
                audio.play().catch(err => {
                    console.error('Playback error:', err);
                    setError('Failed to play audio');
                    setIsPlaying(false);
                });
            };

            const handlePlay = () => setIsPlaying(true);
            const handleEnded = () => {
                setIsPlaying(false);
                audioRef.current = null;
            };

            const handleError = (e) => {
                console.error('Audio loading error:', e);
                setError('Audio file not found');
                setIsLoading(false);
                setIsPlaying(false);
                audioRef.current = null;
            };

            audio.addEventListener('canplay', handleCanPlay);
            audio.addEventListener('play', handlePlay);
            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('error', handleError);

            // Load the audio
            audio.load();

        } catch (err) {
            console.error('Error playing audio:', err);
            setError(err.message);
            setIsLoading(false);
            setIsPlaying(false);
        }
    }, [stop]);

    /**
     * Play word audio
     */
    const playWord = useCallback(async (word, voiceOverride = null) => {
        if (!word) return;
        const voice = voiceOverride || currentVoice;
        const audioPath = getWordAudioPath(word, voice);
        await playAudio(audioPath);
    }, [currentVoice, getWordAudioPath, playAudio]);

    /**
     * Play sentence audio
     */
    const playSentence = useCallback(async (sentenceId, voiceOverride = null) => {
        if (!sentenceId) return;
        const voice = voiceOverride || currentVoice;
        const audioPath = getSentenceAudioPath(sentenceId, voice);
        await playAudio(audioPath);
    }, [currentVoice, getSentenceAudioPath, playAudio]);

    /**
     * Play any text (for compatibility)
     */
    const playText = useCallback(async (text, sentenceId = null, voiceOverride = null) => {
        if (sentenceId) {
            await playSentence(sentenceId, voiceOverride);
        } else {
            // For arbitrary text, use word audio with the text
            await playWord(text, voiceOverride);
        }
    }, [playWord, playSentence]);

    /**
     * Change voice and save preference
     */
    const changeVoice = useCallback((newVoice) => {
        if (VOICE_CONFIGS[newVoice]) {
            setCurrentVoice(newVoice);
            try {
                localStorage.setItem(VOICE_STORAGE_KEY, newVoice);
                // Dispatch event for other components
                window.dispatchEvent(new CustomEvent('voiceChange', { 
                    detail: { voice: newVoice } 
                }));
            } catch (err) {
                console.error('Failed to save voice preference:', err);
            }
        }
    }, []);

    return {
        isPlaying,
        isLoading,
        error,
        currentVoice,
        playWord,
        playSentence,
        playText,
        stop,
        changeVoice,
        voices: Object.entries(VOICE_CONFIGS).map(([id, config]) => ({
            id,
            ...config
        }))
    };
}
