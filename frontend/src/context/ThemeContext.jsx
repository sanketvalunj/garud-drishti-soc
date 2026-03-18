import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Read from localStorage or default to 'system'
    const [theme, setThemeState] = useState(() => {
        const stored = localStorage.getItem('cryptix-theme');
        return stored ? stored : 'dark';
    });

    const [resolvedTheme, setResolvedTheme] = useState('light');

    useEffect(() => {
        const root = window.document.documentElement;
        root.setAttribute('data-theme', theme);
        setResolvedTheme(theme);
    }, [theme]);

    const setTheme = (newTheme) => {
        setThemeState(newTheme);
        localStorage.setItem('cryptix-theme', newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
