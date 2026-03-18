import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`theme-toggle-btn group relative overflow-hidden flex items-center justify-center ${className}`}
            aria-label={`Current theme is ${theme}. Click to switch.`}
        >
            <div className="icon-wrapper flex items-center justify-center w-5 h-5 transition-all duration-300">
                {theme === 'light' && <Sun size={20} className="text-amber-500 scale-100 transition-transform" />}
                {theme === 'dark' && <Moon size={20} className="text-blue-400 scale-100 transition-transform" />}
                {theme === 'system' && <Monitor size={20} className="text-slate-400 scale-100 transition-transform" />}
            </div>
        </button>
    );
};

export default ThemeToggle;
