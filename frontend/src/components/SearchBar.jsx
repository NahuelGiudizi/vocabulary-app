/**
 * SearchBar Component
 * 
 * Provides search and filter functionality for vocabulary words.
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
    Search,
    X,
    Filter,
    ChevronDown,
    Hash,
    Sliders,
    ArrowUpDown
} from 'lucide-react';

/**
 * Debounce hook
 */
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

/**
 * POS options for filter
 */
const POS_OPTIONS = [
    { value: '', label: 'All Parts of Speech' },
    { value: 'n', label: 'Noun' },
    { value: 'v', label: 'Verb' },
    { value: 'j', label: 'Adjective' },
    { value: 'r', label: 'Adverb' },
    { value: 'i', label: 'Preposition' },
    { value: 'p', label: 'Pronoun' },
    { value: 'a', label: 'Article' },
    { value: 'd', label: 'Determiner' },
    { value: 'c', label: 'Conjunction' },
    { value: 'u', label: 'Interjection' },
    { value: 'm', label: 'Modal' },
];

/**
 * Rank range presets
 */
const RANK_PRESETS = [
    { label: 'All Words', min: 1, max: 5050 },
    { label: 'Top 100', min: 1, max: 100 },
    { label: 'Top 500', min: 1, max: 500 },
    { label: 'Top 1000 (Basic)', min: 1, max: 1000 },
    { label: '1001-2000', min: 1001, max: 2000 },
    { label: '2001-3000', min: 2001, max: 3000 },
    { label: '3001-4000 (Advanced)', min: 3001, max: 4000 },
    { label: '4001-5050', min: 4001, max: 5050 },
];

/**
 * Sort options
 */
const SORT_OPTIONS = [
    { value: 'rank', label: 'By Frequency (Rank)' },
    { value: 'alpha', label: 'Alphabetically A-Z' },
    { value: 'alpha_desc', label: 'Alphabetically Z-A' },
];

/**
 * SearchBar component
 */
const SearchBar = memo(function SearchBar({
    onSearch,
    onPosChange,
    onRankChange,
    onSortChange,
    onReset,
    initialSearch = '',
    initialPos = '',
    initialRankMin = 1,
    initialRankMax = 5050,
    initialSortBy = 'rank',
    placeholder = 'Search for words...',
    showAdvanced = true,
}) {
    const [search, setSearch] = useState(initialSearch);
    const [pos, setPos] = useState(initialPos);
    const [rankMin, setRankMin] = useState(initialRankMin);
    const [rankMax, setRankMax] = useState(initialRankMax);
    const [sortBy, setSortBy] = useState(initialSortBy);
    const [showFilters, setShowFilters] = useState(false);

    const inputRef = useRef(null);
    const debouncedSearch = useDebounce(search, 300);

    // Trigger search on debounced value change
    useEffect(() => {
        if (onSearch) {
            onSearch(debouncedSearch);
        }
    }, [debouncedSearch, onSearch]);

    // Handle search input
    const handleSearchChange = useCallback((e) => {
        setSearch(e.target.value);
    }, []);

    // Clear search
    const handleClear = useCallback(() => {
        setSearch('');
        inputRef.current?.focus();
    }, []);

    // Handle POS change
    const handlePosChange = useCallback((e) => {
        const value = e.target.value;
        setPos(value);
        if (onPosChange) {
            onPosChange(value || null);
        }
    }, [onPosChange]);

    // Handle rank preset selection
    const handleRankPreset = useCallback((preset) => {
        setRankMin(preset.min);
        setRankMax(preset.max);
        if (onRankChange) {
            onRankChange(preset.min, preset.max);
        }
    }, [onRankChange]);

    // Handle custom rank change
    const handleRankMinChange = useCallback((e) => {
        const value = parseInt(e.target.value) || 1;
        setRankMin(value);
        if (onRankChange) {
            onRankChange(value, rankMax);
        }
    }, [rankMax, onRankChange]);

    const handleRankMaxChange = useCallback((e) => {
        const value = parseInt(e.target.value) || 5050;
        setRankMax(value);
        if (onRankChange) {
            onRankChange(rankMin, value);
        }
    }, [rankMin, onRankChange]);

    // Handle sort change
    const handleSortChange = useCallback((e) => {
        const value = e.target.value;
        setSortBy(value);
        if (onSortChange) {
            onSortChange(value);
        }
    }, [onSortChange]);

    // Reset all filters
    const handleReset = useCallback(() => {
        setSearch('');
        setPos('');
        setRankMin(1);
        setRankMax(5050);
        setSortBy('rank');
        if (onReset) {
            onReset();
        }
    }, [onReset]);

    // Check if any filters are active
    const hasActiveFilters = search || pos || rankMin !== 1 || rankMax !== 5050 || sortBy !== 'rank';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            {/* Main search bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={handleSearchChange}
                        placeholder={placeholder}
                        className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                    {search && (
                        <button
                            onClick={handleClear}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* POS Filter */}
                <div className="relative">
                    <select
                        value={pos}
                        onChange={handlePosChange}
                        className="appearance-none pl-4 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white cursor-pointer min-w-[160px]"
                    >
                        {POS_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                </div>

                {/* Sort Order */}
                <div className="relative">
                    <select
                        value={sortBy}
                        onChange={handleSortChange}
                        className="appearance-none pl-4 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white cursor-pointer min-w-[180px]"
                    >
                        {SORT_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <ArrowUpDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                </div>

                {/* Advanced filters toggle */}
                {showAdvanced && (
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-3 rounded-lg border transition-colors ${showFilters || hasActiveFilters
                            ? 'border-primary-500 bg-primary-50 text-primary-600'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                            }`}
                    >
                        <Sliders className="w-5 h-5" />
                    </button>
                )}

                {/* Reset button */}
                {hasActiveFilters && (
                    <button
                        onClick={handleReset}
                        className="px-4 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Advanced filters */}
            {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                        <Hash className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Rank Range</span>
                    </div>

                    {/* Rank presets */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {RANK_PRESETS.map(preset => (
                            <button
                                key={preset.label}
                                onClick={() => handleRankPreset(preset)}
                                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${rankMin === preset.min && rankMax === preset.max
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom range inputs */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 mb-1 block">Min Rank</label>
                            <input
                                type="number"
                                value={rankMin}
                                onChange={handleRankMinChange}
                                min={1}
                                max={5000}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <span className="text-gray-400 mt-5">—</span>
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 mb-1 block">Max Rank</label>
                            <input
                                type="number"
                                value={rankMax}
                                onChange={handleRankMaxChange}
                                min={1}
                                max={5000}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default SearchBar;
