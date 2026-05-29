/**
 * @deprecated — LEGACY SERVICE. DO NOT USE FOR NEW CODE.
 * ═══════════════════════════════════════════════════════
 * Replaced by:
 *   - hubBlockchainService.js (Hub Control Plane)
 *   - _shared/bezhas-blockchain-client.js (all SubApps)
 * Issues: Uses OBSOLETE address 0xE65F...5744 on Polygon 137.
 * Real production token: 0xEcBa873B...A8 on BSC (56).
 * @see hubBlockchainService.js
 * ═══════════════════════════════════════════════════════
 *
 * BEZ-Coin Service (LEGACY)
 * Contrato: 0xE65F6B8ADbcd604dBCbb826b5792D17e2FD95744
 * Red: Polygon Mainnet (Chain ID: 137)
 */

import { ethers } from 'ethers';
import { bezCoinAbi, networks } from '../lib/blockchain/contracts';
import { BEZ_COIN_ADDRESS } from '../config/contracts';

// Información del token
export const BEZ_COIN_INFO = {
    name: 'BEZ-Coin',
    symbol: 'BEZ',
    decimals: 18,
    totalSupply: '3000000000', // 3 mil millones
    address: BEZ_COIN_ADDRESS,
    network: 'Polygon',
    chainId: 137,
    explorer: `https://polygonscan.com/token/${BEZ_COIN_ADDRESS}`,
    features: ['ERC20', 'Burnable', 'Pausable', 'Permit', 'Ownable'],
    version: '2.0', // Nuevo contrato corregido
    deployDate: '2025-12-09'
};/**
 * Obtener instancia del contrato BEZ-Coin
 * @param {Object} provider - Provider de ethers
 * @param {boolean} withSigner - Si se necesita signer para transacciones
 * @returns {ethers.Contract} Instancia del contrato
 */
export const getBEZCoinContract = async (provider, withSigner = false) => {
    try {
        if (!provider) {
            throw new Error('Provider no disponible');
        }

        // Verificar que estamos en Polygon
        const network = await provider.getNetwork();
        if (network.chainId !== 137 && network.chainId !== 80001) {
            console.warn('Advertencia: No estás en Polygon. Cambia de red para usar BEZ-Coin.');
        }

        if (withSigner) {
            const signer = await provider.getSigner();
            return new ethers.Contract(BEZ_COIN_ADDRESS, bezCoinAbi, signer);
        }

        return new ethers.Contract(BEZ_COIN_ADDRESS, bezCoinAbi, provider);
    } catch (error) {
        console.error('Error al obtener contrato BEZ-Coin:', error);
        throw error;
    }
};

/**
 * Obtener balance de BEZ de una dirección
 * @param {string} address - Dirección de wallet
 * @param {Object} provider - Provider de ethers
 * @returns {Object} Balance formateado
 */
export const getBEZBalance = async (address, provider) => {
    try {
        const contract = await getBEZCoinContract(provider);
        const balance = await contract.balanceOf(address);
        const balanceFormatted = ethers.formatEther(balance);

        return {
            raw: balance.toString(),
            formatted: balanceFormatted,
            display: parseFloat(balanceFormatted).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
            }),
            symbol: 'BEZ'
        };
    } catch (error) {
        console.error('Error al obtener balance BEZ:', error);
        return {
            raw: '0',
            formatted: '0',
            display: '0.00',
            symbol: 'BEZ'
        };
    }
};

/**
 * Transferir BEZ a otra dirección
 * @param {string} toAddress - Dirección destino
 * @param {string} amount - Cantidad en BEZ (formato legible)
 * @param {Object} provider - Provider con signer
 * @returns {Object} Resultado de la transacción
 */
