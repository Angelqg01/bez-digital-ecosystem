import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { fetchConfig } from "../lib/api";
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi';

const Web3Context = createContext(null);

const Web3ProviderComponent = ({ children }) => {
    // Usar wagmi hooks para estado de conexión automática
    const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const wagmiChainId = useChainId();

    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [address, setAddress] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Changed to false to prevent blocking
    const [appConfig, setAppConfig] = useState(null);

    const configFetchAttemptedRef = useRef(false);
    const configFetchInProgressRef = useRef(false);
    const contractsRef = useRef({});

    // Define initContracts BEFORE any useEffect that uses it
    const initContracts = useCallback((currentSigner, config) => {
        if (!config || !config.contractAddresses || !config.abis) {
            return;
        }

        const { contractAddresses, abis } = config;

        // Validate essential contract addresses
        if (!contractAddresses.UserProfileAddress || !contractAddresses.MarketplaceAddress) {
            return;
        }

        try {
            const userManagement = new ethers.Contract(contractAddresses.UserProfileAddress, abis.UserProfileABI, currentSigner);
            const marketplace = new ethers.Contract(contractAddresses.MarketplaceAddress, abis.AdvancedMarketplaceABI, currentSigner);
            const stakingPool = new ethers.Contract(contractAddresses.StakingPoolAddress, abis.StakingPoolABI, currentSigner);
            const bezhasToken = new ethers.Contract(contractAddresses.BezhasTokenAddress, abis.BezhasTokenABI, currentSigner);
            contractsRef.current = { userManagement, marketplace, stakingPool, bezhasToken };
        } catch (error) {
            console.error("Failed to initialize contracts:", error);
        }
    }, []);

    // Sincronizar estado de wagmi con Web3Context
    useEffect(() => {
        setAddress(wagmiAddress || null);
        setIsConnected(wagmiIsConnected);
        setChainId(wagmiChainId?.toString() || null);
    }, [wagmiAddress, wagmiIsConnected, wagmiChainId]);

    // Crear provider y signer desde walletClient cuando se conecta
    useEffect(() => {
        if (!walletClient || !wagmiIsConnected) {
            setProvider(null);
            setSigner(null);
            return;
        }

        try {
            const ethersProvider = new ethers.BrowserProvider(walletClient);
            setProvider(ethersProvider);

            ethersProvider.getSigner().then(ethersSigner => {
                setSigner(ethersSigner);
                if (appConfig) {
                    initContracts(ethersSigner, appConfig);
                }
            }).catch(err => {
                console.error("Signer creation failed:", err);
            });
        } catch (error) {
            console.error("Provider creation failed:", error);
        }
    }, [walletClient, wagmiIsConnected, appConfig, initContracts]);

    useEffect(() => {
        if (configFetchAttemptedRef.current || configFetchInProgressRef.current) {
            return;
        }

        configFetchAttemptedRef.current = true;
        configFetchInProgressRef.current = true;

        const loadConfig = async () => {
            try {
                const config = await fetchConfig();
                setAppConfig(config);
            } catch (error) {
                // Silently fail with defaults - backend may not be running
                setAppConfig({
                    chainId: "137",
                    contractAddresses: {},
                    abis: {}
                });
            } finally {
                configFetchInProgressRef.current = false;
            }
        };

        // Add timeout to prevent infinite loading
        const timeout = setTimeout(() => {
            if (configFetchInProgressRef.current) {
                setAppConfig({
                    chainId: "137",
                    contractAddresses: {},
                    abis: {}
                });
                configFetchInProgressRef.current = false;
            }
        }, 1500);

        loadConfig();

        return () => {
            clearTimeout(timeout);
        };
    }, []);

    const connectWallet = useCallback(async () => {
        toast("Use el botón 'Connect Wallet' en la parte superior para conectar vía Web3Modal");
    }, []);

    const disconnectWallet = useCallback(() => {
        // La desconexión se maneja vía Web3Modal
        toast("Use el botón de wallet para desconectar");
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

// Memoize provider to prevent unnecessary re-renders
export const Web3Provider = memo(Web3ProviderComponent);

export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (!context) {
        throw new Error("useWeb3 must be used within a Web3Provider");
    }
    return context;
};

export const useWeb3Context = useWeb3;
