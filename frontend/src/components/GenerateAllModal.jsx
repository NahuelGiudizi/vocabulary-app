/**
 * GenerateAllModal Component
 * 
 * Modal for generating example sentences for all words with progress tracking.
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
    X,
    Play,
    Pause,
    Square,
    Loader2,
    Check,
    AlertCircle,
    Clock,
    Zap
} from 'lucide-react';
import { generationApi, wordsApi } from '../services/api';

/**
 * Format duration in seconds to human readable
 */
const formatDuration = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
};

/**
 * GenerateAllModal component
 */
const GenerateAllModal = memo(function GenerateAllModal({
    isOpen,
    onClose,
    theme = 'qa_manager',
    onComplete,
}) {
    const [status, setStatus] = useState('idle'); // idle, running, paused, completed, error
    const [progress, setProgress] = useState({
        current: 0,
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
    });
    const [startTime, setStartTime] = useState(null);
    const [eta, setEta] = useState(null);
    const [currentWord, setCurrentWord] = useState(null);
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);

    const abortRef = useRef(false);
    const pauseRef = useRef(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStatus('idle');
            setProgress({ current: 0, total: 0, successful: 0, failed: 0, skipped: 0 });
            setStartTime(null);
            setEta(null);
            setCurrentWord(null);
            setError(null);
            setLogs([]);
            abortRef.current = false;
            pauseRef.current = false;
        }
    }, [isOpen]);

    // Add log entry
    const addLog = useCallback((message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev.slice(-99), { timestamp, message, type }]);
    }, []);

    // Calculate ETA
    const updateEta = useCallback((current, total, elapsed) => {
        if (current === 0 || elapsed === 0) return;
        const avgTimePerWord = elapsed / current;
        const remaining = total - current;
        setEta(remaining * avgTimePerWord);
    }, []);

    // Start generation
    const handleStart = useCallback(async () => {
        setStatus('running');
        setError(null);
        const start = Date.now();
        setStartTime(start);
        abortRef.current = false;
        pauseRef.current = false;
        addLog('Starting generation process...', 'info');

        try {
            // Get all words
            const statsResponse = await wordsApi.getStats(theme);
            const totalWords = statsResponse.total_words || 0;
            const wordsWithSentences = statsResponse.words_generated || 0;

            addLog(`Found ${totalWords} total words, ${wordsWithSentences} already have sentences for "${theme}"`, 'info');
            addLog(`Will check all words and generate missing sentences...`, 'info');

            // Get all words (in batches of 500)
            let page = 1;
            const perPage = 500;
            let processedCount = 0;
            let successCount = 0;
            let failCount = 0;
            let skipCount = 0;
            let allWords = [];

            // First fetch all word IDs
            addLog('Fetching word list...', 'info');
            while (true) {
                const response = await wordsApi.getWords({
                    page,
                    per_page: perPage,
                    theme,
                });
                const words = response.words || [];
                if (words.length === 0) break;
                allWords = allWords.concat(words);
                page++;
                if (!response.pagination?.has_next) break;
            }

            addLog(`Loaded ${allWords.length} words to process`, 'info');
            setProgress({ current: 0, total: allWords.length, successful: 0, failed: 0, skipped: 0 });

            // Process each word
            for (let i = 0; i < allWords.length; i++) {
                if (abortRef.current) break;

                // Wait if paused
                while (pauseRef.current && !abortRef.current) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (abortRef.current) break;

                const word = allWords[i];
                setCurrentWord(word.lemma);

                // Check if word already has sentences for this theme
                const existingSentences = word.sentences?.filter(s => s.theme === theme) || [];
                if (existingSentences.length > 0) {
                    skipCount++;
                    processedCount++;
                    setProgress({
                        current: processedCount,
                        total: allWords.length,
                        successful: successCount,
                        failed: failCount,
                        skipped: skipCount,
                    });
                    continue;
                }

                try {
                    await generationApi.generateSingle(word.id, theme, 3);
                    successCount++;
                    addLog(`✓ Generated: "${word.lemma}" (${word.pos})`, 'success');
                } catch (err) {
                    failCount++;
                    addLog(`✗ Failed: "${word.lemma}" - ${err.message}`, 'error');
                }

                processedCount++;
                setProgress({
                    current: processedCount,
                    total: allWords.length,
                    successful: successCount,
                    failed: failCount,
                    skipped: skipCount,
                });

                // Update ETA
                const elapsed = (Date.now() - start) / 1000;
                updateEta(processedCount, allWords.length, elapsed);

                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (abortRef.current) {
                setStatus('idle');
                addLog('Generation stopped by user', 'warning');
            } else {
                setStatus('completed');
                addLog(`Generation completed! ${successCount} successful, ${failCount} failed, ${skipCount} skipped`, 'success');
                if (onComplete) onComplete();
            }

        } catch (err) {
            setError(err.message);
            setStatus('error');
            addLog(`Error: ${err.message}`, 'error');
        }
    }, [theme, addLog, updateEta, onComplete]);

    // Pause generation
    const handlePause = useCallback(() => {
        pauseRef.current = true;
        setStatus('paused');
        addLog('Generation paused', 'warning');
    }, [addLog]);

    // Resume generation
    const handleResume = useCallback(() => {
        pauseRef.current = false;
        setStatus('running');
        addLog('Generation resumed', 'info');
    }, [addLog]);

    // Stop generation
    const handleStop = useCallback(() => {
        abortRef.current = true;
        pauseRef.current = false;
        addLog('Stopping generation...', 'warning');
    }, [addLog]);

    // Calculate progress percentage
    const progressPercent = progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    // Elapsed time
    const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={status === 'idle' ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Generate All Examples
                    </h2>
                    {status === 'idle' && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Status info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                                Theme: <span className="capitalize">{theme.replace('_', ' ')}</span>
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${status === 'running' ? 'bg-blue-100 text-blue-700' :
                                    status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                                        status === 'completed' ? 'bg-green-100 text-green-700' :
                                            status === 'error' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-700'
                                }`}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>

                        {currentWord && status === 'running' && (
                            <p className="text-sm text-gray-600">
                                Current word: <strong>{currentWord}</strong>
                            </p>
                        )}
                    </div>

                    {/* Progress bar */}
                    {status !== 'idle' && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                    Progress: {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                                </span>
                                <span className="font-medium text-gray-900">{progressPercent}%</span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            {/* Stats */}
                            <div className="flex gap-4 text-xs">
                                <span className="text-green-600">✓ {progress.successful} success</span>
                                <span className="text-red-600">✗ {progress.failed} failed</span>
                                <span className="text-gray-500">↷ {progress.skipped} skipped</span>
                            </div>
                        </div>
                    )}

                    {/* Time info */}
                    {status !== 'idle' && (
                        <div className="flex gap-6 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="w-4 h-4" />
                                Elapsed: {formatDuration(elapsed)}
                            </div>
                            {eta !== null && status === 'running' && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Clock className="w-4 h-4" />
                                    ETA: {formatDuration(eta)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Logs */}
                    {logs.length > 0 && (
                        <div className="border border-gray-200 rounded-lg">
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-600">
                                Activity Log
                            </div>
                            <div className="h-40 overflow-y-auto p-2 font-mono text-xs space-y-1">
                                {logs.map((log, i) => (
                                    <div
                                        key={i}
                                        className={`${log.type === 'error' ? 'text-red-600' :
                                                log.type === 'success' ? 'text-green-600' :
                                                    log.type === 'warning' ? 'text-amber-600' :
                                                        'text-gray-600'
                                            }`}
                                    >
                                        <span className="text-gray-400">[{log.timestamp}]</span> {log.message}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Success message */}
                    {status === 'completed' && (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
                            <Check className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">
                                Generation completed! {progress.successful} sentences generated successfully.
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
                    {status === 'idle' && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStart}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                <Play className="w-4 h-4" />
                                Start Generation
                            </button>
                        </>
                    )}

                    {status === 'running' && (
                        <>
                            <button
                                onClick={handlePause}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                            >
                                <Pause className="w-4 h-4" />
                                Pause
                            </button>
                            <button
                                onClick={handleStop}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                                <Square className="w-4 h-4" />
                                Stop
                            </button>
                        </>
                    )}

                    {status === 'paused' && (
                        <>
                            <button
                                onClick={handleResume}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                                <Play className="w-4 h-4" />
                                Resume
                            </button>
                            <button
                                onClick={handleStop}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                                <Square className="w-4 h-4" />
                                Stop
                            </button>
                        </>
                    )}

                    {(status === 'completed' || status === 'error') && (
                        <button
                            onClick={onClose}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            <Check className="w-4 h-4" />
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

export default GenerateAllModal;
