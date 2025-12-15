/**
 * WordCard Component
 * 
 * Displays a vocabulary word with its details and example sentences.
 * Supports TTS playback and generation of new sentences.
 */

import React, { useState, useCallback, memo } from 'react';
import {
    Volume2,
    VolumeX,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    BookOpen,
    TrendingUp,
    Hash,
    ExternalLink
} from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import { generationApi, openYouGlish, extractWordContext, getYouGlishAccent } from '../services/api';

// POS badge colors mapping (matches index.css)
const POS_COLORS = {
    n: 'pos-n',
    v: 'pos-v',
    j: 'pos-j',
    r: 'pos-r',
    i: 'pos-i',
    p: 'pos-p',
    a: 'pos-a',
    d: 'pos-d',
    c: 'pos-c',
    u: 'pos-u',
    e: 'pos-e',
    m: 'pos-m',
    t: 'pos-t',
    y: 'pos-y',
    x: 'pos-x',
};

// POS full names
const POS_NAMES = {
    n: 'Noun',
    v: 'Verb',
    j: 'Adjective',
    r: 'Adverb',
    i: 'Preposition',
    p: 'Pronoun',
    a: 'Article',
    d: 'Determiner',
    c: 'Conjunction',
    u: 'Interjection',
    e: 'Existential',
    m: 'Modal',
    t: 'Infinitive',
    y: 'Contraction',
    x: 'Negation',
};

/**
 * Format large numbers with commas
 */
const formatNumber = (num) => {
    if (num == null) return '—';
    return num.toLocaleString();
};

/**
 * WordCard component for displaying vocabulary words
 */