export const transferBEZ = async (toAddress, amount, provider) => {
    try {
        const contract = await getBEZCoinContract(provider, true);

        // Validar dirección
        if (!ethers.isAddress(toAddress)) {
            throw new Error('Dirección destino inválida');
        }

        // Convertir cantidad a wei
        const amountWei = ethers.parseEther(amount);

        // Enviar transacción
        const tx = await contract.transfer(toAddress, amountWei);

        console.log('Transacción enviada:', tx.hash);

        // Esperar confirmación
        const receipt = await tx.wait();

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            explorerUrl: `https://polygonscan.com/tx/${receipt.hash}`,
            amount: amount,
            to: toAddress
        };
    } catch (error) {
        console.error('Error al transferir BEZ:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Aprobar gasto de BEZ para un contrato
 * @param {string} spenderAddress - Dirección del contrato autorizado
 * @param {string} amount - Cantidad a aprobar (formato legible)
 * @param {Object} provider - Provider con signer
 * @returns {Object} Resultado de la aprobación
 */
export const approveBEZ = async (spenderAddress, amount, provider) => {
    try {
        const contract = await getBEZCoinContract(provider, true);

        // Convertir cantidad a wei
        const amountWei = ethers.parseEther(amount);

        // Aprobar
        const tx = await contract.approve(spenderAddress, amountWei);

        console.log('Aprobación enviada:', tx.hash);

        const receipt = await tx.wait();

        return {
            success: true,
            txHash: receipt.hash,
            explorerUrl: `https://polygonscan.com/tx/${receipt.hash}`,
            amount: amount,
            spender: spenderAddress
        };
    } catch (error) {
        console.error('Error al aprobar BEZ:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener allowance aprobado
 * @param {string} ownerAddress - Dirección del dueño
 * @param {string} spenderAddress - Dirección del gastador
 * @param {Object} provider - Provider
 * @returns {Object} Allowance formateado
 */
export const getAllowance = async (ownerAddress, spenderAddress, provider) => {
    try {
        const contract = await getBEZCoinContract(provider);
        const allowance = await contract.allowance(ownerAddress, spenderAddress);
        const allowanceFormatted = ethers.formatEther(allowance);

        return {
            raw: allowance.toString(),
            formatted: allowanceFormatted,
            display: parseFloat(allowanceFormatted).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
            })
        };
    } catch (error) {
        console.error('Error al obtener allowance:', error);
        return {
            raw: '0',
            formatted: '0',
            display: '0.00'
        };
    }
};

/**
 * Quemar tokens BEZ
 * @param {string} amount - Cantidad a quemar
 * @param {Object} provider - Provider con signer
 * @returns {Object} Resultado de la quema
 */
export const burnBEZ = async (amount, provider) => {
    try {
        const contract = await getBEZCoinContract(provider, true);
        const amountWei = ethers.parseEther(amount);

        const tx = await contract.burn(amountWei);
        const receipt = await tx.wait();

        return {
            success: true,
            txHash: receipt.hash,
            explorerUrl: `https://polygonscan.com/tx/${receipt.hash}`,
            burned: amount
        };
    } catch (error) {
        console.error('Error al quemar BEZ:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener información completa del token
 * @param {Object} provider - Provider
 * @returns {Object} Información del token
 */
export const getTokenInfo = async (provider) => {
    try {
        const contract = await getBEZCoinContract(provider);

        const [name, symbol, decimals, totalSupply, paused] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.decimals(),
            contract.totalSupply(),
            contract.paused()
        ]);

        return {
            name,
            symbol,
            decimals: Number(decimals),
            totalSupply: ethers.formatEther(totalSupply),
            totalSupplyDisplay: parseFloat(ethers.formatEther(totalSupply)).toLocaleString('en-US'),
            paused,
            address: BEZ_COIN_ADDRESS,
            network: 'Polygon',
            chainId: 137
        };
    } catch (error) {
        console.error('Error al obtener información del token:', error);
        return BEZ_COIN_INFO;
    }
};

/**
 * Verificar si el usuario está en la red correcta (Polygon)
 * @param {Object} provider - Provider
 * @returns {Object} Estado de la red
 */
export const checkNetwork = async (provider) => {
    try {
        if (!provider) {
            return {
                isCorrectNetwork: false,
                currentChainId: null,
                requiredChainId: 137,
                networkName: 'Desconocida'
            };
        }

        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        return {
            isCorrectNetwork: chainId === 137 || chainId === 80001, // Mainnet o Mumbai testnet
            currentChainId: chainId,
            requiredChainId: 137,
            networkName: chainId === 137 ? 'Polygon' : chainId === 80001 ? 'Polygon Mumbai' : 'Otra red'
        };
    } catch (error) {
        console.error('Error al verificar red:', error);
        return {
            isCorrectNetwork: false,
            currentChainId: null,
            requiredChainId: 137,
            networkName: 'Error'
        };
    }
};

/**
 * Cambiar a la red Polygon
 * @returns {Promise<boolean>} True si se cambió exitosamente
 */
export const switchToPolygon = async () => {
    try {
        if (!window.ethereum) {
            throw new Error('MetaMask no instalado');
        }

        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: networks.polygon.chainIdHex }],
        });

        return true;
    } catch (error) {
        // Si la red no está agregada, intentar agregarla
        if (error.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: networks.polygon.chainIdHex,
                        chainName: networks.polygon.name,
                        nativeCurrency: networks.polygon.nativeCurrency,
                        rpcUrls: [networks.polygon.rpcUrl],
                        blockExplorerUrls: [networks.polygon.blockExplorer]
                    }]
                });
                return true;
            } catch (addError) {
                console.error('Error al agregar Polygon:', addError);
                return false;
            }
        }
        console.error('Error al cambiar a Polygon:', error);
        return false;
    }
};

/**
 * Agregar BEZ-Coin a MetaMask
 * @returns {Promise<boolean>} True si se agregó exitosamente
 */
export const addBEZToWallet = async () => {
    try {
        if (!window.ethereum) {
            throw new Error('MetaMask no instalado');
        }

        const wasAdded = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: BEZ_COIN_ADDRESS,
                    symbol: 'BEZ',
                    decimals: 18,
                    image: 'https://bez.digital/logo-bez.png', // Cambia por tu logo
                },
            },
        });

        return wasAdded;
    } catch (error) {
        console.error('Error al agregar BEZ a wallet:', error);
        return false;
    }
};

// Exportar todo como objeto por defecto
export default {
    BEZ_COIN_INFO,
    getBEZCoinContract,
    getBEZBalance,
    transferBEZ,
    approveBEZ,
    getAllowance,
    burnBEZ,
    getTokenInfo,
    checkNetwork,
    switchToPolygon,
    addBEZToWallet
};
