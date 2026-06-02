"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, HeaderAuthButton, LockScreen } from './SSOProvider';

export function DefiLayoutContent({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const pathname = usePathname();

  const isDashboard = pathname === '/';
  const showLock = !token && !isDashboard;

  return (
    <div className="flex-1 ml-64 p-8 flex flex-col min-h-screen">
      {/* Top Header Bar with Auth Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: 'rgba(15, 23, 42, 0.4)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        marginBottom: '20px',
        backdropFilter: 'blur(8px)',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#00f0ff' }}>🏛️ BeZhas DeFi Panel</span>
          <span style={{ fontSize: '10px', background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>L2 DEFI</span>
        </div>
        <HeaderAuthButton />
      </div>

      {showLock ? (
        <LockScreen title="Módulo DeFi Restringido" />
      ) : (
        <div className="flex-1">
          {children}
        </div>
      )}
    </div>
  );
}
