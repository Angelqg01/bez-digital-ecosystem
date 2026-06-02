import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import {
    useWalletInfo,
    useBezBalance,
    useIsVendor,
    useIsAdmin,
    useProductCount,
    useCreateProduct,
    useBuyProduct,
    useStakeBEZ,
    useUnstakeBEZ,
    useUserStake,
    usePendingRewards,
    useClaimRewards
} from '../hooks/useBeZhasContracts';
import { formatTokenBalance, shortenAddress, getExplorerUrl, parseTokenAmount } from '../config/web3';

/**
 * Componente de ejemplo que muestra cómo interactuar con los contratos de BeZhas
 * Este componente demuestra:
 * - Conexión de wallet
 * - Lectura de balances (MATIC y BEZ)
 * - Verificación de roles (Vendor, Admin)
 * - Interacción con Marketplace
 * - Staking/Farming
 */
export default function BlockchainDemo() {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    const {
        address: walletAddress,
        maticBalance,
        bezBalance,
        chain
    } = useWalletInfo();

    const { isVendor } = useIsVendor(address);
    const { isAdmin } = useIsAdmin(address);
    const { count: productCount } = useProductCount();
    const { stake: userStake } = useUserStake(address);
    const { rewards: pendingRewards } = usePendingRewards(address);

    // Estados para formularios
    const [productPrice, setProductPrice] = useState('');
    const [productCID, setProductCID] = useState('');
    const [productIdToBuy, setProductIdToBuy] = useState('');
    const [stakeAmount, setStakeAmount] = useState('');
    const [unstakeAmount, setUnstakeAmount] = useState('');

    // Hooks de escritura
    const { createProduct, isLoading: isCreatingProduct, isSuccess: productCreated } = useCreateProduct();
    const { buyProduct, isLoading: isBuyingProduct, isSuccess: productBought } = useBuyProduct();
    const { stake, isLoading: isStaking, isSuccess: stakeSuccess } = useStakeBEZ();
    const { unstake, isLoading: isUnstaking, isSuccess: unstakeSuccess } = useUnstakeBEZ();
    const { claimRewards, isLoading: isClaiming, isSuccess: claimSuccess } = useClaimRewards();

    // Handlers
    const handleCreateProduct = async () => {
        try {
            const priceInWei = parseTokenAmount(productPrice);
            await createProduct(priceInWei, productCID);
        } catch (error) {
            console.error('Error creating product:', error);
        }
    };

    const handleBuyProduct = async () => {
        try {
            await buyProduct(Number(productIdToBuy));
        } catch (error) {
            console.error('Error buying product:', error);
        }
    };

    const handleStake = async () => {
        try {
            const amountInWei = parseTokenAmount(stakeAmount);
            await stake(amountInWei);
        } catch (error) {
            console.error('Error staking:', error);
        }
    };

    const handleUnstake = async () => {
        try {
            const amountInWei = parseTokenAmount(unstakeAmount);
            await unstake(amountInWei);
        } catch (error) {
            console.error('Error unstaking:', error);
        }
    };

    const handleClaimRewards = async () => {
        try {
            await claimRewards();
        } catch (error) {
            console.error('Error claiming rewards:', error);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold text-center mb-8">
                BeZhas Blockchain Integration Demo
            </h1>

            {/* Wallet Connection */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>

                {!isConnected ? (
                    <div className="space-y-2">
                        {connectors.map((connector) => (
                            <button
                                key={connector.id}
                                onClick={() => connect({ connector })}
                                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                Connect with {connector.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p><strong>Address:</strong> {shortenAddress(walletAddress)}</p>
                        <p><strong>Network:</strong> {chain?.name || 'Unknown'}</p>
                        <p><strong>MATIC Balance:</strong> {maticBalance} MATIC</p>
                        <p><strong>BEZ Balance:</strong> {formatTokenBalance(bezBalance)} BEZ</p>
                        <p><strong>Is Vendor:</strong> {isVendor ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>Is Admin:</strong> {isAdmin ? '✅ Yes' : '❌ No'}</p>
                        <button
                            onClick={() => disconnect()}
                            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                            Disconnect
                        </button>
                    </div>
                )}
            </div>

            {isConnected && (
                <>
                    {/* Marketplace Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4">Marketplace</h2>
                        <p className="mb-4"><strong>Total Products:</strong> {productCount}</p>

                        {/* Create Product (Vendor only) */}
                        {isVendor && (
                            <div className="border-t pt-4 mt-4">
                                <h3 className="font-semibold mb-2">Create Product</h3>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Price in BEZ"
                                        value={productPrice}
                                        onChange={(e) => setProductPrice(e.target.value)}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                    <input
                                        type="text"
                                        placeholder="IPFS Metadata CID"
                                        value={productCID}
                                        onChange={(e) => setProductCID(e.target.value)}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                    <button
                                        onClick={handleCreateProduct}
                                        disabled={isCreatingProduct}
                                        className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                    >
                                        {isCreatingProduct ? 'Creating...' : 'Create Product'}
                                    </button>
                                    {productCreated && (
                                        <p className="text-green-600">✅ Product created successfully!</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Buy Product */}
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-2">Buy Product</h3>
                            <div className="space-y-2">
                                <input
                                    type="number"
                                    placeholder="Product ID"
                                    value={productIdToBuy}
                                    onChange={(e) => setProductIdToBuy(e.target.value)}
                                    className="w-full px-3 py-2 border rounded"
                                />
                                <button
                                    onClick={handleBuyProduct}
                                    disabled={isBuyingProduct}
                                    className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                >
                                    {isBuyingProduct ? 'Buying...' : 'Buy Product'}
                                </button>
                                {productBought && (
                                    <p className="text-green-600">✅ Product purchased successfully!</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Farming/Staking Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4">Liquidity Farming</h2>
                        <div className="space-y-2 mb-4">
                            <p><strong>Your Stake:</strong> {formatTokenBalance(userStake)} BEZ</p>
                            <p><strong>Pending Rewards:</strong> {formatTokenBalance(pendingRewards)} BEZ</p>
                        </div>

                        {/* Stake */}
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-2">Stake BEZ</h3>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="Amount to stake"
                                    value={stakeAmount}
                                    onChange={(e) => setStakeAmount(e.target.value)}
                                    className="w-full px-3 py-2 border rounded"
                                />
                                <button
                                    onClick={handleStake}
                                    disabled={isStaking}
                                    className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                                >
                                    {isStaking ? 'Staking...' : 'Stake'}
                                </button>
                                {stakeSuccess && (
                                    <p className="text-green-600">✅ Staked successfully!</p>
                                )}
                            </div>
                        </div>

                        {/* Unstake */}
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-2">Unstake BEZ</h3>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="Amount to unstake"
                                    value={unstakeAmount}
                                    onChange={(e) => setUnstakeAmount(e.target.value)}
                                    className="w-full px-3 py-2 border rounded"
                                />
                                <button
                                    onClick={handleUnstake}
                                    disabled={isUnstaking}
                                    className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                                >
                                    {isUnstaking ? 'Unstaking...' : 'Unstake'}
                                </button>
                                {unstakeSuccess && (
                                    <p className="text-green-600">✅ Unstaked successfully!</p>
                                )}
                            </div>
                        </div>

                        {/* Claim Rewards */}
                        <div className="border-t pt-4 mt-4">
                            <button
                                onClick={handleClaimRewards}
                                disabled={isClaiming}
                                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                            >
                                {isClaiming ? 'Claiming...' : 'Claim Rewards'}
                            </button>
                            {claimSuccess && (
                                <p className="text-green-600">✅ Rewards claimed successfully!</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
