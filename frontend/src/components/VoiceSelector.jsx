/**
 * VoiceSelector Component
 * 
 * Dropdown selector for choosing TTS voice.
 */

import React, { memo } from 'react';
import { Volume2, Mic, Loader2 } from 'lucide-react';

/**
 * VoiceSelector component for choosing TTS voice
 */
const VoiceSelector = memo(function VoiceSelector({
    voice,
    voices,
    onVoiceChange,
    onTestVoice,
    loading = false,
    voicesLoading = false,
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <Mic className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Voice Selection (Edge TTS)</h3>
            </div>

            <p className="text-sm text-gray-500 mb-4">
                Choose the voice for text-to-speech playback. Edge TTS provides high-quality
                Microsoft neural voices.
            </p>

            {voicesLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Loading Edge TTS voices...</span>
                </div>
            ) : voices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <p>No voices available. Make sure the backend is running.</p>
                </div>
            ) : (
                <div className="grid gap-2 max-h-80 overflow-y-auto">
                    {voices.map((v) => (
                        <label
                            key={v.id}
                            className={`
                                flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all
                                ${voice === v.id
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }
                            `}
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="radio"
                                    name="voice"
                                    value={v.id}
                                    checked={voice === v.id}
                                    onChange={() => onVoiceChange(v.id)}
                                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                                />
                                <div>
                                    <span className="font-medium text-gray-900">{v.name}</span>
                                    <p className="text-xs text-gray-500">{v.id}</p>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    onTestVoice && onTestVoice(v.id);
                                }}
                                disabled={loading}
                                className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-50"
                                title="Test this voice"
                            >
                                <Volume2 className="w-4 h-4" />
                            </button>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
});

export default VoiceSelector;
