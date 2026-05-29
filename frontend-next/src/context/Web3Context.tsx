/* eslint-disable */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { ethers, BrowserProvider } from "ethers";
import toast from "react-hot-toast";
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi';

// Define the shape of our context
interface Web3ContextType {
  provider: BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  contracts: Record<string, ethers.Contract>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

export const Web3ProviderComponent = ({ children }: { children: React.ReactNode }) => {
    const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const wagmiChainId = useChainId();

    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Contracts storage temporarily
    const contractsRef = useRef<Record<string, ethers.Contract>>({});

    useEffect(() => {
        setAddress(wagmiAddress as string || null);
        setIsConnected(wagmiIsConnected);
        setChainId(wagmiChainId?.toString() || null);
    }, [wagmiAddress, wagmiIsConnected, wagmiChainId]);

    useEffect(() => {
        if (!walletClient || !wagmiIsConnected) {
            setProvider(null);
            setSigner(null);
            return;
        }

        try {
            // Adapted for Wagmi v2 which gives viem wallet client
            const ethersProvider = new ethers.BrowserProvider(walletClient as any);
            setProvider(ethersProvider);

            ethersProvider.getSigner().then(ethersSigner => {
                setSigner(ethersSigner);
            }).catch(err => {
                console.error("Signer creation failed:", err);
            });
        } catch (error) {
            console.error("Provider creation failed:", error);
        }
    }, [walletClient, wagmiIsConnected]);

    const connectWallet = useCallback(async () => {
        toast("Use el botÃ³n 'Connect Wallet' para conectar vÃ­a Web3Modal");
    }, []);

    const disconnectWallet = useCallback(() => {
        toast("Use el botÃ³n de wallet para desconectar");
    }, []);

    const value = useMemo(
        () => ({
            provider,
            signer,
            address,
            chainId,
            isConnected,
            isLoading,
            connectWallet,
            disconnectWallet,
            contracts: contractsRef.current,
        }),
        [provider, signer, address, chainId, isConnected, isLoading]
    );

    return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const Web3Provider = memo(Web3ProviderComponent);

export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (!context) {
        throw new Error("useWeb3 must be used within a Web3Provider");
    }
    return context;
};

export const useWeb3Context = useWeb3;

