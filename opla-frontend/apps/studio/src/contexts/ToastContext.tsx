import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
}

interface ToastContextType {
    showToast: (title: string, message?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((title: string, message?: string, type: ToastType = 'success') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, type, title, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000); // auto dismiss after 5 seconds
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className="pointer-events-auto flex items-start gap-3 w-[400px] p-4 bg-[#1e2329] border border-[#2b313a] rounded-md shadow-2xl transition-all animate-in slide-in-from-right-8 fade-in duration-300 relative overflow-hidden"
                    >
                        <div className="mt-0.5 z-10">
                            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[#ef4444]" />}
                            {toast.type === 'info' && <Info className="w-5 h-5 text-[#3b82f6]" />}
                        </div>
                        <div className="flex-1 z-10">
                            <h4 className="text-[15px] font-bold text-white tracking-wide">{toast.title}</h4>
                            {toast.message && <p className="text-[13px] text-gray-400 mt-1 font-medium leading-relaxed">{toast.message}</p>}
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-gray-500 hover:text-white transition-colors z-10"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
