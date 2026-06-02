'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from './api';

/**
 * BeZhas Wallet Hooks — Smart Wallet (Account Abstraction) Integration
 * ─────────────────────────────────────────────────────────────────────
 * Conecta el frontend con SmartWalletFactory.sol, SmartWallet.sol,
 * WalletGuardian.sol, Paymaster.sol y BeZhasPayment.sol.
 *
 * Flujo:
 *   1. useWalletConnection()   → Conectar MetaMask / WalletConnect
 *   2. useSmartWallets()       → Leer wallets del usuario desde Factory
 *   3. useCreateSmartWallet()  → Crear wallet via Factory.createWalletSimple()
 *   4. usePayment()            → Ejecutar pagos via BeZhasPayment.processPayment()
 */

// ─── Lazy ethers import (SSR safe) ─────────────────────────────────────
let _ethers: typeof import('ethers') | null = null;
async function getEthers() {
    if (_ethers) return _ethers;
    _ethers = await import('ethers');
    return _ethers;
}

// ─── Contract Addresses (from environment) ─────────────────────────────
const ADDRESSES = {
    SMART_WALLET_FACTORY: process.env.NEXT_PUBLIC_SMART_WALLET_FACTORY || '',
    BEZHAS_PAYMENT:       process.env.NEXT_PUBLIC_BEZHAS_PAYMENT || '',
    BEZ_TOKEN:            process.env.NEXT_PUBLIC_BEZ_TOKEN || '',
    PAYMASTER:            process.env.NEXT_PUBLIC_PAYMASTER || '',
    WALLET_GUARDIAN:      process.env.NEXT_PUBLIC_WALLET_GUARDIAN || '',
};

// ─── Types ─────────────────────────────────────────────────────────────
export interface WalletConnection {
    address: string | null;
    chainId: number | null;
    connected: boolean;
    connecting: boolean;
    error: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    signer: unknown | null;
}

export interface SmartWalletInfo {
    address: string;
    owner: string;
    guardian: string;
    dailyLimit: string;
    dailySpent: string;
    paymasterActive: boolean;
    balance: string;
}

export interface CreateWalletState {
    creating: boolean;
    error: string | null;
    txHash: string | null;
    walletAddress: string | null;
    create: (guardian?: string, dailyLimit?: string) => Promise<string | null>;
}

