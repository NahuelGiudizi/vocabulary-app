/**
 * VirtualWordList Component (v2)
 * 
 * Windowed virtual scroll where scrollbar represents the FULL dataset.
 * Only loads visible data on-demand with skeleton placeholders.
 * Includes scroll thumb preview showing current position.
 */

import React, { useRef, useCallback, memo, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';

// Detect static mode and use appropriate WordCard
const IS_STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';

// Dynamic import for WordCard based on mode
const WordCard = IS_STATIC_MODE
    ? React.lazy(() => import('./WordCardStatic'))
    : React.lazy(() => import('./WordCard'));

/**
 * Get scroll indicator text based on sort type and index/word data
 */
function getScrollIndicatorText(index, word, sortBy, totalCount) {
    // If we have the actual word data, use it
    if (word?.rank) {
        const rank = word.rank;
        switch (sortBy) {
            case 'alpha':
            case 'alpha_desc':
                return {
                    main: word.lemma?.charAt(0).toUpperCase() || '?',
                    sub: `#${rank} ${word.lemma || ''}`,
                };
            case 'rank':
            default:
                const rangeStart = Math.floor((rank - 1) / 100) * 100 + 1;
                const rangeEnd = rangeStart + 99;
                return {
                    main: `#${rangeStart}-${rangeEnd}`,
                    sub: `#${rank} ${word.lemma || ''}`,
                };
        }
    }

    // Fallback: estimate based on index
    if (sortBy === 'rank') {
        const estimatedRank = index + 1;
        const rangeStart = Math.floor(index / 100) * 100 + 1;
        const rangeEnd = rangeStart + 99;
        return {
            main: `#${rangeStart}-${rangeEnd}`,
            sub: `~#${estimatedRank}`,
        };
    } else {
        // For alpha sort, estimate letter
        const letter = getEstimatedLetter(index, totalCount);
        return {
            main: letter,
            sub: `Loading...`,
        };
    }
}

/**
 * Estimate letter for alphabetical sort based on position
 */
function getEstimatedLetter(index, total) {
    if (total === 0) return '?';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letterIndex = Math.floor((index / total) * 26);
    return letters[Math.min(letterIndex, 25)];
}

/**
 * Scroll Indicator Component
 */
const ScrollIndicator = memo(function ScrollIndicator({
    visible,
    text,
    subtext,
    top,
}) {
    if (!visible || !text) return null;

    return (
        <div
            className="sticky z-50 pointer-events-none transition-opacity duration-150"
            style={{
                top: `${top}px`,
                height: 0,
                width: '100%',
                opacity: visible ? 1 : 0,
            }}
        >
            <div
                className="flex items-center justify-end"
                style={{
                    transform: 'translateY(-50%)',
                    paddingRight: '8px',
                }}
            >
                <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                    <div className="text-lg font-bold leading-tight">{text}</div>
                    {subtext && (
                        <div className="text-xs text-gray-300 leading-tight">{subtext}</div>
                    )}
                </div>
                <div
                    style={{
                        width: 0,
                        height: 0,
                        borderTop: '6px solid transparent',
                        borderBottom: '6px solid transparent',
                        borderLeft: '6px solid rgb(17, 24, 39)',
                    }}
                />
            </div>
        </div>
    );
});

/**
 * Skeleton placeholder for unloaded words
 */
const WordCardSkeleton = memo(function WordCardSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-24 bg-gray-200 rounded"></div>
                    <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
                    <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                </div>
            </div>
            <div className="flex items-center gap-4 text-sm mb-4">
                <div className="h-4 w-16 bg-gray-200 rounded"></div>
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                <div className="h-5 w-14 bg-gray-200 rounded-full"></div>
            </div>
            <div className="space-y-3">
                <div className="h-4 w-full bg-gray-100 rounded"></div>
                <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
            </div>
        </div>
    );
});

/**
 * Virtualized word list with full-dataset scrollbar
 */
