/**
 * App Component - Main Application
 * 
 * Professional English Vocabulary Learning Application
 * Using COCA word frequency corpus with AI-generated themed sentences.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    BookOpen,
    Settings,
    Download,
    BarChart3,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Server,
    Zap
} from 'lucide-react';

// Components
import {
    WordCard,
    SearchBar,
    ThemeSelector,
    StatsPanel,
    ExportModal,
    VoiceSelector,
    AccentSelector,
} from './components';
import GenerateAllModal from './components/GenerateAllModal';
import VirtualWordList from './components/VirtualWordListV2';

// Hooks
import { useStats, ThemeProvider, useThemeContext } from './hooks';
import { useVirtualWords } from './hooks/useVirtualWords';
import { usePreGeneratedAudio } from './hooks/usePreGeneratedAudio';

// API
import { generationApi, configApi } from './services/api';

/**
 * Header component
 */
function Header({ onShowStats, onShowExport, onShowSettings, onShowGenerateAll }) {
    const { currentTheme, currentThemeInfo } = useThemeContext();

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo and title */}
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl">
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

                    {/* Current theme badge */}
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
                        <span className="text-lg">{currentThemeInfo.emoji}</span>
                        <span className="text-sm font-medium text-gray-700">
                            {currentThemeInfo.name}
                        </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onShowGenerateAll}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-sm font-medium"
                            title="Generate All Examples"
                        >
                            <Zap className="w-4 h-4" />
                            <span className="hidden sm:inline">Generate All</span>
                        </button>
                        <button
                            onClick={onShowStats}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="Statistics"
                        >
                            <BarChart3 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onShowExport}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="Export"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onShowSettings}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}

/**
 * Pagination component
 */
function Pagination({ pagination, onPageChange }) {
    if (!pagination || pagination.total_pages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-4 py-4">
            <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={!pagination.has_prev}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronLeft className="w-4 h-4" />
                Previous
            </button>

            <span className="text-sm text-gray-600">
                Page <span className="font-medium">{pagination.page}</span> of{' '}
                <span className="font-medium">{pagination.total_pages}</span>
            </span>

            <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={!pagination.has_next}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

/**
 * Status bar component
 */
function StatusBar({ ollamaStatus, loading }) {
    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm">
            <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Ollama:</span>
                {ollamaStatus === null ? (
                    <span className="text-gray-400">Checking...</span>
                ) : ollamaStatus ? (
                    <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        Offline
                    </span>
                )}
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                </div>
            )}
        </div>
    );
}

/**
 * Settings panel component
 */
function SettingsPanel({ isOpen, onClose }) {
    const { currentTheme, selectTheme, themesList } = useThemeContext();
    const audio = usePreGeneratedAudio();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto animate-fade-in">
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Theme selector */}
                    <ThemeSelector
                        currentTheme={currentTheme}
                        onThemeChange={(theme) => {
                            selectTheme(theme);
                        }}
                    />

                    {/* Voice selector */}
                    <div className="pt-6 border-t border-gray-200">
                        <VoiceSelector
                            voice={audio.currentVoice}
                            onVoiceChange={audio.changeVoice}
                        />
                    </div>

                    {/* Accent selector for YouGlish */}
                    <div className="pt-6 border-t border-gray-200">
                        <AccentSelector />
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Stats panel modal
 */
function StatsModal({ isOpen, onClose, stats, loading }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-auto animate-fade-in">
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Vocabulary Statistics</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6">
                    <StatsPanel stats={stats} loading={loading} />
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
                    : 'Make sure the database is initialized with vocabulary data'
                }
            </p>
            {hasFilters && (
                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reset Filters
                </button>
            )}
        </div>
    );
}

/**
 * Main app content (with theme context access)
 */
function AppContent() {
    const { currentTheme } = useThemeContext();

    // Virtual words hook with windowed loading
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
        setSearch,
        setPos,
        setTheme,
        setRankRange,
        setSortBy,
        resetFilters,
        refresh,
        isEmpty,
        hasFilters,
    } = useVirtualWords({ theme: currentTheme });

    // Stats hook
    const { stats, loading: statsLoading } = useStats(currentTheme);

    // UI state
    const [showStats, setShowStats] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showGenerateAll, setShowGenerateAll] = useState(false);
    const [ollamaStatus, setOllamaStatus] = useState(null);

    // Check Ollama status on mount
    useEffect(() => {
        const checkOllama = async () => {
            try {
                const result = await generationApi.checkOllama();
                setOllamaStatus(result.available);
            } catch {
                setOllamaStatus(false);
            }
        };

        checkOllama();
        const interval = setInterval(checkOllama, 30000);
        return () => clearInterval(interval);
    }, []);

    // Update theme in words hook when context theme changes
    useEffect(() => {
        setTheme(currentTheme);
    }, [currentTheme, setTheme]);

    // Handle word refresh after generation
    const handleRefresh = useCallback(() => {
        refresh();
    }, [refresh]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <Header
                onShowStats={() => setShowStats(true)}
                onShowExport={() => setShowExport(true)}
                onShowSettings={() => setShowSettings(true)}
                onShowGenerateAll={() => setShowGenerateAll(true)}
            />

            {/* Status bar */}
            <StatusBar ollamaStatus={ollamaStatus} loading={initialLoading || isLoading} />

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

                {/* Compact stats */}
                {stats && (
                    <div className="mb-4">
                        <StatsPanel stats={stats} compact />
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {/* Word list - virtualized with windowed loading */}
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
                        theme={currentTheme}
                        onGenerateSentences={handleRefresh}
                        sortBy={params.sort_by}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 py-4">
                <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
                    <p>
                        Vocabulary Builder • Powered by COCA Word Frequency Corpus & Ollama AI
                    </p>
                </div>
            </footer>

            {/* Modals */}
            <StatsModal
                isOpen={showStats}
                onClose={() => setShowStats(false)}
                stats={stats}
                loading={statsLoading}
            />

            <ExportModal
                isOpen={showExport}
                onClose={() => setShowExport(false)}
                theme={currentTheme}
                rankMin={params.rank_min}
                rankMax={params.rank_max}
            />

            <SettingsPanel
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />

            <GenerateAllModal
                isOpen={showGenerateAll}
                onClose={() => setShowGenerateAll(false)}
                theme={currentTheme}
                onComplete={handleRefresh}
            />
        </div>
    );
}

/**
 * Main App with providers
 */
function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}

export default App;
