"use client";

import React, { ReactNode } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { State, WagmiProvider } from 'wagmi';
import { config, projectId } from '../config/web3';

// Setup queryClient
const queryClient = new QueryClient();

if (!projectId) throw new Error('Project ID is not defined');

// `config` se construye con la copia de @wagmi/core de esta app, mientras que
// createWeb3Modal y WagmiProvider están tipados contra otra copia presente en el
// árbol. Misma duplicación que se documenta en config/web3.ts: las aserciones
// cruzan esa frontera de tipos y no alteran el comportamiento en ejecución.
createWeb3Modal({
  wagmiConfig: config as unknown as Parameters<typeof createWeb3Modal>[0]['wagmiConfig'],
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
    <WagmiProvider config={config as unknown as React.ComponentProps<typeof WagmiProvider>['config']} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
