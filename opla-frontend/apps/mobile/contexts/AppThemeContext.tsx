import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AppMode = 'pulse' | 'pro';

interface AppThemeContextType {
    mode: AppMode;
    setMode: (mode: AppMode) => void;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<AppMode>('pulse');

    return (
        <AppThemeContext.Provider value={{ mode, setMode }}>
            {children}
        </AppThemeContext.Provider>
    );
}

export function useAppTheme() {
    const context = useContext(AppThemeContext);
    if (context === undefined) {
        throw new Error('useAppTheme must be used within an AppThemeProvider');
    }
    return context;
}
