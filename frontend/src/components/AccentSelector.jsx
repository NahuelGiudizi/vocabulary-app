/**
 * AccentSelector Component
 * 
 * Selector for choosing YouGlish accent preference.
 */

import React, { useState, useEffect, memo } from 'react';
import { Globe } from 'lucide-react';
import { YOUGLISH_ACCENTS, getYouGlishAccent, setYouGlishAccent, openYouGlish } from '../services/api';

/**
 * AccentSelector component for choosing YouGlish accent
 */
const AccentSelector = memo(function AccentSelector() {
    const [accent, setAccent] = useState(() => getYouGlishAccent());

    const handleAccentChange = (newAccent) => {
        setAccent(newAccent);
        setYouGlishAccent(newAccent);
    };

    const testAccent = (accentCode) => {
        openYouGlish('hello', accentCode);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">YouGlish Accent</h3>
            </div>

            <p className="text-sm text-gray-500 mb-4">
                Choose the English accent for YouGlish searches. Clicking the 🎬 button on words
                or sentences will open YouGlish with real video examples in this accent.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(YOUGLISH_ACCENTS).map(([code, { name, flag }]) => (
                    <button
                        key={code}
                        onClick={() => handleAccentChange(code)}
                        className={`
                            flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left
                            ${accent === code
                                ? 'border-amber-500 bg-amber-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }
                        `}
                    >
                        <span className="text-xl">{flag}</span>
                        <span className="text-sm font-medium text-gray-900">{name}</span>
                    </button>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                    onClick={() => testAccent(accent)}
                    className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                    <Globe className="w-4 h-4" />
                    Test with "hello" on YouGlish
                </button>
            </div>
        </div>
    );
});

export default AccentSelector;
