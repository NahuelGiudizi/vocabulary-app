/**
 * WordCard Component - Static/Production Version
 * 
 * Displays vocabulary word without generation capabilities.
 * Uses Cloudflare Worker for TTS.
 */

import React, { useState, useCallback, memo } from 'react';
import {
    Volume2,
    VolumeX,
    ChevronDown,
    ChevronUp,
    TrendingUp,
    Hash,
    ExternalLink,
    Loader2
} from 'lucide-react';
import { useStaticAudio } from '../hooks/useStaticAudio';

// POS badge colors
const POS_COLORS = {
    n: 'bg-blue-100 text-blue-700',
    v: 'bg-emerald-100 text-emerald-700',
    j: 'bg-green-100 text-green-700',
    r: 'bg-yellow-100 text-yellow-700',
    i: 'bg-cyan-100 text-cyan-700',
    p: 'bg-indigo-100 text-indigo-700',
    a: 'bg-gray-100 text-gray-700',
    d: 'bg-pink-100 text-pink-700',
    c: 'bg-purple-100 text-purple-700',
    u: 'bg-red-100 text-red-700',
    x: 'bg-rose-100 text-rose-700',
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
    x: 'Negation',
};

/**
 * Format large numbers
 */
const formatNumber = (num) => {
    if (num == null) return '—';
    return num.toLocaleString();
};

/**
 * Open YouGlish with word context
 */
function openYouGlish(word, accent = 'us') {
    const url = `https://youglish.com/pronounce/${encodeURIComponent(word)}/english/${accent}`;
    window.open(url, '_blank');
}

/**
 * Highlight the target word in a sentence
 */
function highlightWord(sentence, word) {
    if (!sentence || !word) return sentence;

    const lemma = word.toLowerCase();

    // Handle contractions
    const contractions = ["don't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't",
        "hasn't", "haven't", "hadn't", "doesn't", "didn't", "wouldn't",
        "couldn't", "shouldn't", "mustn't", "shan't", "needn't"];

    if (lemma === "n't") {
        for (const contraction of contractions) {
            const regex = new RegExp(`\\b(${contraction})\\b`, 'gi');
            if (regex.test(sentence)) {
                return sentence.replace(regex, '<mark class="bg-primary-100 text-primary-800 px-0.5 rounded">$1</mark>');
            }
        }
        return sentence;
    }

    const regex = new RegExp(`\\b(${lemma}(?:s|es|ed|ing|er|est|ly)?)\\b`, 'gi');
    return sentence.replace(regex, '<mark class="bg-blue-100 text-blue-800 px-0.5 rounded">$1</mark>');
}

/**
 * WordCard component
 */
const WordCardStatic = memo(function WordCardStatic({ word }) {
    const [expanded, setExpanded] = useState(false);
    const audio = useStaticAudio();

    // Handle word pronunciation
    const handlePlayWord = useCallback(() => {
        if (audio.isPlaying) {
            audio.stop();
        } else {
            audio.playWord(word);
        }
    }, [audio, word]);

    // Handle sentence pronunciation
    const handlePlaySentence = useCallback((text) => {
        if (audio.isPlaying) {
            audio.stop();
        } else {
            audio.playSentence(text);
        }
    }, [audio]);

    const sentences = word.sentences || [];
    const hasSentences = sentences.length > 0;
    const displaySentences = expanded ? sentences : sentences.slice(0, 1);
    const hiddenCount = sentences.length - 1;

    // Complexity level
    const getComplexity = (rank) => {
        if (rank <= 1000) return { level: 'Basic', color: 'text-green-600', bg: 'bg-green-100' };
        if (rank <= 3000) return { level: 'Intermediate', color: 'text-yellow-600', bg: 'bg-yellow-100' };
        return { level: 'Advanced', color: 'text-red-600', bg: 'bg-red-100' };
    };

    const complexity = getComplexity(word.rank);
    const posColor = POS_COLORS[word.pos] || 'bg-gray-100 text-gray-700';
    const posName = POS_NAMES[word.pos] || word.pos?.toUpperCase();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    {/* Word and controls */}
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-semibold text-gray-900">
                            {word.lemma}
                        </h3>

                        <button
                            onClick={handlePlayWord}
                            disabled={audio.isLoading}
                            className="p-2 rounded-full hover:bg-blue-50 text-blue-600 transition-colors disabled:opacity-50"
                            title="Play pronunciation"
                        >
                            {audio.isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : audio.isPlaying ? (
                                <VolumeX className="w-5 h-5" />
                            ) : (
                                <Volume2 className="w-5 h-5" />
                            )}
                        </button>

                        <button
                            onClick={() => openYouGlish(word.lemma)}
                            className="p-2 rounded-full hover:bg-amber-50 text-amber-600 transition-colors"
                            title="Hear in real videos (YouGlish)"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </button>

                        <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${posColor}`}>
                            {posName}
                        </span>
                    </div>

                    {/* Meta */}
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

                {/* Expand button */}
                {hiddenCount > 0 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                    >
                        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                )}
            </div>

            {/* Sentences */}
            {hasSentences && (
                <div className="mt-4 space-y-3">
                    {displaySentences.map((sentence, idx) => (
                        <div
                            key={sentence.id || idx}
                            className="bg-gray-50 rounded-lg p-3"
                        >
                            <div className="flex items-start gap-2">
                                <button
                                    onClick={() => handlePlaySentence(sentence.text)}
                                    className="mt-0.5 p-1.5 rounded-full hover:bg-blue-100 text-blue-600 transition-colors flex-shrink-0"
                                    title="Play sentence"
                                >
                                    <Volume2 className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => openYouGlish(sentence.text?.split(' ').slice(0, 5).join(' '))}
                                    className="mt-0.5 p-1.5 rounded-full hover:bg-amber-100 text-amber-600 transition-colors flex-shrink-0"
                                    title="Search on YouGlish"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </button>

                                <p
                                    className="text-gray-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: highlightWord(sentence.text, word.lemma)
                                    }}
                                />
                            </div>
                        </div>
                    ))}

                    {!expanded && hiddenCount > 0 && (
                        <button
                            onClick={() => setExpanded(true)}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                            Show {hiddenCount} more example{hiddenCount > 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            )}

            {/* No sentences message */}
            {!hasSentences && (
                <div className="mt-4 text-center py-4 text-gray-400">
                    No example sentences available
                </div>
            )}
        </div>
    );
});

export default WordCardStatic;
