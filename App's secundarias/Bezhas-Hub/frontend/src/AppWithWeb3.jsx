// AppWithWeb3.jsx - wagmi 3.x compatible (Optimizado)
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import router from './App';
import { config } from './lib/web3/wagmiConfig';
// Web3Modal ya está inicializado en wagmiConfig.js

// QueryClient optimizado
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
            gcTime: 300_000,
        },
    },
});

// Web3 Guard Component to handle network mismatches globally
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { polygonAmoy, polygon } from 'wagmi/chains';
import { Toaster, toast } from 'react-hot-toast';

const NetworkGuard = ({ children }) => {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    // Solo mostramos advertencia si no está en Amoy o Polygon Mainnet
    useEffect(() => {
        if (isConnected && chainId !== polygonAmoy.id && chainId !== polygon.id) {
            toast.error('Red no soportada. BeZhas funciona mejor en Polygon/Amoy.', {
                duration: 5000,
                id: 'network-warning'
            });
        }
    }, [isConnected, chainId]);

    return children;
};

function AppWithWeb3() {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <NetworkGuard>
                    <RouterProvider router={router} />
                </NetworkGuard>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export default AppWithWeb3;
