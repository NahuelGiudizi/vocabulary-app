/**
 * useVirtualWords hook for windowed virtual scrolling.
 * 
 * Provides word data for virtual scroll where the scrollbar represents
 * the TOTAL dataset, but only visible data is loaded on-demand.
 * 
 * Key features:
 * - Scrollbar represents full dataset from the start
 * - Lazy loads only visible ranges
 * - Caches loaded data to avoid re-fetching
 * - Supports jumping to any position instantly
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { wordsApi } from '../services/api';

// How many items to load per request
const CHUNK_SIZE = 100;

// Buffer around visible area to preload
const BUFFER_SIZE = 20;

/**
 * Custom hook for virtual scrolling with lazy-loaded data
 */
export function useVirtualWords(initialParams = {}) {
    // Total count from server
    const [totalCount, setTotalCount] = useState(0);

    // Sparse data cache: Map<index, wordData>
    const [dataCache, setDataCache] = useState(new Map());

    // Track which chunks are loading/loaded
    const [loadingChunks, setLoadingChunks] = useState(new Set());
    const [loadedChunks, setLoadedChunks] = useState(new Set());

    // Loading states
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState(null);

    // Query parameters (excluding pagination)
    const [params, setParams] = useState({
        search: '',
        pos: null,
        rank_min: 1,
        rank_max: 5050,
        theme: 'qa_manager',
        has_sentences: null,
        sort_by: 'rank',
        ...initialParams,
    });

    // Track params version to invalidate cache on filter changes
    const paramsVersion = useRef(0);

    /**
     * Get chunk index for a given item index
     */
    const getChunkIndex = useCallback((itemIndex) => {
        return Math.floor(itemIndex / CHUNK_SIZE);
    }, []);

    /**
     * Fetch initial count and first chunk
     */
    const fetchInitial = useCallback(async () => {
        setInitialLoading(true);
        setError(null);
        setDataCache(new Map());
        setLoadedChunks(new Set());
        setLoadingChunks(new Set());
        paramsVersion.current += 1;
        const currentVersion = paramsVersion.current;

        try {
            // Fetch first page to get total count
            const queryParams = Object.fromEntries(
                Object.entries({
                    ...params,
                    page: 1,
                    per_page: CHUNK_SIZE,
                }).filter(([_, v]) => v != null && v !== '')
            );

            const response = await wordsApi.getWords(queryParams);

            // Check if params changed while loading
            if (paramsVersion.current !== currentVersion) return;

            setTotalCount(response.pagination?.total || 0);

            // Cache first chunk
            const newCache = new Map();
            (response.words || []).forEach((word, idx) => {
                newCache.set(idx, word);
            });
            setDataCache(newCache);
            setLoadedChunks(new Set([0]));
        } catch (err) {
            if (paramsVersion.current === currentVersion) {
                setError(err.message);
                setTotalCount(0);
            }
        } finally {
            if (paramsVersion.current === currentVersion) {
                setInitialLoading(false);
            }
        }
    }, [params]);

    // Fetch on params change
    useEffect(() => {
        fetchInitial();
    }, [fetchInitial]);

    /**
     * Load a specific chunk of data
     */
    const loadChunk = useCallback(async (chunkIndex) => {
        // Skip if already loading or loaded
        if (loadingChunks.has(chunkIndex) || loadedChunks.has(chunkIndex)) {
            return;
        }

        const currentVersion = paramsVersion.current;
        setLoadingChunks(prev => new Set([...prev, chunkIndex]));

        try {
            const page = chunkIndex + 1; // API uses 1-based pages
            const queryParams = Object.fromEntries(
                Object.entries({
                    ...params,
                    page,
                    per_page: CHUNK_SIZE,
                }).filter(([_, v]) => v != null && v !== '')
            );

            const response = await wordsApi.getWords(queryParams);

            // Check if params changed while loading
            if (paramsVersion.current !== currentVersion) return;

            // Add to cache
            setDataCache(prev => {
                const newCache = new Map(prev);
                const startIndex = chunkIndex * CHUNK_SIZE;
                (response.words || []).forEach((word, idx) => {
                    newCache.set(startIndex + idx, word);
                });
                return newCache;
            });

            setLoadedChunks(prev => new Set([...prev, chunkIndex]));
        } catch (err) {
            console.error(`Error loading chunk ${chunkIndex}:`, err);
        } finally {
            if (paramsVersion.current === currentVersion) {
                setLoadingChunks(prev => {
                    const next = new Set(prev);
                    next.delete(chunkIndex);
                    return next;
                });
            }
        }
    }, [params, loadingChunks, loadedChunks]);

    /**
     * Ensure data is loaded for a visible range
     */
    const ensureDataForRange = useCallback((startIndex, endIndex) => {
        // Add buffer
        const bufferedStart = Math.max(0, startIndex - BUFFER_SIZE);
        const bufferedEnd = Math.min(totalCount - 1, endIndex + BUFFER_SIZE);

        // Find which chunks we need
        const startChunk = getChunkIndex(bufferedStart);
        const endChunk = getChunkIndex(bufferedEnd);

        // Load missing chunks
        for (let chunk = startChunk; chunk <= endChunk; chunk++) {
            if (!loadedChunks.has(chunk) && !loadingChunks.has(chunk)) {
                loadChunk(chunk);
            }
        }
    }, [totalCount, getChunkIndex, loadedChunks, loadingChunks, loadChunk]);

    /**
     * Get word data for a specific index (may be undefined if not loaded)
     */
    const getWordAtIndex = useCallback((index) => {
        return dataCache.get(index);
    }, [dataCache]);

    /**
     * Check if a specific index has data loaded
     */
    const isIndexLoaded = useCallback((index) => {
        return dataCache.has(index);
    }, [dataCache]);

    /**
     * Check if a specific index is loading
     */
    const isIndexLoading = useCallback((index) => {
        const chunkIndex = getChunkIndex(index);
        return loadingChunks.has(chunkIndex);
    }, [getChunkIndex, loadingChunks]);

    /**
     * Get placeholder data for scroll indicator when real data not loaded
     * Based on sort order, we can estimate what will be there
     */
    const getPlaceholderForIndex = useCallback((index) => {
        if (params.sort_by === 'rank') {
            // For rank sort, index roughly equals rank-1
            return {
                rank: index + 1,
                lemma: null,
            };
        } else if (params.sort_by === 'alpha') {
            // For alpha sort, we can estimate letter based on distribution
            // This is a rough estimate - in practice we'd need letter distribution from server
            return {
                rank: null,
                lemma: null,
                estimatedLetter: getEstimatedLetter(index, totalCount),
            };
        }
        return { rank: null, lemma: null };
    }, [params.sort_by, totalCount]);

    // Filter update functions
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
            has_sentences: null,
            sort_by: 'rank',
        }));
    }, []);

    const refresh = useCallback(() => {
        fetchInitial();
    }, [fetchInitial]);

    // Computed values
    const loadedCount = dataCache.size;
    const isLoading = loadingChunks.size > 0;
    const hasFilters = params.search || params.pos ||
        params.rank_min !== 1 || params.rank_max !== 5050 ||
        params.sort_by !== 'rank';

    return {
        // Data access
        totalCount,
        getWordAtIndex,
        isIndexLoaded,
        isIndexLoading,
        getPlaceholderForIndex,
        ensureDataForRange,

        // Loading states
        initialLoading,
        isLoading,
        loadedCount,
        error,

        // Parameters
        params,

        // Actions
        setSearch,
        setPos,
        setTheme,
        setRankRange,
        setSortBy,
        resetFilters,
        refresh,

        // Computed
        isEmpty: !initialLoading && totalCount === 0,
        hasFilters,
    };
}

/**
 * Estimate letter for a given index in alphabetically sorted list.
 * This is a rough approximation based on typical English word distribution.
 */
function getEstimatedLetter(index, total) {
    if (total === 0) return 'A';

    // Rough distribution of English words by first letter
    // This is approximate - in practice we'd get this from the server
    const letterDistribution = [
        ['A', 0.00], ['B', 0.06], ['C', 0.12], ['D', 0.18],
        ['E', 0.22], ['F', 0.26], ['G', 0.30], ['H', 0.34],
        ['I', 0.38], ['J', 0.40], ['K', 0.41], ['L', 0.43],
        ['M', 0.48], ['N', 0.52], ['O', 0.55], ['P', 0.58],
        ['Q', 0.64], ['R', 0.65], ['S', 0.70], ['T', 0.78],
        ['U', 0.82], ['V', 0.84], ['W', 0.86], ['X', 0.90],
        ['Y', 0.91], ['Z', 0.93]
    ];

    const ratio = index / total;
    for (let i = letterDistribution.length - 1; i >= 0; i--) {
        if (ratio >= letterDistribution[i][1]) {
            return letterDistribution[i][0];
        }
    }
    return 'A';
}

export default useVirtualWords;
