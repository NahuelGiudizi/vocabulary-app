/**
 * useAudio hook for managing text-to-speech playback.
 * 
 * Provides audio playback functionality for words and sentences.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ttsApi } from '../services/api';

/**
 * Custom hook for TTS audio playback
 * @returns {Object} Audio state and controls
 */

// Global cache to prevent multiple API calls
let voicesCache = null;
let voicesPromise = null;

// Load voices from backend (singleton pattern)
const loadVoicesFromBackend = async () => {
    if (voicesCache) return voicesCache;
    if (voicesPromise) return voicesPromise;

    voicesPromise = ttsApi.getVoices()
        .then(response => {
            voicesCache = {
                voices: response.voices || [],
                current: response.current || 'en-US-GuyNeural'
            };
            return voicesCache;
        })
        .catch(err => {
            console.error('Failed to load voices from Edge TTS:', err);
            voicesPromise = null; // Allow retry
            return null;
        });

    return voicesPromise;
};

export function useAudio() {
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentText, setCurrentText] = useState(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [voice, setVoice] = useState(() => {
        return localStorage.getItem('tts_voice') || 'en-US-GuyNeural';
    });
    const [voices, setVoices] = useState([]);
    const [voicesLoading, setVoicesLoading] = useState(true);

    const audioRef = useRef(null);
    const audioContextRef = useRef(null);

    // Listen for localStorage changes (from other components like VoiceSelector)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'tts_voice' && e.newValue) {
                setVoice(e.newValue);
            }
        };

        // Also listen for custom event (for same-tab updates)
        const handleVoiceChange = (e) => {
            if (e.detail?.voice) {
                setVoice(e.detail.voice);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('voiceChange', handleVoiceChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('voiceChange', handleVoiceChange);
        };
    }, []);

    // Load available voices from Edge TTS backend
    useEffect(() => {
        let mounted = true;

        const loadVoices = async () => {
            const result = await loadVoicesFromBackend();
            if (mounted && result) {
                setVoices(result.voices);
                if (!localStorage.getItem('tts_voice')) {
                    setVoice(result.current);
                }
            }
            if (mounted) {
                setVoicesLoading(false);
            }
        };

        loadVoices();

        return () => { mounted = false; };
    }, []);

    // Save voice preference and notify other components
    const changeVoice = useCallback((newVoice) => {
        setVoice(newVoice);
        localStorage.setItem('tts_voice', newVoice);
        // Dispatch custom event for same-tab updates
        window.dispatchEvent(new CustomEvent('voiceChange', { detail: { voice: newVoice } }));
    }, []);

    /**
     * Initialize audio context
     */
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    /**
     * Play audio from base64 data
     * @param {string} base64Audio - Base64 encoded audio
     */
    const playBase64 = useCallback(async (base64Audio) => {
        try {
            const audioData = atob(base64Audio);
            const arrayBuffer = new ArrayBuffer(audioData.length);
            const uint8Array = new Uint8Array(arrayBuffer);

            for (let i = 0; i < audioData.length; i++) {
                uint8Array[i] = audioData.charCodeAt(i);
            }

            // Create blob and URL
            const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            // Create audio element
            if (audioRef.current) {
                audioRef.current.pause();
                URL.revokeObjectURL(audioRef.current.src);
            }

            const audio = new Audio(url);
            audio.playbackRate = playbackSpeed;
            audioRef.current = audio;

            audio.onended = () => {
                setPlaying(false);
                setCurrentText(null);
                URL.revokeObjectURL(url);
            };

            audio.onerror = (e) => {
                setError('Failed to play audio');
                setPlaying(false);
                setCurrentText(null);
                URL.revokeObjectURL(url);
            };

            await audio.play();
            setPlaying(true);

        } catch (err) {
            setError(err.message);
            setPlaying(false);
        }
    }, [playbackSpeed]);

    /**
     * Play text using TTS API
     * @param {string} text - Text to synthesize
     * @param {string} mode - TTS mode
     * @param {string} overrideVoice - Optional voice override for testing
     */
    const playText = useCallback(async (text, mode = null, overrideVoice = null) => {
        if (!text || loading) return;

        // Stop current playback
        if (audioRef.current) {
            audioRef.current.pause();
        }

        setLoading(true);
        setError(null);
        setCurrentText(text);

        try {
            // Use override voice if provided, otherwise use current voice
            const voiceToUse = overrideVoice || voice;
            const response = await ttsApi.play(text, mode, voiceToUse);

            if (response.audio) {
                await playBase64(response.audio);
            } else {
                throw new Error('No audio data received');
            }
        } catch (err) {
            setError(err.message);
            setPlaying(false);
            setCurrentText(null);
        } finally {
            setLoading(false);
        }
    }, [loading, playBase64, voice]);

    /**
     * Play audio for a word
     * @param {number} wordId - Word ID
     */
    const playWord = useCallback(async (wordId) => {
        if (!wordId || loading) return;

        setLoading(true);
        setError(null);

        try {
            const response = await ttsApi.getWordAudio(wordId);

            if (response.audio) {
                setCurrentText(response.lemma);
                await playBase64(response.audio);
            }
        } catch (err) {
            setError(err.message);
            setPlaying(false);
        } finally {
            setLoading(false);
        }
    }, [loading, playBase64]);

    /**
     * Play audio for a sentence
     * @param {number} sentenceId - Sentence ID
     */
    const playSentence = useCallback(async (sentenceId) => {
        if (!sentenceId || loading) return;

        setLoading(true);
        setError(null);

        try {
            const response = await ttsApi.getSentenceAudio(sentenceId);

            if (response.audio) {
                setCurrentText(response.text);
                await playBase64(response.audio);
            }
        } catch (err) {
            setError(err.message);
            setPlaying(false);
        } finally {
            setLoading(false);
        }
    }, [loading, playBase64]);

    /**
     * Stop current playback
     */
    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setPlaying(false);
        setCurrentText(null);
    }, []);

    /**
     * Pause current playback
     */
    const pause = useCallback(() => {
        if (audioRef.current && playing) {
            audioRef.current.pause();
            setPlaying(false);
        }
    }, [playing]);

    /**
     * Resume paused playback
     */
    const resume = useCallback(() => {
        if (audioRef.current && !playing) {
            audioRef.current.play();
            setPlaying(true);
        }
    }, [playing]);

    /**
     * Toggle play/pause
     */
    const toggle = useCallback(() => {
        if (playing) {
            pause();
        } else {
            resume();
        }
    }, [playing, pause, resume]);

    /**
     * Update playback speed
     * @param {number} speed - New speed (0.5 - 2.0)
     */
    const setSpeed = useCallback((speed) => {
        const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
        setPlaybackSpeed(clampedSpeed);

        if (audioRef.current) {
            audioRef.current.playbackRate = clampedSpeed;
        }
    }, []);

    /**
     * Check if specific text is currently playing
     * @param {string} text - Text to check
     * @returns {boolean} True if playing
     */
    const isPlayingText = useCallback((text) => {
        return playing && currentText === text;
    }, [playing, currentText]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                if (audioRef.current.src) {
                    URL.revokeObjectURL(audioRef.current.src);
                }
            }
        };
    }, []);

    return {
        // State
        playing,
        loading,
        error,
        currentText,
        playbackSpeed,
        voice,
        voices,
        voicesLoading,

        // Actions
        playText,
        playWord,
        playSentence,
        stop,
        pause,
        resume,
        toggle,
        setSpeed,
        changeVoice,

        // Helpers
        isPlayingText,
    };
}

