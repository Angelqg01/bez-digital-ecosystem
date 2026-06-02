import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';
import { BEZ_COIN_ADDRESS } from '../config/contracts';

// Contract ABI (simplified - add full ABI from compilation)
const CARGO_MANIFEST_ABI = [
    'function registerManifest(string containerId, string transportMode, string commodityDescription, uint256 weightMT, string vesselVoyage, string hsCode, address consignee, string originPort, string destinationPort, string manifestURI, bool isHazardous, bool isReefered, bool isOOG) returns (uint256)',
    'function attachHazardousAppendix(uint256 tokenId, string msdsURI, string unClass)',
    'function attachReeferAppendix(uint256 tokenId, string tempDataURI)',
    'function attachOOGAppendix(uint256 tokenId, string dimensionsURI)',
    'function attachCommercialInvoice(uint256 tokenId, string invoiceURI)',
    'function attachPackingList(uint256 tokenId, string packingListURI)',
    'function attachCertificateOfOrigin(uint256 tokenId, string certURI)',
    'function updateStatus(uint256 tokenId, uint8 newStatus)',
    'function verifyOwnership(uint256 tokenId) view returns (address)',
    'function getManifest(uint256 tokenId) view returns (tuple(string containerId, string transportMode, string commodityDescription, uint256 weightMT, string vesselVoyage, string hsCode, address shipper, address consignee, string originPort, string destinationPort, bool isHazardous, bool isReefered, bool isOOG, uint256 timestamp, uint8 status))',
    'function calculateFees() view returns (uint256)',
    'function registrationFee() view returns (uint256)',
    'event ManifestRegistered(uint256 indexed tokenId, string containerId, address indexed shipper, address indexed consignee, string originPort, string destinationPort)',
    'event StatusUpdated(uint256 indexed tokenId, uint8 newStatus)'
];

const BEZ_COIN_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