export interface PaymentState {
    processing: boolean;
    error: string | null;
    txHash: string | null;
    pay: (recipient: string, amount: string, memo?: string) => Promise<string | null>;
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Wallet Connection (MetaMask / injected provider)
// ═══════════════════════════════════════════════════════════════════════════

export function useWalletConnection(): WalletConnection {
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [signer, setSigner] = useState<unknown | null>(null);

    // Auto-reconnect on page load if previously connected
    useEffect(() => {
        const autoConnect = async () => {
            if (typeof window === 'undefined' || !(window as any).ethereum) return;
            try {
                const ethers = await getEthers();
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const accounts = await provider.listAccounts();
                if (accounts.length > 0) {
                    const s = await provider.getSigner();
                    setAddress(await s.getAddress());
                    const network = await provider.getNetwork();
                    setChainId(Number(network.chainId));
                    setSigner(s);
                }
            } catch { /* silent auto-connect fail */ }
        };
        autoConnect();
    }, []);

    // Listen for account/chain changes
    useEffect(() => {
        if (typeof window === 'undefined' || !(window as any).ethereum) return;
        const eth = (window as any).ethereum;

        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                setAddress(null);
                setSigner(null);
            } else {
                setAddress(accounts[0]);
            }
        };

        const handleChainChanged = (id: string) => {
            setChainId(parseInt(id, 16));
            // Re-create signer on chain change
            connect().catch(() => {});
        };

        eth.on('accountsChanged', handleAccountsChanged);
        eth.on('chainChanged', handleChainChanged);
        return () => {
            eth.removeListener('accountsChanged', handleAccountsChanged);
            eth.removeListener('chainChanged', handleChainChanged);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const connect = useCallback(async () => {
        if (typeof window === 'undefined' || !(window as any).ethereum) {
            setError('MetaMask no detectado. Instala la extensión.');
            return;
        }
        setConnecting(true);
        setError(null);
        try {
            const ethers = await getEthers();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            await provider.send('eth_requestAccounts', []);
            const s = await provider.getSigner();
            const addr = await s.getAddress();
            const network = await provider.getNetwork();

            setAddress(addr);
            setChainId(Number(network.chainId));
            setSigner(s);
        } catch (err: any) {
            setError(err?.message || 'Error al conectar wallet');
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setAddress(null);
        setChainId(null);
        setSigner(null);
    }, []);

    return {
        address,
        chainId,
        connected: !!address,
        connecting,
        error,
        connect,
        disconnect,
        signer,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Read Smart Wallets from SmartWalletFactory
// ═══════════════════════════════════════════════════════════════════════════

export function useSmartWallets(ownerAddress: string | null) {
    const [wallets, setWallets] = useState<SmartWalletInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountRef = useRef(true);

    const fetchWallets = useCallback(async () => {
        if (!ownerAddress || !ADDRESSES.SMART_WALLET_FACTORY) return;
        setLoading(true);
        setError(null);

        try {
            const ethers = await getEthers();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const SmartWalletFactoryABI = (await import('./abi/SmartWalletFactory.json')).default;
            const SmartWalletABI = (await import('./abi/SmartWallet.json')).default;

            const factory = new ethers.Contract(
                ADDRESSES.SMART_WALLET_FACTORY,
                SmartWalletFactoryABI,
                provider,
            );

            // Leer las direcciones de las wallets del usuario
            const walletAddresses: string[] = await factory.getWalletsByOwner(ownerAddress);

            // Para cada wallet, leer sus datos on-chain
            const walletInfos: SmartWalletInfo[] = await Promise.all(
                walletAddresses.map(async (addr: string) => {
                    const wallet = new ethers.Contract(addr, SmartWalletABI, provider);
                    const [owner, guardian, dailyLimit, dailySpent] = await Promise.all([
                        wallet.owner().catch(() => ownerAddress),
                        wallet.guardian().catch(() => ethers.ZeroAddress),
                        wallet.dailyLimit().catch(() => 0n),
                        wallet.dailySpent().catch(() => 0n),
                    ]);

                    // Leer balance nativo de la wallet
                    const balance = await provider.getBalance(addr);

                    return {
                        address: addr,
                        owner,
                        guardian,
                        dailyLimit: ethers.formatEther(dailyLimit),
                        dailySpent: ethers.formatEther(dailySpent),
                        paymasterActive: ADDRESSES.PAYMASTER !== '',
                        balance: ethers.formatEther(balance),
                    };
                }),
            );

            if (mountRef.current) setWallets(walletInfos);
        } catch (err: any) {
            if (mountRef.current) setError(err?.reason || err?.message || 'Error leyendo wallets');
        } finally {
            if (mountRef.current) setLoading(false);
        }
    }, [ownerAddress]);

    useEffect(() => {
        mountRef.current = true;
        fetchWallets();
        return () => { mountRef.current = false; };
    }, [fetchWallets]);

    return { wallets, loading, error, refetch: fetchWallets };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Create Smart Wallet
// ═══════════════════════════════════════════════════════════════════════════

export function useCreateSmartWallet(signer: unknown): CreateWalletState {
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);

    const create = useCallback(async (
        guardian?: string,
        dailyLimit?: string,
    ): Promise<string | null> => {
        if (!signer || !ADDRESSES.SMART_WALLET_FACTORY) {
            setError('Wallet no conectada o Factory no configurada');
            return null;
        }

        setCreating(true);
        setError(null);
        setTxHash(null);
        setWalletAddress(null);

        try {
            const ethers = await getEthers();
            const SmartWalletFactoryABI = (await import('./abi/SmartWalletFactory.json')).default;

            const factory = new ethers.Contract(
                ADDRESSES.SMART_WALLET_FACTORY,
                SmartWalletFactoryABI,
                signer as any,
            );

            let tx;
            if (guardian && dailyLimit) {
                // Crear wallet con parámetros personalizados
                const salt = ethers.randomBytes(32);
                const limitWei = ethers.parseEther(dailyLimit);
                tx = await factory.createWallet(guardian, limitWei, salt);
            } else {
                // Crear wallet simple (guardian = address(0), límite default)
                const guardianAddr = guardian || ethers.ZeroAddress;
                tx = await factory.createWalletSimple(guardianAddr);
            }

            setTxHash(tx.hash);

            // Esperar confirmación y extraer la dirección de la wallet del evento
            const receipt = await tx.wait();
            const iface = new ethers.Interface(SmartWalletFactoryABI);

            for (const log of receipt.logs) {
                try {
                    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                    if (parsed?.name === 'WalletCreated') {
                        const newWalletAddr = parsed.args[1]; // wallet address
                        setWalletAddress(newWalletAddr);
                        return newWalletAddr;
                    }
                } catch { /* skip non-matching logs */ }
            }

            return null;
        } catch (err: any) {
            const msg = err?.reason || err?.info?.error?.message || err?.message || 'Error creando wallet';
            setError(msg);
            return null;
        } finally {
            setCreating(false);
        }
    }, [signer]);

    return { creating, error, txHash, walletAddress, create };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Process Payment via BeZhasPayment.sol
// ═══════════════════════════════════════════════════════════════════════════

export function usePayment(signer: unknown): PaymentState {
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const pay = useCallback(async (
        recipient: string,
        amount: string,
        memo: string = '',
    ): Promise<string | null> => {
        if (!signer || !ADDRESSES.BEZHAS_PAYMENT || !ADDRESSES.BEZ_TOKEN) {
            setError('Wallet no conectada o contratos no configurados');
            return null;
        }

        setProcessing(true);
        setError(null);
        setTxHash(null);

        try {
            const ethers = await getEthers();
            const BeZhasPaymentABI = (await import('./abi/BeZhasPayment.json')).default;

            const payment = new ethers.Contract(
                ADDRESSES.BEZHAS_PAYMENT,
                BeZhasPaymentABI,
                signer as any,
            );

            // Generar orderId único
            const orderId = ethers.keccak256(
                ethers.solidityPacked(
                    ['address', 'address', 'uint256', 'uint256'],
                    [await (signer as any).getAddress(), recipient, ethers.parseEther(amount), Date.now()],
                ),
            );

            // 1. Aprobar tokens BEZ para el contrato de pagos
            const ERC20ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
            const bezToken = new ethers.Contract(ADDRESSES.BEZ_TOKEN, ERC20ABI, signer as any);
            const amountWei = ethers.parseEther(amount);

            const approveTx = await bezToken.approve(ADDRESSES.BEZHAS_PAYMENT, amountWei);
            await approveTx.wait();

            // 2. Procesar el pago
            const payTx = await payment.processPayment(
                recipient,
                amountWei,
                orderId,
                memo,
            );

            setTxHash(payTx.hash);
            await payTx.wait();

            return payTx.hash;
        } catch (err: any) {
            const msg = err?.reason || err?.info?.error?.message || err?.message || 'Error procesando pago';
            setError(msg);
            return null;
        } finally {
            setProcessing(false);
        }
    }, [signer]);

    return { processing, error, txHash, pay };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: BEZ Token Balance (ERC20)
// ═══════════════════════════════════════════════════════════════════════════

export function useBEZTokenBalance(address: string | null) {
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(false);

    const fetchBalance = useCallback(async () => {
        if (!address || !ADDRESSES.BEZ_TOKEN || typeof window === 'undefined') return;
        setLoading(true);
        try {
            const ethers = await getEthers();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const ERC20ABI = ['function balanceOf(address) view returns (uint256)'];
            const token = new ethers.Contract(ADDRESSES.BEZ_TOKEN, ERC20ABI, provider);
            const bal = await token.balanceOf(address);
            setBalance(ethers.formatEther(bal));
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [address]);

    useEffect(() => {
        fetchBalance();
        const interval = setInterval(fetchBalance, 15_000);
        return () => clearInterval(interval);
    }, [fetchBalance]);

    return { balance, loading, refetch: fetchBalance };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Native ETH/BEZ balance
// ═══════════════════════════════════════════════════════════════════════════

export function useNativeBalance(address: string | null) {
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!address || typeof window === 'undefined') return;
        let cancelled = false;

        const fetch = async () => {
            setLoading(true);
            try {
                const ethers = await getEthers();
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const bal = await provider.getBalance(address);
                if (!cancelled) setBalance(ethers.formatEther(bal));
            } catch { /* silent */ }
            finally { if (!cancelled) setLoading(false); }
        };

        fetch();
        const interval = setInterval(fetch, 15_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [address]);

    return { balance, loading };
}
