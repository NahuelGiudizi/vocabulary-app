/**
 * ThemeSelector Component
 * 
 * Allows users to select the professional theme for example sentences.
 */

import React, { memo } from 'react';
import { Check } from 'lucide-react';

/**
 * Default theme configurations
 */
const THEME_CONFIG = {
    qa_manager: {
        key: 'qa_manager',
        name: 'IT QA Manager',
        emoji: '🔍',
        description: 'Quality Assurance and Testing',
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-500',
        textColor: 'text-blue-700',
    },
    software_dev: {
        key: 'software_dev',
        name: 'Software Development',
        emoji: '💻',
        description: 'Programming and Engineering',
        color: 'from-green-500 to-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-500',
        textColor: 'text-green-700',
    },
    agile_scrum: {
        key: 'agile_scrum',
        name: 'Agile & Scrum',
        emoji: '📋',
        description: 'Agile Methodologies',
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-500',
        textColor: 'text-purple-700',
    },
    devops: {
        key: 'devops',
        name: 'DevOps & CI/CD',
        emoji: '🚀',
        description: 'Infrastructure and Deployment',
        color: 'from-orange-500 to-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-500',
        textColor: 'text-orange-700',
    },
    general_business: {
        key: 'general_business',
        name: 'General Business',
        emoji: '💼',
        description: 'Professional Communication',
        color: 'from-gray-500 to-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-500',
        textColor: 'text-gray-700',
    },
};

/**
 * ThemeSelector component
 */
const ThemeSelector = memo(function ThemeSelector({
    currentTheme,
    onThemeChange,
    themes = null, // API themes override
    compact = false,
    showDescription = true,
}) {
    // Merge API themes with default config
    const themeList = Object.keys(THEME_CONFIG).map(key => ({
        ...THEME_CONFIG[key],
        ...(themes?.[key] || {}),
    }));

    // Handle theme selection
    const handleSelect = (themeKey) => {
        if (onThemeChange && themeKey !== currentTheme) {
            onThemeChange(themeKey);
        }
    };

    // Compact view (dropdown)
    if (compact) {
        return (
            <div className="relative">
                <select
                    value={currentTheme}
                    onChange={(e) => handleSelect(e.target.value)}
                    className="appearance-none w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white cursor-pointer"
                >
                    {themeList.map(theme => (
                        <option key={theme.key} value={theme.key}>
                            {theme.emoji} {theme.name}
                        </option>
                    ))}
                </select>
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xl">
                    {THEME_CONFIG[currentTheme]?.emoji || '🎯'}
                </span>
            </div>
        );
    }

    // Full card view
    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
                Select Professional Theme
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {themeList.map(theme => {
                    const isSelected = theme.key === currentTheme;
                    const config = THEME_CONFIG[theme.key] || {};

                    return (
                        <button
                            key={theme.key}
                            onClick={() => handleSelect(theme.key)}
                            className={`relative p-4 rounded-xl border-2 transition-all text-left ${isSelected
                                    ? `${config.borderColor} ${config.bgColor}`
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            {/* Selected indicator */}
                            {isSelected && (
                                <div className={`absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-r ${config.color} flex items-center justify-center`}>
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            )}

                            {/* Theme emoji */}
                            <div className="text-2xl mb-2">{theme.emoji}</div>

                            {/* Theme name */}
                            <div className={`font-medium ${isSelected ? config.textColor : 'text-gray-900'}`}>
                                {theme.name}
                            </div>

                            {/* Theme description */}
                            {showDescription && (
                                <div className="text-xs text-gray-500 mt-1">
                                    {theme.description}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

/**
 * ThemeBadge - Small inline theme indicator
 */
export const ThemeBadge = memo(function ThemeBadge({ theme, size = 'sm' }) {
    const config = THEME_CONFIG[theme] || THEME_CONFIG.qa_manager;

    const sizeClasses = {
        xs: 'text-xs px-2 py-0.5',
        sm: 'text-sm px-2.5 py-1',
        md: 'text-base px-3 py-1.5',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 ${config.bgColor} ${config.textColor} rounded-full ${sizeClasses[size]}`}>
            <span>{config.emoji}</span>
            <span className="font-medium">{config.name}</span>
        </span>
    );
});

/**
 * Get theme config
 */
export const getThemeConfig = (themeKey) => {
    return THEME_CONFIG[themeKey] || THEME_CONFIG.qa_manager;
};

export default ThemeSelector;
