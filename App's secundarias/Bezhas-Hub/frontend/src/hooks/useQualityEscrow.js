import { useState, useEffect } from 'react';
import { useWeb3Context } from '../context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import { useWalletClient, usePublicClient } from 'wagmi';
import BeZhasQualityEscrowABI from '../contracts/BeZhasQualityEscrow.json';
import BezCoinABI from '../contracts/BezCoin.json';

export const useQualityEscrow = () => {
    const { address, signer } = useWeb3Context();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();

    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState([]);

    // Get contract addresses from environment
    const ESCROW_ADDRESS = import.meta.env.VITE_QUALITY_ESCROW_ADDRESS || '';
    const BEZCOIN_ADDRESS = import.meta.env.VITE_BEZCOIN_ADDRESS || '';

    // Helper to get contract instance
    const getEscrowContract = () => {
        if (!signer || !ESCROW_ADDRESS) return null;
        return new ethers.Contract(ESCROW_ADDRESS, BeZhasQualityEscrowABI.abi, signer);
    };

    const getBezCoinContract = () => {
        if (!signer || !BEZCOIN_ADDRESS) return null;
        return new ethers.Contract(BEZCOIN_ADDRESS, BezCoinABI.abi, signer);
    };

    // Create a new quality escrow service
    const createService = async (clientWallet, amountInBEZ, initialQuality) => {
        if (!address) {
            toast.error('Please connect your wallet');
            return null;
        }

        if (!ESCROW_ADDRESS || !BEZCOIN_ADDRESS) {
            toast.error('Contract addresses not configured');
            return null;
        }

        try {
            setLoading(true);
            const escrow = getEscrowContract();
            const bezCoin = getBezCoinContract();

            if (!escrow || !bezCoin) {
                toast.error('Failed to initialize contracts');
                return null;
            }

            // Convert amount to Wei (BEZ has 18 decimals)
            const amountWei = ethers.parseEther(amountInBEZ.toString());

            // Step 1: Approve BezCoin spending
            toast.loading('Approving BEZ tokens...', { id: 'create-service' });
            const approveTx = await bezCoin.approve(ESCROW_ADDRESS, amountWei);
            await approveTx.wait();

            // Step 2: Create service
            toast.loading('Creating quality escrow service...', { id: 'create-service' });
            const tx = await escrow.createService(clientWallet, amountWei, initialQuality);
            const receipt = await tx.wait();

            // Extract serviceId from event
            const iface = new ethers.Interface(BeZhasQualityEscrowABI.abi);
            const event = receipt.logs
                .map(log => {
                    try {
                        return iface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find(e => e && e.name === 'ServiceCreated');

            const serviceId = event?.args?.serviceId?.toString();

            toast.success(`Service created! ID: ${serviceId}`, { id: 'create-service' });
            await loadUserServices(); // Refresh services list
            return serviceId;
        } catch (error) {
            console.error('Error creating service:', error);
            const message = error.reason || error.message || 'Failed to create service';
            toast.error(message, { id: 'create-service' });
            return null;
        } finally {
            setLoading(false);
        }
    };

    // Finalize a service with final quality score
    const finalizeService = async (serviceId, finalQuality) => {
        if (!address) {
            toast.error('Please connect your wallet');
            return false;
        }

        try {
            setLoading(true);
            const escrow = getEscrowContract();
            if (!escrow) {
                toast.error('Failed to initialize contract');
                return false;
            }

            toast.loading('Finalizing service...', { id: 'finalize' });
            const tx = await escrow.finalizeService(serviceId, finalQuality);
            const receipt = await tx.wait();

            // Parse ServiceFinalized event to get penalty info
            const iface = new ethers.Interface(BeZhasQualityEscrowABI.abi);
            const event = receipt.logs
                .map(log => {
                    try {
                        return iface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find(e => e && e.name === 'ServiceFinalized');

            const penaltyPaid = event?.args?.penaltyPaid
                ? ethers.formatEther(event.args.penaltyPaid)
                : '0';

            toast.success(`Service finalized! Penalty: ${penaltyPaid} BEZ`, { id: 'finalize' });
            await loadUserServices(); // Refresh services list
            return true;
        } catch (error) {
            console.error('Error finalizing service:', error);
            const message = error.reason || error.message || 'Failed to finalize service';
            toast.error(message, { id: 'finalize' });
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Raise a dispute for a service
    const raiseDispute = async (serviceId) => {
        if (!address) {
            toast.error('Please connect your wallet');
            return false;
        }

        try {
            setLoading(true);
            const escrow = getEscrowContract();
            if (!escrow) {
                toast.error('Failed to initialize contract');
                return false;
            }

            toast.loading('Raising dispute...', { id: 'dispute' });
            const tx = await escrow.raiseDispute(serviceId);
            await tx.wait();

            toast.success('Dispute raised successfully!', { id: 'dispute' });
            await loadUserServices(); // Refresh services list
            return true;
        } catch (error) {
            console.error('Error raising dispute:', error);
            const message = error.reason || error.message || 'Failed to raise dispute';
            toast.error(message, { id: 'dispute' });
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Get service details by ID
    const getService = async (serviceId) => {
        try {
            const escrow = getEscrowContract();
            if (!escrow) return null;

            const service = await escrow.services(serviceId);

            return {
                id: serviceId.toString(),
                collateralAmount: ethers.formatEther(service.collateralAmount),
                timestamp: new Date(Number(service.timestamp) * 1000),
                businessWallet: service.businessWallet,
                clientWallet: service.clientWallet,
                initialQuality: Number(service.initialQuality),
                finalQuality: Number(service.finalQuality),
                status: ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED'][Number(service.status)]
            };
        } catch (error) {
            console.error('Error getting service:', error);
            return null;
        }
    };

    // Load all services for current user
    const loadUserServices = async () => {
        if (!address || !ESCROW_ADDRESS) return;

        try {
            setLoading(true);
            const escrow = getEscrowContract();
            if (!escrow) return;

            const counter = await escrow.serviceCounter();
            const userServices = [];

            // Load all services and filter by user
            for (let i = 1; i <= Number(counter); i++) {
                const service = await getService(i);
                if (service && (
                    service.businessWallet.toLowerCase() === address.toLowerCase() ||
                    service.clientWallet.toLowerCase() === address.toLowerCase()
                )) {
                    userServices.push(service);
                }
            }

            setServices(userServices);
        } catch (error) {
            console.error('Error loading services:', error);
            toast.error('Failed to load services');
        } finally {
            setLoading(false);
        }
    };

    // Get platform statistics
    const getStats = async () => {
        try {
            const escrow = getEscrowContract();
            if (!escrow) return null;

            const counter = await escrow.serviceCounter();

            return {
                totalServices: Number(counter),
                userServices: services.length,
                activeServices: services.filter(s => s.status === 'IN_PROGRESS').length,
                completedServices: services.filter(s => s.status === 'COMPLETED').length,
                disputedServices: services.filter(s => s.status === 'DISPUTED').length
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return null;
        }
    };

    // Auto-load services when address changes
    useEffect(() => {
        if (address && ESCROW_ADDRESS) {
            loadUserServices();
        }
    }, [address, ESCROW_ADDRESS]);

    // Auto-load services when address changes
    useEffect(() => {
        if (address && ESCROW_ADDRESS) {
            loadUserServices();
        }
    }, [address, ESCROW_ADDRESS]);

    return {
        // Functions
        createService,
        finalizeService,
        raiseDispute,
        getService,
        loadUserServices,
        getStats,
        // State
        services,
        loading,
        // Contract info
        escrowAddress: ESCROW_ADDRESS,
        bezCoinAddress: BEZCOIN_ADDRESS,
        isConfigured: !!ESCROW_ADDRESS && !!BEZCOIN_ADDRESS
    };
};
