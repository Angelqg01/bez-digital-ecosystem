"use client";

import React, { ReactNode } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { State, WagmiProvider } from 'wagmi';
import { config, projectId } from '../config/web3';

const queryClient = new QueryClient();

if (!projectId) throw new Error('Project ID is not defined');

// This module is loaded via next/dynamic({ssr:false}) from Providers.tsx, so
// createWeb3Modal only ever runs in the browser. Calling it at module scope
// (not inside useEffect) is required because useWeb3Modal() in child components
// throws if the modal is not registered by first render.
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
  enableOnramp: true,
  themeMode: 'light',
  themeVariables: {
    '--w3m-color-mix': '#9F87FF',
    '--w3m-accent': '#9F87FF'
  }
});

export default function Web3ModalProvider({
  children,
  initialState
}: {
  children: ReactNode;
  initialState?: State;
}) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
