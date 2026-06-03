'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title?: string;
    duration?: number;
}

export function ToastProvider() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        // Global toast function
        const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', title?: string, duration: number = 5000) => {
            const id = Date.now().toString();
            const newToast: Toast = { id, message, type, title, duration };

            setToasts(prev => [...prev, newToast]);

            if (duration > 0) {
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== id));
                }, duration);
            }
        };

        // Convenience functions
        (window as any).toast = Object.assign(showToast, {
            success: (message: string, title?: string, duration?: number) => showToast(message, 'success', title, duration),
            error: (message: string, title?: string, duration?: number) => showToast(message, 'error', title, duration),
            info: (message: string, title?: string, duration?: number) => showToast(message, 'info', title, duration),
            warning: (message: string, title?: string, duration?: number) => showToast(message, 'warning', title, duration),
        });

        return () => {
            delete (window as any).toast;
        };
    }, []);

    const getColors = (type: Toast['type']) => {
        switch (type) {
            case 'success': return { bg: 'bg-green-500', border: 'border-l-green-500', icon: CheckCircle2 };
            case 'error': return { bg: 'bg-red-500', border: 'border-l-red-500', icon: AlertCircle };
            case 'warning': return { bg: 'bg-amber-500', border: 'border-l-amber-500', icon: AlertTriangle };
            case 'info': return { bg: 'bg-blue-500', border: 'border-l-blue-500', icon: Info };
        }
    };

    return (
        <div className="fixed top-4 right-4 z-50 pointer-events-none space-y-2">
            {toasts.map((toast) => {
                const colors = getColors(toast.type);
                const Icon = colors.icon;

                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto animate-in slide-in-from-right-full fade-in-0 duration-300 flex items-start gap-3 bg-white dark:bg-slate-950 rounded-lg shadow-lg border-l-4 p-4 min-w-[320px] ${colors.border}`}
                    >
                        <Icon className={`w-5 h-5 flex-shrink-0 ${colors.bg.replace('bg-', 'text-')}`} />
                        <div className="flex-1 min-w-0">
                            {toast.title && <p className="font-semibold text-sm text-foreground">{toast.title}</p>}
                            <p className="text-sm text-muted-foreground">{toast.message}</p>
                            {toast.duration && toast.duration > 0 && (
                                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${colors.bg.replace('bg-', 'bg-')}`}
                                        style={{
                                            animation: `shrink ${toast.duration}ms linear forwards`,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
            <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
        </div>
    );
}
