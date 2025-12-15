/**
 * useStaticWords hook for loading words from static JSON files.
 * 
 * Used in production mode (GitHub Pages) where there's no backend.
 * Loads all data upfront and provides filtering/pagination in-memory.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// Configuration
const DATA_URL = import.meta.env.BASE_URL + 'data/words.json';

/**
 * Custom hook for loading and filtering static word data
 */
export function useStaticWords(initialParams = {}) {
    // All words loaded from JSON
    const [allWords, setAllWords] = useState([]);
    const [meta, setMeta] = useState(null);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter parameters
    const [params, setParams] = useState({
        search: '',
        pos: null,
        rank_min: 1,
        rank_max: 5050,
        theme: null,
        sort_by: 'rank',
        ...initialParams,
    });

    // Load data on mount
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(DATA_URL);
                if (!response.ok) {
                    throw new Error(`Failed to load words: ${response.status}`);
                }

                const data = await response.json();
                setAllWords(data.words || []);
                setMeta(data.meta || null);
            } catch (err) {
                console.error('Error loading words:', err);
                setError(err.message);
                setAllWords([]);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Filter and sort words based on params
    const filteredWords = useMemo(() => {
        let result = [...allWords];

        // Search filter
        if (params.search) {
            const searchLower = params.search.toLowerCase();
            result = result.filter(w =>
                w.lemma.toLowerCase().includes(searchLower)
            );
        }

        // POS filter
        if (params.pos) {
            result = result.filter(w => w.pos === params.pos);
        }

        // Rank range filter
        result = result.filter(w =>
            w.rank >= params.rank_min && w.rank <= params.rank_max
        );

        // Theme filter for sentences
        if (params.theme) {
            result = result.map(w => ({
                ...w,
                sentences: (w.sentences || []).filter(s => s.theme === params.theme)
            }));
        }

        // Sort
        switch (params.sort_by) {
            case 'alpha':
                result.sort((a, b) => a.lemma.localeCompare(b.lemma));
                break;
            case 'alpha_desc':
                result.sort((a, b) => b.lemma.localeCompare(a.lemma));
                break;
            case 'rank':
            default:
                result.sort((a, b) => a.rank - b.rank);
                break;
        }

        return result;
    }, [allWords, params]);

    // Virtual scroll support
    const totalCount = filteredWords.length;

    const getWordAtIndex = useCallback((index) => {
        return filteredWords[index];
    }, [filteredWords]);

    const isIndexLoaded = useCallback((index) => {
        return index >= 0 && index < filteredWords.length;
    }, [filteredWords]);

    const isIndexLoading = useCallback(() => false, []);

    const ensureDataForRange = useCallback(() => {
        // No-op for static data - everything is already loaded
    }, []);

    // Filter setters
    const setSearch = useCallback((search) => {
        setParams(prev => ({ ...prev, search }));
    }, []);

    const setPos = useCallback((pos) => {
        setParams(prev => ({ ...prev, pos }));
    }, []);

    const setTheme = useCallback((theme) => {
        setParams(prev => ({ ...prev, theme }));
    }, []);

    const setRankRange = useCallback((rankMin, rankMax) => {
        setParams(prev => ({ ...prev, rank_min: rankMin, rank_max: rankMax }));
    }, []);

    const setSortBy = useCallback((sortBy) => {
        setParams(prev => ({ ...prev, sort_by: sortBy }));
    }, []);

    const resetFilters = useCallback(() => {
        setParams(prev => ({
            search: '',
            pos: null,
            rank_min: 1,
            rank_max: 5050,
            theme: prev.theme,
            sort_by: 'rank',
        }));
    }, []);

    const refresh = useCallback(() => {
        // For static data, just trigger a re-render
    }, []);

    // Stats from metadata
    const stats = useMemo(() => {
        if (!meta) return null;
        return {
            total_words: meta.total_words,
            words_generated: meta.words_with_sentences,
            total_sentences: meta.total_sentences,
        };
    }, [meta]);

    // Computed
    const isEmpty = !loading && filteredWords.length === 0;
    const hasFilters = params.search || params.pos ||
        params.rank_min !== 1 || params.rank_max !== 5050 ||
        params.sort_by !== 'rank';

    return {
        // Data access (virtual scroll compatible)
        totalCount,
        getWordAtIndex,
        isIndexLoaded,
        isIndexLoading,
        ensureDataForRange,

        // Loading states
        initialLoading: loading,
        isLoading: false,
        loadedCount: filteredWords.length,
        error,

        // Parameters
        params,

        // Stats
        stats,

        // Actions
        setSearch,
        setPos,
        setTheme,
        setRankRange,
        setSortBy,
        resetFilters,
        refresh,

        // Computed
        isEmpty,
        hasFilters,
    };
}

export default useStaticWords;