export const useCargoManifestContract = (contractAddress) => {
    const { walletAddress, provider } = useAuth();
    const [contract, setContract] = useState(null);
    const [bezCoinContract, setBezCoinContract] = useState(null);
    const [loading, setLoading] = useState(false);
    const [registrationFee, setRegistrationFee] = useState('0');
    const [bezBalance, setBezBalance] = useState('0');

    // Initialize contracts
    useEffect(() => {
        const initContracts = async () => {
            if (!provider || !walletAddress || !contractAddress) return;

            try {
                const signer = provider.getSigner();

                const cargoContract = new ethers.Contract(
                    contractAddress,
                    CARGO_MANIFEST_ABI,
                    signer
                );

                const bezContract = new ethers.Contract(
                    BEZ_COIN_ADDRESS,
                    BEZ_COIN_ABI,
                    signer
                );

                setContract(cargoContract);
                setBezCoinContract(bezContract);

                // Get registration fee
                const fee = await cargoContract.registrationFee();
                setRegistrationFee(ethers.formatUnits(fee, 18));

                // Get BEZ balance
                const balance = await bezContract.balanceOf(walletAddress);
                setBezBalance(ethers.formatUnits(balance, 18));

            } catch (error) {
                console.error('Error initializing contracts:', error);
            }
        };

        initContracts();
    }, [provider, walletAddress, contractAddress]);

    /**
     * Register a new cargo manifest
     */
    const registerManifest = useCallback(async (manifestData) => {
        if (!contract || !bezCoinContract) {
            throw new Error('Contracts not initialized');
        }

        setLoading(true);
        try {
            // 1. Approve BEZ-Coin spending
            const feeInWei = ethers.parseUnits(registrationFee, 18);
            const approveTx = await bezCoinContract.approve(contract.address, feeInWei);
            await approveTx.wait();

            // 2. Upload metadata to IPFS (you'll need to implement this)
            const manifestURI = await uploadToIPFS(manifestData);

            // 3. Register manifest
            const tx = await contract.registerManifest(
                manifestData.containerId,
                manifestData.transportMode,
                manifestData.commodityDescription,
                ethers.parseUnits(manifestData.weightMT.toString(), 3), // Scale by 1000
                manifestData.vesselVoyage,
                manifestData.hsCode,
                manifestData.consignee,
                manifestData.originPort,
                manifestData.destinationPort,
                manifestURI,
                manifestData.isHazardous || false,
                manifestData.isReefered || false,
                manifestData.isOOG || false
            );

            const receipt = await tx.wait();

            // Extract tokenId from event
            const event = receipt.events.find(e => e.event === 'ManifestRegistered');
            const tokenId = event.args.tokenId.toString();

            setLoading(false);
            return { success: true, tokenId, transactionHash: receipt.transactionHash };

        } catch (error) {
            setLoading(false);
            console.error('Error registering manifest:', error);
            throw error;
        }
    }, [contract, bezCoinContract, registrationFee]);

    /**
     * Attach hazardous cargo appendix
     */
    const attachHazardousAppendix = useCallback(async (tokenId, msdsData, unClass) => {
        if (!contract) throw new Error('Contract not initialized');

        setLoading(true);
        try {
            const msdsURI = await uploadToIPFS(msdsData);
            const tx = await contract.attachHazardousAppendix(tokenId, msdsURI, unClass);
            await tx.wait();

            setLoading(false);
            return { success: true };
        } catch (error) {
            setLoading(false);
            console.error('Error attaching hazardous appendix:', error);
            throw error;
        }
    }, [contract]);

    /**
     * Attach reefer cargo appendix
     */
    const attachReeferAppendix = useCallback(async (tokenId, tempData) => {
        if (!contract) throw new Error('Contract not initialized');

        setLoading(true);
        try {
            const tempDataURI = await uploadToIPFS(tempData);
            const tx = await contract.attachReeferAppendix(tokenId, tempDataURI);
            await tx.wait();

            setLoading(false);
            return { success: true };
        } catch (error) {
            setLoading(false);
            console.error('Error attaching reefer appendix:', error);
            throw error;
        }
    }, [contract]);

    /**
     * Attach OOG cargo appendix
     */
    const attachOOGAppendix = useCallback(async (tokenId, dimensionsData) => {
        if (!contract) throw new Error('Contract not initialized');

        setLoading(true);
        try {
            const dimensionsURI = await uploadToIPFS(dimensionsData);
            const tx = await contract.attachOOGAppendix(tokenId, dimensionsURI);
            await tx.wait();

            setLoading(false);
            return { success: true };
        } catch (error) {
            setLoading(false);
            console.error('Error attaching OOG appendix:', error);
            throw error;
        }
    }, [contract]);

    /**
     * Attach commercial documents
     */
    const attachDocument = useCallback(async (tokenId, documentType, documentData) => {
        if (!contract) throw new Error('Contract not initialized');

        setLoading(true);
        try {
            const documentURI = await uploadToIPFS(documentData);

            let tx;
            switch (documentType) {
                case 'invoice':
                    tx = await contract.attachCommercialInvoice(tokenId, documentURI);
                    break;
                case 'packingList':
                    tx = await contract.attachPackingList(tokenId, documentURI);
                    break;
                case 'certificate':
                    tx = await contract.attachCertificateOfOrigin(tokenId, documentURI);
                    break;
                default:
                    throw new Error('Invalid document type');
            }

            await tx.wait();

            setLoading(false);
            return { success: true };
        } catch (error) {
            setLoading(false);
            console.error('Error attaching document:', error);
            throw error;
        }
    }, [contract]);

    /**
     * Update manifest status
     */
    const updateManifestStatus = useCallback(async (tokenId, status) => {
        if (!contract) throw new Error('Contract not initialized');

        setLoading(true);
        try {
            const tx = await contract.updateStatus(tokenId, status);
            await tx.wait();

            setLoading(false);
            return { success: true };
        } catch (error) {
            setLoading(false);
            console.error('Error updating status:', error);
            throw error;
        }
    }, [contract]);

    /**
     * Verify manifest ownership
     */
    const verifyOwnership = useCallback(async (tokenId) => {
        if (!contract) throw new Error('Contract not initialized');

        try {
            const owner = await contract.verifyOwnership(tokenId);
            return owner;
        } catch (error) {
            console.error('Error verifying ownership:', error);
            throw error;
        }
    }, [contract]);

    /**
     * Get manifest data
     */
    const getManifest = useCallback(async (tokenId) => {
        if (!contract) throw new Error('Contract not initialized');

        try {
            const manifest = await contract.getManifest(tokenId);
            return {
                containerId: manifest.containerId,
                transportMode: manifest.transportMode,
                commodityDescription: manifest.commodityDescription,
                weightMT: ethers.formatUnits(manifest.weightMT, 3),
                vesselVoyage: manifest.vesselVoyage,
                hsCode: manifest.hsCode,
                shipper: manifest.shipper,
                consignee: manifest.consignee,
                originPort: manifest.originPort,
                destinationPort: manifest.destinationPort,
                isHazardous: manifest.isHazardous,
                isReefered: manifest.isReefered,
                isOOG: manifest.isOOG,
                timestamp: new Date(manifest.timestamp.toNumber() * 1000),
                status: manifest.status
            };
        } catch (error) {
            console.error('Error getting manifest:', error);
            throw error;
        }
    }, [contract]);

    /**
     * Calculate registration fees
     */
    const calculateFees = useCallback(async () => {
        if (!contract) throw new Error('Contract not initialized');

        try {
            const fee = await contract.calculateFees();
            return ethers.formatUnits(fee, 18);
        } catch (error) {
            console.error('Error calculating fees:', error);
            throw error;
        }
    }, [contract]);

    return {
        contract,
        loading,
        registrationFee,
        bezBalance,
        registerManifest,
        attachHazardousAppendix,
        attachReeferAppendix,
        attachOOGAppendix,
        attachDocument,
        updateManifestStatus,
        verifyOwnership,
        getManifest,
        calculateFees
    };
};

/**
 * Upload data to IPFS
 * NOTE: You need to implement this with your IPFS provider (Pinata, NFT.Storage, etc.)
 */
async function uploadToIPFS(data) {
    // Placeholder - implement with your IPFS service
    // Example with Pinata:
    // const response = await pinata.pinJSONToIPFS(data);
    // return `ipfs://${response.IpfsHash}`;

    // For now, return a mock URI
    console.log('Uploading to IPFS:', data);
    return `ipfs://Qm${Math.random().toString(36).substring(7)}`;
}

export default useCargoManifestContract;
