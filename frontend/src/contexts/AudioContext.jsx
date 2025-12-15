/**
 * Audio Context Provider
 * 
 * Provides the correct audio hook based on the mode:
 * - Development: useAudio (backend TTS)
 * - Production: useStaticAudio (Cloudflare Worker TTS)
 */

import React, { createContext, useContext } from 'react';

// Detect if we're in static/production mode
const IS_STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';

// Create context
const AudioContext = createContext(null);

/**
 * Audio Provider component
 */
export function AudioProvider({ children, audioHook }) {
    return (
        <AudioContext.Provider value={audioHook}>
            {children}
        </AudioContext.Provider>
    );
}

/**
 * Hook to use audio from context
 */
export function useAudioContext() {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error('useAudioContext must be used within AudioProvider');
    }
    return context;
}

export default AudioProvider;