/**
 * Hook for managing audio playback queue
 * @returns {Object} Queue management functions
 */
export function useAudioQueue() {
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const audio = useAudio();

    /**
     * Add items to queue
     * @param {string[]} texts - Texts to add
     */
    const addToQueue = useCallback((texts) => {
        setQueue((prev) => [...prev, ...texts]);
    }, []);

    /**
     * Clear queue
     */
    const clearQueue = useCallback(() => {
        setQueue([]);
        setCurrentIndex(-1);
        audio.stop();
    }, [audio]);

    /**
     * Play next in queue
     */
    const playNext = useCallback(async () => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < queue.length) {
            setCurrentIndex(nextIndex);
            await audio.playText(queue[nextIndex]);
        }
    }, [currentIndex, queue, audio]);

    /**
     * Start playing queue from beginning
     */
    const startQueue = useCallback(async () => {
        if (queue.length > 0) {
            setCurrentIndex(0);
            await audio.playText(queue[0]);
        }
    }, [queue, audio]);

    // Auto-play next when current finishes
    useEffect(() => {
        if (!audio.playing && currentIndex >= 0 && currentIndex < queue.length - 1) {
            const timer = setTimeout(playNext, 500);
            return () => clearTimeout(timer);
        }
    }, [audio.playing, currentIndex, queue.length, playNext]);

    return {
        ...audio,
        queue,
        currentIndex,
        addToQueue,
        clearQueue,
        playNext,
        startQueue,
        isQueuePlaying: currentIndex >= 0 && currentIndex < queue.length,
    };
}

export default useAudio;
