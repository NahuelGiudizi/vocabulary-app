/**
 * useWords hook for managing word data and pagination.
 * 
 * Provides word list management with search, filtering, and infinite scroll pagination.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { wordsApi } from '../services/api';

// Page size for infinite scroll
const PAGE_SIZE = 50;

/**
 * Custom hook for managing vocabulary words with infinite scroll
 * @param {Object} initialParams - Initial query parameters
 * @returns {Object} Words state and actions
 */
export function useWords(initialParams = {}) {
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        per_page: PAGE_SIZE,
        total: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
    });

    const [params, setParams] = useState({
        page: 1,
        per_page: PAGE_SIZE,
        search: '',
        pos: null,
        rank_min: 1,
        rank_max: 5050,
        theme: 'qa_manager',
        has_sentences: null,
        sort_by: 'rank', // rank, alpha, alpha_desc
        ...initialParams,
    });

    // Track if this is a fresh load vs loading more
    const isLoadingMoreRef = useRef(false);

    /**
     * Fetch words from API
     */
    const fetchWords = useCallback(async (append = false) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            // Filter out null/undefined params
            const queryParams = Object.fromEntries(
                Object.entries(params).filter(([_, v]) => v != null && v !== '')
            );

            const response = await wordsApi.getWords(queryParams);

            if (append) {
                // Append new words to existing list
                setWords(prev => [...prev, ...(response.words || [])]);
            } else {
                // Replace word list
                setWords(response.words || []);
            }
            setPagination(response.pagination || {});
        } catch (err) {
            setError(err.message);
            if (!append) {
                setWords([]);
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [params]);

    // Fetch on params change (but not page changes for infinite scroll)
    useEffect(() => {
        if (isLoadingMoreRef.current) {
            // This is a "load more" operation
            fetchWords(true);
            isLoadingMoreRef.current = false;
        } else {
            // This is a fresh search/filter
            fetchWords(false);
        }
    }, [fetchWords]);

    /**
     * Load more words (infinite scroll)
     */
    const loadMore = useCallback(() => {
        if (pagination.has_next && !loading && !loadingMore) {
            isLoadingMoreRef.current = true;
            setParams(prev => ({ ...prev, page: prev.page + 1 }));
        }
    }, [pagination.has_next, loading, loadingMore]);

    /**
     * Update search term with debouncing
     */
    const setSearch = useCallback((search) => {
        setParams((prev) => ({ ...prev, search, page: 1 }));
    }, []);

    /**
     * Update POS filter
     */
    const setPos = useCallback((pos) => {
        setParams((prev) => ({ ...prev, pos, page: 1 }));
    }, []);

    /**
     * Update theme
     */
    const setTheme = useCallback((theme) => {
        setParams((prev) => ({ ...prev, theme, page: 1 }));
    }, []);

    /**
     * Update rank range
     */
    const setRankRange = useCallback((rankMin, rankMax) => {
        setParams((prev) => ({
            ...prev,
            rank_min: rankMin,
            rank_max: rankMax,
            page: 1
        }));
    }, []);

    /**
     * Update sort order
     */
    const setSortBy = useCallback((sortBy) => {
        setParams((prev) => ({ ...prev, sort_by: sortBy, page: 1 }));
    }, []);

    /**
     * Go to specific page
     */
    const goToPage = useCallback((page) => {
        setParams((prev) => ({ ...prev, page }));
    }, []);

    /**
     * Go to next page
     */
    const nextPage = useCallback(() => {
        if (pagination.has_next) {
            goToPage(pagination.page + 1);
        }
    }, [pagination, goToPage]);

    /**
     * Go to previous page
     */
    const prevPage = useCallback(() => {
        if (pagination.has_prev) {
            goToPage(pagination.page - 1);
        }
    }, [pagination, goToPage]);

    /**
     * Reset all filters
     */
    const resetFilters = useCallback(() => {
        setParams({
            page: 1,
            per_page: PAGE_SIZE,
            search: '',
            pos: null,
            rank_min: 1,
            rank_max: 5050,
            theme: params.theme,
            has_sentences: null,
            sort_by: 'rank',
        });
    }, [params.theme]);

    /**
     * Refresh current data
     */
    const refresh = useCallback(() => {
        // Reset to page 1 and fetch fresh data
        setParams(prev => ({ ...prev, page: 1 }));
    }, []);

    return {
        // State
        words,
        loading,
        loadingMore,
        error,
        pagination,
        params,

        // Actions
        setSearch,
        setPos,
        setTheme,
        setRankRange,
        setSortBy,
        goToPage,
        nextPage,
        prevPage,
        resetFilters,
        refresh,
        loadMore,

        // Computed
        isEmpty: !loading && words.length === 0,
        hasFilters: params.search || params.pos || params.rank_min !== 1 || params.rank_max !== 5050 || params.sort_by !== 'rank',
        hasMore: pagination.has_next,
    };
}

/**
 * Hook for fetching a single word
 * @param {number} wordId - Word ID
 * @param {string} theme - Theme for sentences
 * @returns {Object} Word data and loading state
 */
export function useWord(wordId, theme = null) {
    const [word, setWord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!wordId) {
            setWord(null);
            setLoading(false);
            return;
        }

        const fetchWord = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await wordsApi.getWord(wordId, theme);
                setWord(data);
            } catch (err) {
                setError(err.message);
                setWord(null);
            } finally {
                setLoading(false);
            }
        };

        fetchWord();
    }, [wordId, theme]);

    return { word, loading, error };
}

/**
 * Hook for vocabulary statistics
 * @param {string} theme - Theme filter
 * @returns {Object} Stats data
 */
export function useStats(theme = null) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await wordsApi.getStats(theme);
            setStats(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [theme]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, error, refresh: fetchStats };
}

export default useWords;
