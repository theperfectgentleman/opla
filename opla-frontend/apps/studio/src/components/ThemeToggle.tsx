import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

type ThemeToggleProps = {
    iconOnly?: boolean;
    className?: string;
};

const getInitialTheme = (): Theme => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return 'light';
};

const applyTheme = (theme: Theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
};

const ThemeToggle: React.FC<ThemeToggleProps> = ({ iconOnly = false, className = '' }) => {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={iconOnly
                ? `p-2 rounded-md text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] transition-all ${className}`
                : `inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs font-semibold text-[hsl(var(--text-secondary))] shadow-sm hover:border-[hsl(var(--border-hover))] hover:text-[hsl(var(--text-primary))] transition-all ${className}`}
            aria-label="Toggle theme"
        >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            {!iconOnly && <span className="hidden sm:inline">{theme === 'light' ? 'Dark' : 'Light'} mode</span>}
        </button>
    );
};

export default ThemeToggle;
