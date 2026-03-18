import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

const ThemeToggle = () => {
    const { theme, resolvedTheme, setTheme } = useTheme();

    const handleToggle = () => {
        // Toggle between dark and light
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const getIcon = () => {
        return theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />;
    };

    return (
        <button
            onClick={handleToggle}
            className={`
                relative p-2 rounded-lg transition-colors flex items-center justify-center overflow-hidden
                ${resolvedTheme === 'dark'
                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
            `}
            title={`Current Theme: ${theme}`}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={theme}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                >
                    {getIcon()}
                </motion.div>
            </AnimatePresence>
        </button>
    );
};

export default ThemeToggle;
