/**
 * ExportModal Component
 * 
 * Modal dialog for exporting vocabulary data in various formats.
 */

import React, { useState, useCallback, memo } from 'react';
import {
    X,
    Download,
    FileText,
    FileJson,
    Music,
    Loader2,
    Check,
    AlertCircle
} from 'lucide-react';
import { exportApi, downloadBlob } from '../services/api';

/**
 * Export format configurations
 */
const EXPORT_FORMATS = [
    {
        key: 'pdf',
        name: 'PDF Document',
        description: 'Printable document with words and sentences',
        icon: FileText,
        extension: '.pdf',
        color: 'text-red-500',
        bgColor: 'bg-red-50',
    },
    {
        key: 'anki',
        name: 'Anki Flashcards',
        description: 'Import directly into Anki for spaced repetition',
        icon: FileText,
        extension: '.csv',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
    },
    {
        key: 'json',
        name: 'JSON Data',
        description: 'Structured data for developers and integrations',
        icon: FileJson,
        extension: '.json',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
    },
    {
        key: 'txt',
        name: 'Plain Text',
        description: 'Simple text file with word list',
        icon: FileText,
        extension: '.txt',
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
    },
    {
        key: 'audio',
        name: 'Audio Package',
        description: 'ZIP file with MP3 pronunciations',
        icon: Music,
        extension: '.zip',
        color: 'text-purple-500',
        bgColor: 'bg-purple-50',
    },
];

/**
 * ExportModal component
 */
const ExportModal = memo(function ExportModal({
    isOpen,
    onClose,
    theme = 'qa_manager',
    wordIds = null,
    rankMin = null,
    rankMax = null,
}) {
    const [selectedFormat, setSelectedFormat] = useState('pdf');
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Export options
    const [options, setOptions] = useState({
        includeAudio: false,
        includeSentences: true,
        maxWords: 5050, // All words by default
    });

    // Reset state when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setError(null);
            setSuccess(false);
        }
    }, [isOpen]);

    // Handle export
    const handleExport = useCallback(async () => {
        setExporting(true);
        setError(null);
        setSuccess(false);

        try {
            // Build export request
            const request = {
                theme,
                word_ids: wordIds,
                rank_min: rankMin,
                rank_max: rankMax,
                limit: options.maxWords,
            };

            let blob;
            let filename;
            const format = EXPORT_FORMATS.find(f => f.key === selectedFormat);

            switch (selectedFormat) {
                case 'pdf':
                    blob = await exportApi.exportPdf({
                        ...request,
                        title: `Vocabulary - ${theme.replace('_', ' ')}`,
                    });
                    filename = `vocabulary_${theme}${format.extension}`;
                    break;

                case 'anki':
                    blob = await exportApi.exportAnki(request);
                    filename = `vocabulary_anki_${theme}${format.extension}`;
                    break;

                case 'json':
                    blob = await exportApi.exportJson(request, true);
                    filename = `vocabulary_${theme}${format.extension}`;
                    break;

                case 'txt':
                    blob = await exportApi.exportText(request);
                    filename = `vocabulary_${theme}${format.extension}`;
                    break;

                case 'audio':
                    blob = await exportApi.exportAudio(request);
                    filename = `vocabulary_audio_${theme}${format.extension}`;
                    break;

                default:
                    throw new Error('Unknown export format');
            }

            // Download the file
            downloadBlob(blob, filename);
            setSuccess(true);

            // Close after short delay
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (err) {
            setError(err.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    }, [selectedFormat, theme, wordIds, rankMin, rankMax, options, onClose]);

    // Don't render if not open
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Export Vocabulary
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Format selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Export Format
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {EXPORT_FORMATS.map(format => {
                                const Icon = format.icon;
                                const isSelected = selectedFormat === format.key;

                                return (
                                    <button
                                        key={format.key}
                                        onClick={() => setSelectedFormat(format.key)}
                                        className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${isSelected
                                            ? `border-primary-500 ${format.bgColor}`
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${format.bgColor}`}>
                                            <Icon className={`w-5 h-5 ${format.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900">
                                                {format.name}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                                {format.description}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Options */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Export Options
                        </label>
                        <div className="space-y-3">
                            {/* Max words slider */}
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Maximum Words</span>
                                    <span className="text-gray-900 font-medium">
                                        {options.maxWords >= 5050 ? 'All (5,050)' : options.maxWords.toLocaleString()}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={100}
                                    max={5050}
                                    step={50}
                                    value={options.maxWords}
                                    onChange={(e) => setOptions({ ...options, maxWords: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                />
                            </div>

                            {/* Include sentences checkbox */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={options.includeSentences}
                                    onChange={(e) => setOptions({ ...options, includeSentences: e.target.checked })}
                                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">Include example sentences</span>
                            </label>
                        </div>
                    </div>

                    {/* Export info */}
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                        <p>
                            Exporting {options.maxWords >= 5050 ? 'all 5,050' : options.maxWords.toLocaleString()} words for theme: <strong className="capitalize">{theme.replace('_', ' ')}</strong>
                        </p>
                        {rankMin && rankMax && (
                            <p className="mt-1">
                                Rank range: {rankMin} - {rankMax}
                            </p>
                        )}
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Success message */}
                    {success && (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
                            <Check className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">Export completed successfully!</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                        {exporting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Export
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ExportModal;
