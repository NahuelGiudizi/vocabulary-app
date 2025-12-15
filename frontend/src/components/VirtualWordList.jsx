/**
 * VirtualWordList Component
 * 
 * Virtualized list for efficiently rendering large word lists.
 * Uses @tanstack/react-virtual for smooth scrolling with thousands of items.
 * Includes scroll thumb preview showing current position context.
 */

import React, { useRef, useCallback, memo, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import WordCard from './WordCard';

/**
 * Get scroll indicator text based on sort type and current word
 */
function getScrollIndicator(word, sortBy) {
    if (!word) return { main: '', sub: '' };

    const rank = word.rank || 0;

    switch (sortBy) {
        case 'alpha':
        case 'alpha_desc':
            // Show the first letter, with rank as sub
            return {
                main: word.lemma?.charAt(0).toUpperCase() || '',
                sub: `#${rank}`,
            };
        case 'rank':
        default:
            // Show rank range, with word as sub
            const rangeStart = Math.floor((rank - 1) / 100) * 100 + 1;
            const rangeEnd = rangeStart + 99;
            return {
                main: `#${rangeStart}-${rangeEnd}`,
                sub: `#${rank} ${word.lemma}`,
            };
    }
}

/**
 * Scroll Indicator Component - shows current position while scrolling
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
                {/* Arrow pointing to scrollbar */}
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
 * Virtualized word list with infinite scroll and scroll preview
 */
const VirtualWordList = memo(function VirtualWordList({
    words,
    theme,
    onGenerateSentences,
    loading = false,
    hasMore = false,
    onLoadMore,
    totalCount = 0,
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

    // Estimate row height - cards with sentences need more space (~280px average)
    const estimateSize = useCallback(() => 280, []);

    const virtualizer = useVirtualizer({
        count: words.length,
        getScrollElement: () => parentRef.current,
        estimateSize,
        overscan: 8,
    });

    const items = virtualizer.getVirtualItems();

    // Update scroll indicator based on visible items
    const updateScrollIndicator = useCallback((scrollTop, clientHeight) => {
        if (words.length === 0 || !items.length) return;

        // Find the word in the middle of the viewport
        const viewportMiddle = scrollTop + clientHeight / 2;
        const middleItem = items.find(item =>
            item.start <= viewportMiddle && item.start + item.size >= viewportMiddle
        ) || items[Math.floor(items.length / 2)];

        if (middleItem && words[middleItem.index]) {
            const word = words[middleItem.index];
            const indicator = getScrollIndicator(word, sortBy);

            // Calculate indicator position relative to the scroll container
            const scrollElement = parentRef.current;
            if (scrollElement) {
                const scrollableHeight = scrollElement.scrollHeight - clientHeight;
                const scrollRatio = scrollTop / Math.max(1, scrollableHeight);
                // Position within the container, leaving margin at top/bottom
                const indicatorY = 40 + (clientHeight - 100) * scrollRatio;

                setScrollIndicator({
                    visible: true,
                    text: indicator.main,
                    subtext: indicator.sub,
                    top: indicatorY,
                });
            }
        }
    }, [words, items, sortBy]);

    // Handle scroll with indicator
    const handleScroll = useCallback((e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;

        // Show scroll indicator
        updateScrollIndicator(scrollTop, clientHeight);

        // Clear previous timeout
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        // Hide indicator after scrolling stops
        scrollTimeoutRef.current = setTimeout(() => {
            setScrollIndicator(prev => ({ ...prev, visible: false }));
        }, 800);

        // Check if we need to load more
        if (hasMore && !loading && onLoadMore) {
            const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 500;
            if (scrolledToBottom) {
                onLoadMore();
            }
        }
    }, [hasMore, loading, onLoadMore, updateScrollIndicator]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Results count */}
            <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-sm text-gray-600">
                    {loading && words.length === 0 ? (
                        'Loading...'
                    ) : (
                        <>
                            Showing <span className="font-medium">{words.length.toLocaleString()}</span>
                            {totalCount > 0 && (
                                <> of <span className="font-medium">{totalCount.toLocaleString()}</span></>
                            )} words
                        </>
                    )}
                </p>
                {hasMore && (
                    <span className="text-xs text-gray-400">
                        Scroll for more...
                    </span>
                )}
            </div>

            {/* Virtualized list container - relative for scroll indicator positioning */}
            <div
                ref={parentRef}
                onScroll={handleScroll}
                className="overflow-auto relative"
                style={{
                    height: 'calc(100vh - 300px)',
                    minHeight: '400px'
                }}
            >
                {/* Scroll Indicator - positioned relative to this container */}
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
                        const word = words[virtualRow.index];
                        return (
                            <div
                                key={word.id}
                                data-index={virtualRow.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualRow.start}px)`,
                                    paddingBottom: '16px',
                                }}
                            >
                                <WordCard
                                    word={word}
                                    theme={theme}
                                    onGenerateSentences={onGenerateSentences}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Loading indicator at bottom */}
                {loading && words.length > 0 && (
                    <div className="flex items-center justify-center py-4 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span>Loading more words...</span>
                    </div>
                )}
            </div>
        </div>
    );
});

export default VirtualWordList;
