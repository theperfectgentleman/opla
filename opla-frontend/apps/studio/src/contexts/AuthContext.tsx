import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../lib/api';

// User interface
interface User {
    id: string;
    email?: string;
    phone?: string;
    full_name: string;
    is_platform_admin: boolean;
    is_active: boolean;
    created_at: string;
}

// Auth context interface
interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    loginWithOTP: (phone: string, otp: string) => Promise<void>;
    registerEmail: (email: string, password: string, fullName: string) => Promise<void>;
    registerPhone: (phone: string, fullName: string) => Promise<void>;
    requestOTP: (phone: string) => Promise<{ message: string; otp?: string }>;
    logout: () => void;
    clearError: () => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

//Auth Provider Props
interface AuthProviderProps {
    children: ReactNode;
}

// Auth Provider Component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check if user is logged in on mount
    useEffect(() => {
        const initAuth = async () => {
            const accessToken = localStorage.getItem('access_token');
            const storedUser = localStorage.getItem('user');

            if (accessToken && storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                    // Optionally verify token by fetching current user
                    const userData = await authAPI.getCurrentUser();
                    setUser(userData);
                    localStorage.setItem('user', JSON.stringify(userData));
                } catch (err) {
                    // Token invalid, clear storage
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    // Save auth data to localStorage and state
    const saveAuthData = (authData: {
        access_token: string;
        refresh_token: string;
        user: User;
    }) => {
        localStorage.setItem('access_token', authData.access_token);
        localStorage.setItem('refresh_token', authData.refresh_token);
        localStorage.setItem('user', JSON.stringify(authData.user));
        setUser(authData.user);
    };

    // Email/password login
    const login = async (email: string, password: string) => {
        try {
            setError(null);
            setIsLoading(true);
            const data = await authAPI.login({ email, password });
            saveAuthData(data);
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || 'Login failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // OTP login
    const loginWithOTP = async (phone: string, otp: string) => {
        try {
            setError(null);
            setIsLoading(true);
            const data = await authAPI.verifyOTP({ phone, otp });
            saveAuthData(data);
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || 'OTP verification failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Email registration
    const registerEmail = async (email: string, password: string, fullName: string) => {
        try {
            setError(null);
            setIsLoading(true);
            const data = await authAPI.registerEmail({
                email,
                password,
                full_name: fullName,
            });
            saveAuthData(data);
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || 'Registration failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Phone registration
    const registerPhone = async (phone: string, fullName: string) => {
        try {
            setError(null);
            setIsLoading(true);
            await authAPI.registerPhone({ phone, full_name: fullName });
            // Note: Phone registration doesn't log in immediately, requires OTP verification
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || 'Registration failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Request OTP
    const requestOTP = async (phone: string) => {
        try {
            setError(null);
            const result = await authAPI.requestOTP({ phone });
            return result;
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || 'Failed to send OTP';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    // Logout
    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setUser(null);
    };

    // Clear error
    const clearError = () => setError(null);

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        loginWithOTP,
        registerEmail,
        registerPhone,
        requestOTP,
        logout,
        clearError,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
