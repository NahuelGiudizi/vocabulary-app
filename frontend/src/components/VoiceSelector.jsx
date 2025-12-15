/**
 * VoiceSelector Component
 * 
 * Grouped voice selector for pre-generated TTS audio library.
 */

import React, { memo } from 'react';
import { Volume2 } from 'lucide-react';

// Voice configurations matching tts-audio-library
const VOICE_GROUPS = {
    'en-US': {
        name: 'American English',
        voices: [
            { id: 'en-US-AriaNeural', name: 'Aria', gender: 'Female' },
            { id: 'en-US-GuyNeural', name: 'Guy', gender: 'Male' },
            { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'Female' },
            { id: 'en-US-ChristopherNeural', name: 'Christopher', gender: 'Male' },
        ]
    },
    'en-GB': {
        name: 'British English',
        voices: [
            { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: 'Female' },
            { id: 'en-GB-RyanNeural', name: 'Ryan', gender: 'Male' },
        ]
    },
    'en-AU': {
        name: 'Australian English',
        voices: [
            { id: 'en-AU-NatashaNeural', name: 'Natasha', gender: 'Female' },
            { id: 'en-AU-WilliamNeural', name: 'William', gender: 'Male' },
        ]
    }
};

/**
 * VoiceSelector component for choosing pre-generated TTS voice
 */
const VoiceSelector = memo(function VoiceSelector({
    voice,
    onVoiceChange,
}) {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Voice Settings
            </h3>

            {Object.entries(VOICE_GROUPS).map(([locale, group]) => (
                <div key={locale} className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">
                        {group.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {group.voices.map((v) => (
                            <button
                                key={v.id}
                                onClick={() => onVoiceChange(v.id)}
                                className={`
                                    flex items-center justify-between p-3 rounded-lg border transition-colors
                                    ${voice === v.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:bg-gray-50'
                                    }
                                `}
                            >
                                <div className="text-left">
                                    <div className="font-medium text-sm">{v.name}</div>
                                    <div className="text-xs text-gray-500">{v.gender}</div>
                                </div>
                                {voice === v.id && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
});

export default VoiceSelector;
