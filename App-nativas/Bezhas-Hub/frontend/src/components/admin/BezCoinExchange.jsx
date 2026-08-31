import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { LOGOS } from '../../config/cryptoLogos';
import BezhasTokenABI from '../../lib/blockchain/abis/BezhasToken.json';
import { BEZ_COIN_ADDRESS as MAINNET_BEZ_ADDRESS } from '../../config/contracts';

// Configuración de contrato y red (Polygon)
const POLYGON_CHAIN_ID = '0x89'; // Mainnet Polygon

// Usar dirección de contrato desde .env o config
const BEZ_COIN_ADDRESS = import.meta.env.VITE_BEZ_COIN_ADDRESS || MAINNET_BEZ_ADDRESS;
const BEZ_COIN_ABI = BezhasTokenABI;

// Modo demo si no hay variables configuradas
const DEMO_MODE = !import.meta.env.VITE_BEZ_COIN_ADDRESS;

export default function BezCoinExchange() {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [account, setAccount] = useState('');
    const [bezBalance, setBezBalance] = useState('0');
    const [maticBalance, setMaticBalance] = useState('0');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [networkOk, setNetworkOk] = useState(false);
    const [error, setError] = useState('');

    // Conectar wallet y detectar red
    useEffect(() => {
        if (!window.ethereum) return;
        const eth = window.ethereum;
        const connect = async () => {
            try {
                const prov = new ethers.BrowserProvider(eth);
                setProvider(prov);
                const [addr] = await eth.request({ method: 'eth_requestAccounts' });
                setAccount(addr);
                const signer = await prov.getSigner();
                setSigner(signer);
                const { chainId } = await prov.getNetwork();
                setNetworkOk(chainId === parseInt(POLYGON_CHAIN_ID, 16));
            } catch (e) {
                setError('No se pudo conectar la wallet.');
            }
        };
        connect();
        eth.on('chainChanged', () => window.location.reload());
        eth.on('accountsChanged', () => window.location.reload());
    }, []);

    // Cargar balances
    useEffect(() => {
        if (!signer || !account || !networkOk) return;
        const loadBalances = async () => {
            try {
                const bez = new ethers.Contract(BEZ_COIN_ADDRESS, BEZ_COIN_ABI, signer);
                const bezBal = await bez.balanceOf(account);
                setBezBalance(ethers.formatUnits(bezBal, 18));
                const maticBal = await provider.getBalance(account);
                setMaticBalance(ethers.formatUnits(maticBal, 18));
            } catch (e) {
                setError('Error al cargar balances.');
            }
        };
        loadBalances();
    }, [signer, account, networkOk, provider]);

    // Cambiar a Polygon si no está
    const switchToPolygon = async () => {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: POLYGON_CHAIN_ID }],
            });
        } catch (e) {
            setError('No se pudo cambiar a la red Polygon.');
        }
    };

    // Comprar BEZ-Coin (enviar MATIC, recibir BEZ)
    const handleBuy = async () => {
        setLoading(true);
        setError('');
        try {
            // Suponiendo que el contrato tiene un método buy() pagadero
            const bez = new ethers.Contract(BEZ_COIN_ADDRESS, BEZ_COIN_ABI, signer);
            const tx = await signer.sendTransaction({
                to: BEZ_COIN_ADDRESS,
                value: ethers.parseEther(amount),
            });
            await tx.wait();
            setAmount('');
        } catch (e) {
            setError('Error al comprar BEZ-Coin.');
        }
        setLoading(false);
    };

    // Vender BEZ-Coin (enviar BEZ, recibir MATIC)
    const handleSell = async () => {
        setLoading(true);
        setError('');
        try {
            // Suponiendo que el contrato tiene un método sell(uint256 amount)
            const bez = new ethers.Contract(BEZ_COIN_ADDRESS, BEZ_COIN_ABI, signer);
            const tx = await bez.sell(ethers.parseUnits(amount, 18));
            await tx.wait();
            setAmount('');
        } catch (e) {
            setError('Error al vender BEZ-Coin.');
        }
        setLoading(false);
    };

    return (
        <div className="bg-gray-900 rounded-xl p-6 max-w-md mx-auto mt-8 shadow-lg">
            {DEMO_MODE && (
                <div className="bg-yellow-900 border border-yellow-600 text-yellow-200 rounded-lg p-3 mb-4 text-sm">
                    <strong>🔧 Modo Demo:</strong> Usando configuración local de desarrollo.
                    Para producción, configura <code>VITE_BEZ_COIN_ADDRESS</code> en tu archivo .env
                </div>
            )}
            <div className="flex items-center gap-3 mb-4">
                <img src={LOGOS.bezcoin} alt="BEZ-Coin" style={{ width: 40, height: 40, borderRadius: 12 }} />
                <h2 className="text-2xl font-bold text-yellow-400">BEZ-Coin Exchange</h2>
            </div>
            {!window.ethereum && <p className="text-red-500">Conecta una wallet compatible con Polygon.</p>}
            {error && <p className="text-red-500 mb-2">{error}</p>}
            {account && (
                <div className="mb-4 text-sm text-gray-300">
                    <div>Wallet: <span className="font-mono">{account}</span></div>
                    <div>BEZ: <span className="font-bold text-yellow-300">{bezBalance}</span></div>
                    <div>MATIC: <span className="font-bold text-blue-300">{maticBalance}</span></div>
                </div>
            )}
            {!networkOk && window.ethereum && (
                <button onClick={switchToPolygon} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">Cambiar a Polygon</button>
            )}
            <div className="flex gap-2 mb-2">
                <img src={LOGOS.polygon} alt="Polygon" style={{ width: 28, height: 28 }} />
                <input
                    type="number"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="flex-1 px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
                    placeholder="Cantidad"
                    disabled={!networkOk || loading}
                />
            </div>
            <div className="flex gap-2">
                <button
                    onClick={handleBuy}
                    disabled={!networkOk || loading || !amount}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex-1"
                >Comprar BEZ</button>
                <button
                    onClick={handleSell}
                    disabled={!networkOk || loading || !amount}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex-1"
                >Vender BEZ</button>
            </div>
            <div className="mt-4 flex gap-2 items-center">
                <img src={LOGOS.ethereum} alt="Ethereum" style={{ width: 24, height: 24 }} />
                <img src={LOGOS.bitcoin} alt="Bitcoin" style={{ width: 24, height: 24 }} />
                <img src={LOGOS.polygon} alt="Polygon" style={{ width: 24, height: 24 }} />
                <img src={LOGOS.bezcoin} alt="BEZ-Coin" style={{ width: 24, height: 24, borderRadius: 6 }} />
            </div>
        </div>
    );
}