const WordCard = memo(function WordCard({
    word,
    theme = 'qa_manager',
    onGenerateSentences,
    style,
    className = '',
}) {
    const [expanded, setExpanded] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generationError, setGenerationError] = useState(null);

    const audio = useAudio();

    // Handle word pronunciation
    const handlePlayWord = useCallback(() => {
        if (audio.isPlayingText(word.lemma)) {
            audio.stop();
        } else {
            audio.playText(word.lemma);
        }
    }, [audio, word.lemma]);

    // Handle sentence pronunciation
    const handlePlaySentence = useCallback((sentenceText) => {
        if (audio.isPlayingText(sentenceText)) {
            audio.stop();
        } else {
            audio.playText(sentenceText);
        }
    }, [audio]);

    // Handle sentence generation
    const handleGenerate = useCallback(async () => {
        if (generating) return;

        setGenerating(true);
        setGenerationError(null);

        try {
            await generationApi.generateSingle(word.id, theme, 3);

            // Notify parent to refresh
            if (onGenerateSentences) {
                onGenerateSentences(word.id);
            }
        } catch (err) {
            setGenerationError(err.message);
        } finally {
            setGenerating(false);
        }
    }, [word.id, theme, generating, onGenerateSentences]);

    // Get sentences for current theme
    const sentences = word.sentences?.filter(s => s.theme === theme) || [];
    const hasSentences = sentences.length > 0;

    // Complexity level based on rank
    const getComplexity = (rank) => {
        if (rank <= 1000) return { level: 'Basic', color: 'text-green-600', bg: 'bg-green-100' };
        if (rank <= 3000) return { level: 'Intermediate', color: 'text-yellow-600', bg: 'bg-yellow-100' };
        return { level: 'Advanced', color: 'text-red-600', bg: 'bg-red-100' };
    };

    const complexity = getComplexity(word.rank);
    const posClass = POS_COLORS[word.pos?.toLowerCase()] || 'pos-n';
    const posName = POS_NAMES[word.pos?.toLowerCase()] || word.pos;

    return (
        <div
            className={`word-card bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all duration-200 ${className}`}
            style={style}
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    {/* Word and pronunciation */}
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-semibold text-gray-900">
                            {word.lemma}
                        </h3>

                        <button
                            onClick={handlePlayWord}
                            disabled={audio.loading}
                            className="p-2 rounded-full hover:bg-primary-50 text-primary-600 transition-colors disabled:opacity-50"
                            title="Play pronunciation (Edge TTS)"
                        >
                            {audio.isPlayingText(word.lemma) ? (
                                <VolumeX className="w-5 h-5" />
                            ) : (
                                <Volume2 className="w-5 h-5" />
                            )}
                        </button>

                        {/* YouGlish button */}
                        <button
                            onClick={() => openYouGlish(word.lemma, getYouGlishAccent())}
                            className="p-2 rounded-full hover:bg-amber-50 text-amber-600 transition-colors"
                            title="Hear in real videos (YouGlish)"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </button>

                        {/* POS Badge */}
                        <span className={`pos-badge ${posClass} px-2 py-1 rounded-full text-xs font-medium uppercase`}>
                            {posName}
                        </span>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <Hash className="w-4 h-4" />
                            Rank {formatNumber(word.rank)}
                        </span>
                        <span className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            {formatNumber(word.freq)} uses
                        </span>
                        <span className={`px-2 py-0.5 rounded ${complexity.bg} ${complexity.color} text-xs font-medium`}>
                            {complexity.level}
                        </span>
                    </div>
                </div>

                {/* Expand/Collapse */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                >
                    {expanded ? (
                        <ChevronUp className="w-5 h-5" />
                    ) : (
                        <ChevronDown className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Sentences Section */}
            <div className="mt-4">
                {hasSentences ? (
                    <div className="space-y-3">
                        {/* Show first sentence always, rest when expanded */}
                        {sentences.slice(0, expanded ? undefined : 1).map((sentence, idx) => {
                            const sentenceText = sentence.text || sentence.sentence_text;
                            return (
                                <div
                                    key={sentence.id || idx}
                                    className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex-shrink-0 flex gap-1">
                                        <button
                                            onClick={() => handlePlaySentence(sentenceText)}
                                            disabled={audio.loading}
                                            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-50"
                                            title="Play sentence (Edge TTS)"
                                        >
                                            {audio.isPlayingText(sentenceText) ? (
                                                <VolumeX className="w-4 h-4" />
                                            ) : (
                                                <Volume2 className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => openYouGlish(extractWordContext(sentenceText, word.lemma), getYouGlishAccent())}
                                            className="p-1.5 rounded-full hover:bg-amber-100 text-amber-600 transition-colors"
                                            title={`Search YouGlish: "${extractWordContext(sentenceText, word.lemma)}"`}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-gray-700 leading-relaxed flex-1">
                                        {highlightWord(sentenceText, word.lemma)}
                                    </p>
                                </div>
                            )
                        })}

                        {/* Show more indicator */}
                        {!expanded && sentences.length > 1 && (
                            <button
                                onClick={() => setExpanded(true)}
                                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                            >
                                <BookOpen className="w-4 h-4" />
                                Show {sentences.length - 1} more example{sentences.length > 2 ? 's' : ''}
                            </button>
                        )}
                    </div>
                ) : (
                    /* No sentences - show generate button */
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-gray-500 mb-3">No example sentences yet</p>
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                            {generating ? 'Generating...' : 'Generate Examples'}
                        </button>
                        {generationError && (
                            <p className="text-red-500 text-sm mt-2">{generationError}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    {/* Genre distribution */}
                    <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Usage Distribution</h4>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                            {word.genres && Object.entries(word.genres).map(([genre, data]) => (
                                <div key={genre} className="text-center p-2 bg-gray-50 rounded">
                                    <div className="font-medium text-gray-600 capitalize">{genre}</div>
                                    <div className="text-gray-900">{formatNumber(data.count || data)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Regenerate button */}
                    {hasSentences && (
                        <div className="flex justify-end">
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                                {generating ? 'Generating...' : 'Regenerate Examples'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

/**
 * Highlight the target word in a sentence
 * Handles special cases like contractions (n't, 's, 'll, etc.)
 * @param {string} text - Sentence text
 * @param {string} word - Word to highlight
 * @returns {React.ReactNode} Highlighted text
 */
function highlightWord(text, word) {
    if (!text || !word) return text;

    // Special handling for contraction suffixes like "n't"
    const isNegationContraction = word.toLowerCase() === "n't" || word.toLowerCase() === "nt";

    let regex;
    if (isNegationContraction) {
        // Match common negative contractions: don't, can't, won't, shouldn't, isn't, aren't, etc.
        regex = /\b(don't|can't|won't|shouldn't|couldn't|wouldn't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|didn't|mustn't|needn't|shan't|daren't|mightn't)\b/gi;
    } else {
        // Normal word matching
        regex = new RegExp(`\\b(${word}\\w*)\\b`, 'gi');
    }

    const parts = text.split(regex);

    return parts.map((part, i) => {
        const isMatch = isNegationContraction 
            ? /^(don't|can't|won't|shouldn't|couldn't|wouldn't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|didn't|mustn't|needn't|shan't|daren't|mightn't)$/i.test(part)
            : part.toLowerCase().startsWith(word.toLowerCase());
        
        if (isMatch) {
            return (
                <strong key={i} className="text-primary-600 font-semibold">
                    {part}
                </strong>
            );
        }
        return part;
    });
}

export default WordCard;
