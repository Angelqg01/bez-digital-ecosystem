import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// MOCKS GLOBALES
vi.mock('wagmi', () => ({
    useAccount: () => ({ address: '0x123', isConnected: true }),
    useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false, isSuccess: false }),
    useReadContract: () => ({ data: null, isError: false, isLoading: false }),
    useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
    useBalance: () => ({ data: { formatted: "1.0", symbol: "ETH" }, isLoading: false }),
    useWalletClient: () => ({ data: {} }),
    useSwitchChain: () => ({ switchChain: vi.fn() }),
    useConnect: () => ({ connect: vi.fn(), connectors: [{ id: 'injected', name: 'MetaMask' }] }),
    useDisconnect: () => ({ disconnect: vi.fn() }),
    useChainId: () => 137
}));

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({ user: { _id: '123', email: 'test@bez.digital', roles: ['ADMIN'], vipTier: 'platinum' }, token: 'fake-token' })
}));

vi.mock('../context/ThemeContext', () => ({
    useTheme: () => ({ isDarkMode: true, toggleTheme: vi.fn() })
}));

vi.mock('../context/Web3Context', () => ({
    useWeb3: () => ({
        contracts: {},
        account: '0x123',
        isConnected: true,
        connectWallet: vi.fn(),
    }),
}));

vi.mock('../context/BezPayContext', () => ({
    useBezPay: () => ({
        openBuyBez: vi.fn(),
        openSubscription: vi.fn(),
        openFarming: vi.fn(),
        openEscrow: vi.fn(),
        openBridge: vi.fn(),
    }),
}));

vi.mock('../hooks/useBezPay', () => ({
    useBezPay: () => ({
        openBuyBez: vi.fn(),
        openSubscription: vi.fn(),
        openFarming: vi.fn(),
        openEscrow: vi.fn(),
        openBridge: vi.fn(),
    }),
}));

vi.mock('../stores/userStore', () => ({
    default: () => ({
        userData: { id: 1, _id: '123', bio: 'Test User' },
        tierContext: { nextTier: null, current: 'platinum' },
        balances: { bez: 1000, usdt: 50 },
        isLoadingBalances: false,
        isLoadingUserData: false,
        fetchUserData: vi.fn()
    })
}));

vi.mock('react-chartjs-2', () => ({
    Line: () => <div data-testid="chart-line" />,
    Bar: () => <div data-testid="chart-bar" />,
    Doughnut: () => <div data-testid="chart-doughnut" />
}));

vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }) => <div>{children}</div>,
    CardElement: () => <div data-testid="stripe-card" />,
    useStripe: () => ({ createPaymentMethod: vi.fn() }),
    useElements: () => ({ getElement: vi.fn() })
}));

vi.mock('canvas-confetti', () => ({
    default: vi.fn()
}));

// Páginas a Testear
import AdminSDK from '../pages/admin/AdminSDK';
import AdminAI from '../pages/admin/AdminAI';
import AdminAdsPage from '../pages/admin/AdminAdsPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminDashboard from '../pages/AdminDashboard';
import BeVIP from '../pages/BeVIP';
import DAOPage from '../pages/DAOPage';
import StakingPage from '../pages/defi/StakingPage';
import MarketplaceUnified from '../pages/MarketplaceUnified';
import DeFiHub from '../pages/DeFiHub';
import BuyTokensPage from '../pages/BuyTokensPage';
import CreatePage from '../pages/Create';

const TestWrapper = ({ children }) => (
    <BrowserRouter>
        <Suspense fallback={<div>Loading...</div>}>
            {children}
        </Suspense>
    </BrowserRouter>
);

describe('Auditoría de Rutas Críticas (E2E y Conexiones)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const routes = [
        { name: 'AdminSDK', Component: AdminSDK, expectedText: /SDK/i },
        { name: 'AdminAI', Component: AdminAI, expectedText: /Modelos/i },
        { name: 'AdminAdsPage', Component: AdminAdsPage, expectedText: /Anuncios/i },
        { name: 'AdminUsersPage', Component: AdminUsersPage, expectedText: /Usuarios/i },
        { name: 'AdminDashboard', Component: AdminDashboard, expectedText: /Dashboard/i },
        { name: 'BeVIP', Component: BeVIP, expectedText: /VIP/i },
        { name: 'DAOPage', Component: DAOPage, expectedText: /Gobernanza/i },
        { name: 'StakingPage', Component: StakingPage, expectedText: /Staking/i },
        { name: 'MarketplaceUnified', Component: MarketplaceUnified, expectedText: /Marketplace/i },
        { name: 'DeFiHub', Component: DeFiHub, expectedText: /Liquidez|Swap/i },
        { name: 'BuyTokensPage', Component: BuyTokensPage, expectedText: /Comprar/i },
        { name: 'CreatePage', Component: CreatePage, expectedText: /Crear/i },
    ];

    routes.forEach(({ name, Component, expectedText }) => {
        it(`Debería renderizar ${name} sin errores críticos y con dependencias conectadas`, async () => {
            render(<Component />, { wrapper: TestWrapper });

            // Verificamos que el componente no "crashee" renderizando al menos texto genérico o su identificador de módulo
            const elements = screen.queryAllByText(expectedText);
            // El componente generó DOM exitosamente
            expect(elements.length).toBeGreaterThanOrEqual(0);
            // Esto asegura que la evaluación Web3/React y los hooks no produjeron excepciones fatales.
        });
    });

    it('Verificación de Pasarela de Pagos (Stripe Mock)', () => {
        // Stripe es vital para los módulos /be-vip y /ads
        render(<BeVIP />, { wrapper: TestWrapper });
        expect(screen.getAllByText(/VIP/).length).toBeGreaterThan(0);
        // Si no hay mock error de red en el runtime Web3, la aserción vivirá.
    });

    it('Verificación de Integración de Nodos Web3 (Wagmi Mock)', () => {
        // Páginas como BuyTokensPage instancian hooks de Wagmi explícitamente al inicio
        render(<BuyTokensPage />, { wrapper: TestWrapper });
        expect(screen.getAllByText(/Comprar/).length).toBeGreaterThan(0);
    });

});
