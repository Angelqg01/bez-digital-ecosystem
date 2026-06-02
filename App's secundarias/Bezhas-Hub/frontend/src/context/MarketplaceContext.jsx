import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from './Web3Context';
import MarketplaceABI from '../abis/BeZhasMarketplace.json';
import ContractAddresses from '../contract-addresses.json';
import toast from 'react-hot-toast';

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

const MarketplaceContext = createContext();

export const useMarketplace = () => {
    const context = useContext(MarketplaceContext);
    if (!context) {
        throw new Error("useMarketplace must be used within a MarketplaceProvider");
    }
    return context;
};

export const MarketplaceProvider = ({ children }) => {
    const { signer, address } = useWeb3();
    const [contract, setContract] = useState(null);
    const [tokenContract, setTokenContract] = useState(null);
    const [isVendor, setIsVendor] = useState(false);
    const [loading, setLoading] = useState(false);
    const [vendorFee, setVendorFee] = useState(null);

    useEffect(() => {
        if (signer && ContractAddresses.BeZhasMarketplaceAddress) {
            const marketplace = new ethers.Contract(
                ContractAddresses.BeZhasMarketplaceAddress,
                MarketplaceABI,
                signer
            );
            setContract(marketplace);

            if (ContractAddresses.BezhasTokenAddress) {
                const token = new ethers.Contract(
                    ContractAddresses.BezhasTokenAddress,
                    ERC20_ABI,
                    signer
                );
                setTokenContract(token);
            }
        }
    }, [signer]);

    useEffect(() => {
        if (contract && address) {
            checkVendorStatus();
            fetchVendorFee();
        }
    }, [contract, address]);

    const checkVendorStatus = async () => {
        try {
            const status = await contract.isVendor(address);
            setIsVendor(status);
        } catch (error) {
            // Silenciar errores BAD_DATA de contratos no deployados
            if (error?.message?.includes('could not decode result data')) {
                if (import.meta.env.DEV) console.warn('⚠️ Marketplace contract not deployed, vendor status unavailable');
                setIsVendor(false);
            } else if (import.meta.env.DEV) {
                console.error("Error checking vendor status:", error);
            }
        }
    };

    const fetchVendorFee = async () => {
        try {
            const fee = await contract.vendorFee();
            setVendorFee(fee);
        } catch (error) {
            // Silenciar errores BAD_DATA de contratos no deployados
            if (error?.message?.includes('could not decode result data')) {
                if (import.meta.env.DEV) console.warn('⚠️ Marketplace contract not deployed, using default vendor fee');
                // Fallback: 500 BEZ (equivalente a 50€ a 0.10€/BEZ)
                setVendorFee(ethers.parseUnits("500", 18));
            } else if (import.meta.env.DEV) {
                console.error("Error fetching vendor fee:", error);
                setVendorFee(ethers.parseUnits("500", 18)); // Fallback
            }
        }
    };

    const fetchProducts = async () => {
        if (!contract) return [];
        try {
            // 1. Get total product count
            // Note: productCounter is public, so we can call it.
            // However, to get metadata (CID), we need to query events because it's not in a public mapping struct.

            // Query ProductCreated events
            const filter = contract.filters.ProductCreated();
            const events = await contract.queryFilter(filter);

            // Map events to product objects
            const products = await Promise.all(events.map(async (event) => {
                const { id, seller, price, metadataCID } = event.args;

                // Check if product is sold (optional optimization: check owner/seller mapping)
                // For now, we'll just return all created products. 
                // In a real app, we'd check if it's still available.

                return {
                    id: Number(id),
                    seller: seller,
                    price: ethers.formatUnits(price, 18),
                    metadataCID: metadataCID,
                    // We can fetch IPFS metadata here or in the component
                    name: `Product #${id}`, // Placeholder until metadata is fetched
                    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%236366f1' width='150' height='150'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' fill='white' text-anchor='middle' dy='.3em'%3ENFT%3C/text%3E%3C/svg%3E" // Placeholder
                };
            }));

            return products;
        } catch (error) {
            console.error("Error fetching products:", error);
            return [];
        }
    };

    const approveToken = async (amount) => {
        if (!tokenContract) throw new Error("Token contract not initialized");
        const tx = await tokenContract.approve(ContractAddresses.BeZhasMarketplaceAddress, amount);
        await tx.wait();
        toast.success("Tokens approved!");
    };

    const registerAsVendor = async () => {
        if (!contract) {
            toast.error("Marketplace contract not connected");
            return;
        }

        setLoading(true);
        let toastId;

        try {
            // Calcular fee (usar el del contrato o fallback de 500 BEZ)
            const feeToUse = vendorFee || ethers.parseUnits("500", 18);

            toastId = toast.loading("Step 1/3: Checking token allowance...");

            // Check allowance con manejo de errores graceful
            let allowance = 0n;
            let needsApproval = true;

            try {
                allowance = await tokenContract.allowance(address, ContractAddresses.BeZhasMarketplaceAddress);
                needsApproval = allowance < feeToUse;
            } catch (error) {
                // En dev mode sin contrato deployado, asumir que necesita aprobación
                if (error?.message?.includes('could not decode result data')) {
                    if (import.meta.env.DEV) {
                        console.warn('⚠️ Token contract not deployed (dev mode) - assuming approval needed');
                    }
                } else {
                    throw error; // Re-throw otros errores
                }
            }

            if (needsApproval) {
                toast.loading("Step 2/3: Approving BEZ tokens...", { id: toastId });
                await approveToken(feeToUse);
                toast.success("✓ Tokens approved!", { id: toastId });
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                toast.success("✓ Tokens already approved", { id: toastId });
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            toastId = toast.loading("Step 3/3: Registering as vendor on blockchain...", { id: toastId });
            const tx = await contract.registerAsVendor();

            toast.loading("⏳ Waiting for confirmation...", { id: toastId });
            await tx.wait();

            toast.success("🎉 Successfully registered as a vendor!", {
                id: toastId,
                duration: 5000
            });

            setIsVendor(true);

            // Mostrar notificación adicional
            setTimeout(() => {
                toast.success("You can now list products on the marketplace!", {
                    duration: 4000,
                    icon: '🛍️'
                });
            }, 1000);

        } catch (error) {
            console.error("Error registering:", error);

            let errorMessage = "Registration failed";
            if (error.code === 'ACTION_REJECTED') {
                errorMessage = "Transaction rejected by user";
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = "Insufficient BEZ tokens in wallet";
            } else if (error.reason) {
                errorMessage = error.reason;
            } else if (error.message) {
                errorMessage = error.message;
            }

            toast.error(errorMessage, { id: toastId, duration: 5000 });
        } finally {
            setLoading(false);
        }
    };

    const createProduct = async (price, metadataCID) => {
        if (!contract) return;
        setLoading(true);
        try {
            const priceWei = ethers.parseUnits(price.toString(), 18);
            toast.loading("Creating product...");
            const tx = await contract.createProduct(priceWei, metadataCID);
            await tx.wait();
            toast.dismiss();
            toast.success("Product created successfully!");
        } catch (error) {
            console.error("Error creating product:", error);
            toast.dismiss();
            toast.error("Failed to create product");
        } finally {
            setLoading(false);
        }
    };

    const buyProduct = async (productId, price) => {
        if (!contract) return;
        setLoading(true);
        try {
            const priceWei = ethers.parseUnits(price.toString(), 18);

            // Check allowance
            const allowance = await tokenContract.allowance(address, ContractAddresses.BeZhasMarketplaceAddress);
            if (allowance < priceWei) {
                toast.loading("Approving payment...");
                await approveToken(priceWei);
                toast.dismiss();
            }

            toast.loading("Buying product...");
            const tx = await contract.buyProduct(productId);
            await tx.wait();
            toast.dismiss();
            toast.success("Product purchased!");
        } catch (error) {
            console.error("Error buying product:", error);
            toast.dismiss();
            toast.error("Purchase failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <MarketplaceContext.Provider value={{
            isVendor,
            registerAsVendor,
            createProduct,
            buyProduct,
            fetchProducts,
            loading,
            vendorFee
        }}>
            {children}
        </MarketplaceContext.Provider>
    );
};
