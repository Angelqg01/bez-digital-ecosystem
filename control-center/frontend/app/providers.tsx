'use client';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import LoginRegisterModal from '@/components/LoginRegisterModal';

function ModalContainer() {
    const { isLoginModalOpen, closeLoginModal } = useAuth() as any;
    if (!isLoginModalOpen) return null;
    return <LoginRegisterModal onClose={closeLoginModal} />;
}

export default function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Polyfill performance API si falta
        if (typeof window !== 'undefined') {
            if (!window.performance) {
                window.performance = {} as any;
            }
            window.performance.clearMarks = window.performance.clearMarks || (() => { });
            window.performance.clearMeasures = window.performance.clearMeasures || (() => { });
            window.performance.mark = window.performance.mark || (() => { });
            window.performance.measure = window.performance.measure || (() => { });
        }
    }, []);

    return (
        <ThemeProvider>
            <AuthProvider>
                {children}
                <ModalContainer />
                <Toaster position="top-right" richColors closeButton />
            </AuthProvider>
        </ThemeProvider>
    );
}
