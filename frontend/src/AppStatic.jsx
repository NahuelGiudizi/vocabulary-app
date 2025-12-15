/**
 * App Component - Static Production Version
 * 
 * Simplified version for GitHub Pages deployment.
 * No backend required - loads data from static JSON files.
 * TTS via Cloudflare Worker.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    BookOpen,
    Settings,
    BarChart3,
    RefreshCw,
    X,
    Volume2,
} from 'lucide-react';

// Components
import VirtualWordList from './components/VirtualWordListV2';
import {
    SearchBar,
    StatsPanel,
} from './components';

// Hooks
import { useStaticWords } from './hooks/useStaticWords';
import { useStaticAudio } from './hooks/useStaticAudio';

// Voice options
const VOICES = {
    'en-US': [
        { id: 'en-US-AriaNeural', name: 'Aria', gender: 'Female' },
        { id: 'en-US-GuyNeural', name: 'Guy', gender: 'Male' },
        { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'Female' },
        { id: 'en-US-ChristopherNeural', name: 'Christopher', gender: 'Male' },
    ],
    'en-GB': [
        { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: 'Female' },
        { id: 'en-GB-RyanNeural', name: 'Ryan', gender: 'Male' },
    ],
    'en-AU': [
        { id: 'en-AU-NatashaNeural', name: 'Natasha', gender: 'Female' },
        { id: 'en-AU-WilliamNeural', name: 'William', gender: 'Male' },
    ],
};

/**
 * Header component
 */
function Header({ onShowSettings }) {
    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                Vocabulary Builder
                            </h1>
                            <p className="text-sm text-gray-500">
                                5,000 Essential English Words
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onShowSettings}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}

/**
 * Compact stats bar
 */
function StatsBar({ stats }) {
    if (!stats) return null;
    
    return (
        <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm">
            <div className="flex items-center gap-2">
                <span className="text-gray-600">Words:</span>
                <span className="font-medium">{stats.total_words?.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-gray-600">Sentences:</span>
                <span className="font-medium">{stats.total_sentences?.toLocaleString()}</span>
            </div>
        </div>
    );
}

/**
 * Settings panel component
 */
function SettingsPanel({ isOpen, onClose }) {
    const audio = useStaticAudio();

    const handleTestVoice = (voiceId) => {
        audio.playText("Hello! This is a test of the text to speech voice.", null, voiceId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Voice Settings */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <Volume2 className="w-4 h-4" />
                            Voice Settings
                        </h3>

                        {Object.entries(VOICES).map(([accent, voices]) => (
                            <div key={accent} className="space-y-2">
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    {accent === 'en-US' ? 'American English' :
                                     accent === 'en-GB' ? 'British English' :
                                     'Australian English'}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {voices.map(voice => (
                                        <button
                                            key={voice.id}
                                            onClick={() => {
                                                audio.changeVoice(voice.id);
                                                handleTestVoice(voice.id);
                                            }}
                                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                                audio.currentVoice === voice.id
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="text-left">
                                                <div className="font-medium text-sm">{voice.name}</div>
                                                <div className="text-xs text-gray-500">{voice.gender}</div>
                                            </div>
                                            {audio.currentVoice === voice.id && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Empty state component
 */
function EmptyState({ hasFilters, onReset }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
                {hasFilters ? 'No words found' : 'No words loaded'}
            </h3>
            <p className="text-gray-500 mb-4">
                {hasFilters
                    ? 'Try adjusting your search or filters'
                    : 'Make sure the data files are available'
                }
            </p>
            {hasFilters && (
                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reset Filters
                </button>
            )}
        </div>
    );
}

/**
 * Main app component
 */
function App() {
    // Static words hook
    const {
        totalCount,
        getWordAtIndex,
        isIndexLoaded,
        isIndexLoading,
        ensureDataForRange,
        loadedCount,
        initialLoading,
        isLoading,
        error,
        params,
        stats,
        setSearch,
        setPos,
        setRankRange,
        setSortBy,
        resetFilters,
        isEmpty,
        hasFilters,
    } = useStaticWords();

    // UI state
    const [showSettings, setShowSettings] = useState(false);

    // Dummy refresh (no-op in static mode)
    const handleRefresh = useCallback(() => {}, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <Header onShowSettings={() => setShowSettings(true)} />

            {/* Stats bar */}
            <StatsBar stats={stats} />

            {/* Main content */}
            <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 py-6">
                {/* Search and filters */}
                <div className="mb-6">
                    <SearchBar
                        onSearch={setSearch}
                        onPosChange={setPos}
                        onRankChange={setRankRange}
                        onSortChange={setSortBy}
                        onReset={resetFilters}
                        initialSearch={params.search}
                        initialPos={params.pos || ''}
                        initialRankMin={params.rank_min}
                        initialRankMax={params.rank_max}
                        initialSortBy={params.sort_by}
                    />
                </div>

                {/* Error state */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {/* Word list */}
                {isEmpty ? (
                    <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
                ) : (
                    <VirtualWordList
                        totalCount={totalCount}
                        getWordAtIndex={getWordAtIndex}
                        isIndexLoaded={isIndexLoaded}
                        isIndexLoading={isIndexLoading}
                        ensureDataForRange={ensureDataForRange}
                        loadedCount={loadedCount}
                        isLoading={isLoading}
                        initialLoading={initialLoading}
                        theme={null}
                        onGenerateSentences={handleRefresh}
                        sortBy={params.sort_by}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 py-4">
                <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
                    <p>
                        Vocabulary Builder • COCA Word Frequency Corpus
                    </p>
                </div>
            </footer>

            {/* Settings modal */}
            <SettingsPanel
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
}

export default App;