const VirtualWordList = memo(function VirtualWordList({
    totalCount,
    getWordAtIndex,
    isIndexLoaded,
    isIndexLoading,
    ensureDataForRange,
    loadedCount,
    isLoading,
    initialLoading,
    theme,
    onGenerateSentences,
    sortBy = 'rank',
}) {
    const parentRef = useRef(null);
    const [scrollIndicator, setScrollIndicator] = useState({
        visible: false,
        text: '',
        subtext: '',
        top: 0,
    });
    const scrollTimeoutRef = useRef(null);
    const lastRangeRef = useRef({ start: 0, end: 0 });

    // Estimate row height (fallback)
    const estimateSize = useCallback(() => 280, []);

    // Variable size support
    const virtualizer = useVirtualizer({
        count: totalCount, // Full dataset count!
        getScrollElement: () => parentRef.current,
        estimateSize,
        overscan: 5,
        // Medir altura real de cada elemento
        measureElement: (el) => el.getBoundingClientRect().height,
    });

    const items = virtualizer.getVirtualItems();

    // Load data for visible range when it changes
    useEffect(() => {
        if (items.length === 0 || totalCount === 0) return;

        const startIndex = items[0]?.index ?? 0;
        const endIndex = items[items.length - 1]?.index ?? 0;

        // Only load if range actually changed
        if (startIndex !== lastRangeRef.current.start ||
            endIndex !== lastRangeRef.current.end) {
            lastRangeRef.current = { start: startIndex, end: endIndex };
            ensureDataForRange(startIndex, endIndex);
        }
    }, [items, totalCount, ensureDataForRange]);

    // Update scroll indicator
    const updateScrollIndicator = useCallback((scrollTop, clientHeight) => {
        if (totalCount === 0) return;

        const scrollElement = parentRef.current;
        if (!scrollElement) return;

        // Calculate which index is in the middle of the viewport
        const scrollableHeight = scrollElement.scrollHeight - clientHeight;
        const scrollRatio = scrollTop / Math.max(1, scrollableHeight);
        const middleIndex = Math.floor(scrollRatio * (totalCount - 1));

        // Get word data if available, otherwise use placeholder
        const word = getWordAtIndex(middleIndex);
        const indicator = getScrollIndicatorText(middleIndex, word, sortBy, totalCount);

        // Position indicator
        const indicatorY = 40 + (clientHeight - 100) * scrollRatio;

        setScrollIndicator({
            visible: true,
            text: indicator.main,
            subtext: indicator.sub,
            top: indicatorY,
        });
    }, [totalCount, getWordAtIndex, sortBy]);

    // Handle scroll
    const handleScroll = useCallback((e) => {
        const { scrollTop, clientHeight } = e.target;

        updateScrollIndicator(scrollTop, clientHeight);

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            setScrollIndicator(prev => ({ ...prev, visible: false }));
        }, 800);
    }, [updateScrollIndicator]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // Initial loading state
    if (initialLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-gray-500">Loading words...</p>
            </div>
        );
    }

    // Empty state
    if (totalCount === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                No words found matching your filters.
            </div>
        );
    }

    return (
        <div className="flex flex-col" style={{ height: '100%' }}>
            {/* Results count */}
            <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-sm text-gray-600">
                    <span className="font-medium">{totalCount.toLocaleString()}</span> words
                    {loadedCount < totalCount && (
                        <span className="text-gray-400 ml-2">
                            ({loadedCount.toLocaleString()} loaded)
                        </span>
                    )}
                </p>
                {isLoading && (
                    <span className="flex items-center text-xs text-gray-400">
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        Loading...
                    </span>
                )}
            </div>

            {/* Virtualized list container */}
            <div
                ref={parentRef}
                onScroll={handleScroll}
                className="overflow-auto relative"
                style={{ 
                    height: 'calc(100vh - 180px)',
                    minHeight: '200px',
                    maxHeight: '100%',
                }}
            >
                {/* Scroll Indicator */}
                <ScrollIndicator
                    visible={scrollIndicator.visible}
                    text={scrollIndicator.text}
                    subtext={scrollIndicator.subtext}
                    top={scrollIndicator.top}
                />

                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {items.map((virtualRow) => {
                        const word = getWordAtIndex(virtualRow.index);
                        const loaded = isIndexLoaded(virtualRow.index);
                        const loading = isIndexLoading(virtualRow.index);

                        return (
                            <div
                                key={virtualRow.index}
                                data-index={virtualRow.index}
                                ref={virtualizer.measureElement}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualRow.start}px)`,
                                    paddingBottom: '16px',
                                }}
                            >
                                {loaded && word ? (
                                    <React.Suspense fallback={<WordCardSkeleton />}>
                                        <WordCard
                                            word={word}
                                            theme={theme}
                                            onGenerateSentences={onGenerateSentences}
                                        />
                                    </React.Suspense>
                                ) : (
                                    <WordCardSkeleton />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

export default VirtualWordList;
