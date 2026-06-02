
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import ProfileConfig from './ProfileConfig';
import ProfileDashboard from './ProfileDashboard';

// 1. Tipado estricto para mitigar el riesgo tecnológico y asegurar la integridad de datos
interface UserProfile {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
    kycStatus?: 'pending' | 'verified' | 'rejected';
    preferences?: Record<string, unknown>;
    type?: string;
    nickname?: string;
    country?: string;
    sectors?: string[];
    [key: string]: any;
}

export default function ProfilePage() {
    const { user, isLoading: isAuthLoading } = useAuth();
    const [view, setView] = useState<'loading' | 'config' | 'dashboard'>('loading');
    const [profileData, setProfileData] = useState<UserProfile | null>(null);

    useEffect(() => {
        if (isAuthLoading) return;

        if (!user?.wallet_address) {
            setView('loading');
            return;
        }

        try {
            const savedProfile = localStorage.getItem(`profile_${user.wallet_address}`);
            if (savedProfile) {
                const parsedData = JSON.parse(savedProfile) as UserProfile;
                setProfileData(parsedData);
                setView('dashboard');
            } else {
                setView('config');
            }
        } catch (error) {
            console.error('Error de integridad en los datos del perfil:', error);
            localStorage.removeItem(`profile_${user.wallet_address}`);
            setView('config');
        }
    }, [user, isAuthLoading]);

    const handleSaveProfile = useCallback((data: UserProfile) => {
        if (!user?.wallet_address) return;

        try {
            localStorage.setItem(`profile_${user.wallet_address}`, JSON.stringify(data));
            setProfileData(data);
            setView('dashboard');
        } catch (error) {
            console.error('Error persistiendo el perfil:', error);
        }
    }, [user]);

    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center h-96 bg-[#020617]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center h-96 bg-[#020617]">
                <div className="p-8 border border-slate-800 bg-slate-900/50 rounded-2xl backdrop-blur-sm text-center">
                    <p className="text-slate-300 font-medium">Conecta tu wallet Web3 para acceder a tu perfil BeZhas.</p>
                </div>
            </div>
        );
    }

    if (view === 'loading') {
        return (
            <div className="flex items-center justify-center h-96 bg-[#020617]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto min-h-screen bg-[#020617] text-white">
            {view === 'config' ? (
                <ProfileConfig
                    initialData={profileData}
                    onSave={handleSaveProfile}
                    onCancel={profileData ? () => setView('dashboard') : undefined}
                />
            ) : (
                <ProfileDashboard
                    profile={profileData}
                    onEdit={() => setView('config')}
                />
            )}
        </div>
    );
}