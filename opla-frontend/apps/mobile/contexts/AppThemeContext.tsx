import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppMode = 'pulse' | 'pro';
export type FontProfile = 'modern' | 'warm' | 'editorial' | 'developer';

interface AppThemeContextType {
    mode: AppMode;
    setMode: (mode: AppMode) => void;
    fontProfile: FontProfile;
    setFontProfile: (profile: FontProfile) => void;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<AppMode>('pulse');
    const [fontProfile, setFontProfileState] = useState<FontProfile>('modern');

    useEffect(() => {
        AsyncStorage.getItem('font-profile').then((stored) => {
            if (stored === 'modern' || stored === 'warm' || stored === 'editorial' || stored === 'developer') {
                setFontProfileState(stored);
            }
        });
    }, []);

    const setFontProfile = async (profile: FontProfile) => {
        setFontProfileState(profile);
        await AsyncStorage.setItem('font-profile', profile);
    };

    return (
        <AppThemeContext.Provider value={{ mode, setMode, fontProfile, setFontProfile }}>
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
