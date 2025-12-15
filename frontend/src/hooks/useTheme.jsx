/**
 * useTheme hook for managing application theme selection.
 * 
 * Provides theme state management with persistence.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { wordsApi } from '../services/api';

// Default themes (fallback)
const DEFAULT_THEMES = {
    qa_manager: {
        key: 'qa_manager',
        name: 'IT QA Manager',
        emoji: '🔍',
        description: 'Quality Assurance Manager in a software company',
    },
    software_dev: {
        key: 'software_dev',
        name: 'Software Development',
        emoji: '💻',
        description: 'Software Developer or Engineer',
    },
    agile_scrum: {
        key: 'agile_scrum',
        name: 'Agile & Scrum',
        emoji: '📋',
        description: 'Agile/Scrum Team Member or Scrum Master',
    },
    devops: {
        key: 'devops',
        name: 'DevOps & CI/CD',
        emoji: '🚀',
        description: 'DevOps Engineer or SRE',
    },
    general_business: {
        key: 'general_business',
        name: 'General Business',
        emoji: '💼',
        description: 'Professional Business Communication',
    },
};

const STORAGE_KEY = 'vocabulary_app_theme';

/**
 * Custom hook for theme management
 * @returns {Object} Theme state and actions
 */
export function useTheme() {
    const [currentTheme, setCurrentTheme] = useState(() => {
        // Load from localStorage
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved || 'qa_manager';
    });

    const [themes, setThemes] = useState(DEFAULT_THEMES);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Fetch themes from API
     */
    const fetchThemes = useCallback(async () => {
        try {
            const response = await wordsApi.getThemes();

            if (response.themes) {
                const themesMap = {};
                response.themes.forEach((theme) => {
                    themesMap[theme.key] = theme;
                });
                setThemes(themesMap);
            }
        } catch (err) {
            console.warn('Failed to fetch themes, using defaults:', err.message);
            // Keep using defaults
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch themes on mount
    useEffect(() => {
        fetchThemes();
    }, [fetchThemes]);

    /**
     * Change current theme
     * @param {string} themeKey - Theme key to set
     */
    const selectTheme = useCallback((themeKey) => {
        if (themes[themeKey]) {
            setCurrentTheme(themeKey);
            localStorage.setItem(STORAGE_KEY, themeKey);
        }
    }, [themes]);

    /**
     * Get theme info
     * @param {string} themeKey - Theme key
     * @returns {Object} Theme info
     */
    const getTheme = useCallback((themeKey) => {
        return themes[themeKey] || themes.qa_manager;
    }, [themes]);

    /**
     * Get current theme info
     */
    const currentThemeInfo = themes[currentTheme] || themes.qa_manager;

    /**
     * Get all themes as array
     */
    const themesList = Object.values(themes);

    return {
        // State
        currentTheme,
        currentThemeInfo,
        themes,
        themesList,
        loading,
        error,

        // Actions
        selectTheme,
        getTheme,
        refresh: fetchThemes,
    };
}

// Theme Context
const ThemeContext = createContext(null);

/**
 * Theme provider component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export function ThemeProvider({ children }) {
    const theme = useTheme();

    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * Hook to access theme context
 * @returns {Object} Theme context value
 */
export function useThemeContext() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useThemeContext must be used within ThemeProvider');
    }

    return context;
}

export default useTheme;
