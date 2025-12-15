/**
 * useStaticAudio hook for TTS via Cloudflare Worker.
 * 
 * Used in production mode where there's no Python backend.
 * Connects to Cloudflare Worker for Edge TTS.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// TTS Worker URL - will be replaced with actual worker URL after deploy
const TTS_WORKER_URL = import.meta.env.VITE_TTS_WORKER_URL || 'https://vocabulary-tts.nahuelgiudizi.workers.dev';

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
 * Custom hook for text-to-speech via Cloudflare Worker
 */
export function useStaticAudio() {
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
     * Play text using TTS
     */
    const playText = useCallback(async (text, wordId = null, voiceOverride = null) => {
        if (!text) return;

        // Stop any current playback
        stop();

        const voice = voiceOverride || currentVoice;
        setIsLoading(true);
        setError(null);

        try {
            // Create abort controller for this request
            abortControllerRef.current = new AbortController();

            // Build TTS URL
            const url = new URL(`${TTS_WORKER_URL}/tts`);
            url.searchParams.set('text', text);
            url.searchParams.set('voice', voice);

            // Fetch audio from worker
            const response = await fetch(url.toString(), {
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`TTS error: ${response.status}`);
            }

            // Create blob URL and play
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
                setIsPlaying(false);
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = () => {
                setError('Failed to play audio');
                setIsPlaying(false);
                URL.revokeObjectURL(audioUrl);
            };

            setIsLoading(false);
            setIsPlaying(true);
            await audio.play();

        } catch (err) {
            if (err.name === 'AbortError') {
                // Playback was cancelled, not an error
                return;
            }
            console.error('TTS error:', err);
            setError(err.message);
            setIsLoading(false);
        }
    }, [currentVoice, stop]);

    /**
     * Play word pronunciation
     */
    const playWord = useCallback((word, voiceOverride = null) => {
        if (!word) return;
        const text = typeof word === 'string' ? word : word.lemma;
        playText(text, word?.id, voiceOverride);
    }, [playText]);

    /**
     * Play sentence
     */
    const playSentence = useCallback((sentence, voiceOverride = null) => {
        if (!sentence) return;
        const text = typeof sentence === 'string' ? sentence : sentence.text || sentence.sentence_text;
        playText(text, null, voiceOverride);
    }, [playText]);

    /**
     * Change voice preference
     */
    const changeVoice = useCallback((voice) => {
        try {
            localStorage.setItem(VOICE_STORAGE_KEY, voice);
        } catch { }
        setCurrentVoice(voice);

        // Notify other components
        window.dispatchEvent(new CustomEvent('voiceChange', {
            detail: { voice }
        }));
    }, []);

    /**
     * Check if TTS worker is available
     */
    const checkAvailability = useCallback(async () => {
        try {
            const response = await fetch(`${TTS_WORKER_URL}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }, []);

    return {
        // State
        isPlaying,
        isLoading,
        error,
        currentVoice,

        // Actions
        playText,
        playWord,
        playSentence,
        stop,
        changeVoice,
        checkAvailability,
    };
}

export default useStaticAudio;
