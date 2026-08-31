import { useReadContract, useWriteContract, useAccount, useBalance } from 'wagmi';
import { CONTRACTS, ERC20_ABI, MARKETPLACE_ABI, CORE_ABI, NFT_OFFERS_ABI, NFT_RENTAL_ABI, FARMING_ABI } from '../config/web3';

// ========================================================================
// HOOK: BEZ Token Balance
// ========================================================================
export function useBezBalance(address) {
    const { data, isError, isLoading, refetch } = useReadContract({
        address: CONTRACTS.BEZCOIN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        enabled: !!address
    });

    return {
        balance: data ? data.toString() : '0',
        isError,
        isLoading,
        refetch
    };
}

// ========================================================================
// HOOK: BEZ Token Transfer
// ========================================================================
export function useBezTransfer() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const transfer = async (to, amount) => {
        return writeContract({
            address: CONTRACTS.BEZCOIN,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [to, amount]
        });
    };

    return {
        transfer,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: BEZ Token Approve
// ========================================================================
export function useBezApprove() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const approve = async (spender, amount) => {
        return writeContract({
            address: CONTRACTS.BEZCOIN,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [spender, amount]
        });
    };

    return {
        approve,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Check if user is Vendor
// ========================================================================
export function useIsVendor(address) {
    const { data, isError, isLoading, refetch } = useReadContract({
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'isVendor',
        args: address ? [address] : undefined,
        enabled: !!address
    });

    return {
        isVendor: data || false,
        isError,
        isLoading,
        refetch
    };
}

// ========================================================================
// HOOK: Get Product Count
// ========================================================================
export function useProductCount() {
    const { data, isError, isLoading, refetch } = useReadContract({
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'productCount'
    });

    return {
        count: data ? Number(data) : 0,
        isError,
        isLoading,
        refetch
    };
}

// ========================================================================
// HOOK: Get Product Price
// ========================================================================
export function useProductPrice(productId) {
    const { data, isError, isLoading, refetch } = useReadContract({
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: 'getProductPrice',
        args: productId !== undefined ? [productId] : undefined,
        enabled: productId !== undefined
    });

    return {
        price: data ? data.toString() : '0',
        isError,
        isLoading,
        refetch
    };
}

// ========================================================================
// HOOK: Create Product (Vendor only)
// ========================================================================
export function useCreateProduct() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const createProduct = async (price, metadataCID) => {
        return writeContract({
            address: CONTRACTS.MARKETPLACE,
            abi: MARKETPLACE_ABI,
            functionName: 'createProduct',
            args: [price, metadataCID]
        });
    };

    return {
        createProduct,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Buy Product
// ========================================================================
export function useBuyProduct() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const buyProduct = async (productId) => {
        return writeContract({
            address: CONTRACTS.MARKETPLACE,
            abi: MARKETPLACE_ABI,
            functionName: 'buyProduct',
            args: [productId]
        });
    };

    return {
        buyProduct,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Check if user is Admin
// ========================================================================
export function useIsAdmin(address) {
    const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'; // DEFAULT_ADMIN_ROLE

    const { data, isError, isLoading, refetch } = useReadContract({
        address: CONTRACTS.CORE,
        abi: CORE_ABI,
        functionName: 'hasRole',
        args: address ? [ADMIN_ROLE, address] : undefined,
        enabled: !!address
    });

    return {
        isAdmin: data || false,
        isError,
        isLoading,
        refetch
    };
}

// ========================================================================
// HOOK: Create NFT Offer
// ========================================================================
export function useCreateNFTOffer() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const createOffer = async (nftContract, tokenId, amount) => {
        return writeContract({
            address: CONTRACTS.NFT_OFFERS,
            abi: NFT_OFFERS_ABI,
            functionName: 'createOffer',
            args: [nftContract, tokenId, amount]
        });
    };

    return {
        createOffer,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Accept NFT Offer
// ========================================================================
export function useAcceptNFTOffer() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const acceptOffer = async (offerId) => {
        return writeContract({
            address: CONTRACTS.NFT_OFFERS,
            abi: NFT_OFFERS_ABI,
            functionName: 'acceptOffer',
            args: [offerId]
        });
    };

    return {
        acceptOffer,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: List NFT for Rent
// ========================================================================
export function useListNFTForRent() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const listNFT = async (nftContract, tokenId, pricePerDay, maxRentalDays) => {
        return writeContract({
            address: CONTRACTS.NFT_RENTAL,
            abi: NFT_RENTAL_ABI,
            functionName: 'listNFT',
            args: [nftContract, tokenId, pricePerDay, maxRentalDays]
        });
    };

    return {
        listNFT,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Rent NFT
// ========================================================================
export function useRentNFT() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const rentNFT = async (listingId, rentalDays) => {
        return writeContract({
            address: CONTRACTS.NFT_RENTAL,
            abi: NFT_RENTAL_ABI,
            functionName: 'rentNFT',
            args: [listingId, rentalDays]
        });
    };

    return {
        rentNFT,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Stake BEZ Tokens (Farming)
// ========================================================================
export function useStakeBEZ() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const stake = async (amount) => {
        return writeContract({
            address: CONTRACTS.LIQUIDITY_FARMING,
            abi: FARMING_ABI,
            functionName: 'stake',
            args: [amount]
        });
    };

    return {
        stake,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Unstake BEZ Tokens (Farming)
// ========================================================================
export function useUnstakeBEZ() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const unstake = async (amount) => {
        return writeContract({
            address: CONTRACTS.LIQUIDITY_FARMING,
            abi: FARMING_ABI,
            functionName: 'unstake',
            args: [amount]
        });
    };

    return {
        unstake,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Get User Stake Amount
// ========================================================================
export function useUserStake(address) {
    const { data, isError, isLoading, refetch } = useReadContract({
        address: CONTRACTS.LIQUIDITY_FARMING,
        abi: FARMING_ABI,
        functionName: 'getUserStake',
        args: address ? [address] : undefined,
        enabled: !!address
    });

    return {
        stake: data ? data.toString() : '0',
        isError,
        isLoading,
        refetch
    };
}

// ========================================================================
// HOOK: Get Pending Farming Rewards
// ========================================================================
export function usePendingRewards(address) {
    const { data, isError, isLoading, refetch } = useReadContract({
        address: CONTRACTS.LIQUIDITY_FARMING,
        abi: FARMING_ABI,
        functionName: 'getPendingRewards',
        args: address ? [address] : undefined,
        enabled: !!address
    });

    return {
        rewards: data ? data.toString() : '0',
        isError,
        isLoading,
        refetch
    };
}

// ========================================================================
// HOOK: Claim Farming Rewards
// ========================================================================
export function useClaimRewards() {
    const { writeContract, data: hash, isLoading, isSuccess, error } = useWriteContract();

    const claimRewards = async () => {
        return writeContract({
            address: CONTRACTS.LIQUIDITY_FARMING,
            abi: FARMING_ABI,
            functionName: 'claimRewards'
        });
    };

    return {
        claimRewards,
        hash,
        isLoading,
        isSuccess,
        error
    };
}

// ========================================================================
// HOOK: Combined Wallet Info (Address + Balance + Network)
// ========================================================================
export function useWalletInfo() {
    const { address, isConnected, chain } = useAccount();
    const { data: maticBalance } = useBalance({ address });
    const { balance: bezBalance } = useBezBalance(address);

    return {
        address,
        isConnected,
        chain,
        maticBalance: maticBalance ? maticBalance.formatted : '0',
        bezBalance
    };
}
