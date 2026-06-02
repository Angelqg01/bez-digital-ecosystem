import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import useUserStore from '../../stores/userStore';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import { ArrowDown } from 'lucide-react';
import bezTokenImg from '../../assets/bez_token.png';

const SwapInput = ({ token, amount, onAmountChange, balance }) => (
  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
    <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
      <span>{token.name === 'BEZ' ? 'Vendes' : 'Recibes (Estimado)'}</span>
      <span>Balance: {balance ? parseFloat(balance).toFixed(4) : '0.0'}</span>
    </div>
    <div className="flex items-center gap-4 mt-2">
      <input
        type="number"
        value={amount}
        onChange={onAmountChange}
        placeholder="0.0"
        className="w-full bg-transparent text-3xl font-mono focus:outline-none text-gray-900 dark:text-white"
        disabled={token.name !== 'BEZ'}
      />
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-full flex-shrink-0 shadow-sm border border-gray-200 dark:border-gray-700">
        <img src={token.logo} alt={token.name} className="w-6 h-6 rounded-full" />
        <span className="font-semibold text-gray-900 dark:text-white">{token.name}</span>
      </div>
    </div>
  </div>
);

const SwapPage = () => {
  const { address, isConnected, provider } = useWeb3();
  const { tokenBalance: bezBalanceFormatted } = useUserStore();

  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [ethBalance, setEthBalance] = useState('0');

  // Simulación de precio: 1 ETH = 1500 BEZ
  const ETH_PRICE_IN_BEZ = 1500;

  useEffect(() => {
    if (amountIn && parseFloat(amountIn) > 0) {
      setAmountOut((parseFloat(amountIn) / ETH_PRICE_IN_BEZ).toFixed(6));
    } else {
      setAmountOut('');
    }
  }, [amountIn]);

  // Obtener el balance de ETH
  useEffect(() => {
    const fetchEthBalance = async () => {
      if (isConnected && provider && address) {
        try {
          const balance = await provider.getBalance(address);
          setEthBalance(ethers.formatEther(balance));
        } catch (error) {
          console.error("Error al obtener el balance de ETH:", error);
        }
      }
    };
    fetchEthBalance();
  }, [isConnected, provider, address]);

  const handleSwap = () => {
    toast.error('Funcionalidad de Swap no implementada. Se necesita un contrato de Router.');
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <ArrowDown size={64} className="text-purple-600 dark:text-purple-400 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Intercambio de Tokens</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Conecta tu billetera para intercambiar tokens.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Intercambio (Swap)</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Intercambia BEZ y otros tokens de forma descentralizada.</p>
      </header>

      <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl space-y-4 border border-gray-200 dark:border-gray-700 shadow-sm">
        <SwapInput
          token={{ name: 'BEZ', logo: bezTokenImg }}
          amount={amountIn}
          onAmountChange={(e) => setAmountIn(e.target.value)}
          balance={bezBalanceFormatted}
        />
        <div className="flex justify-center -my-2 z-10">
          <button className="p-2 bg-white dark:bg-gray-800 rounded-full border-4 border-gray-50 dark:border-gray-900 shadow-sm text-gray-600 dark:text-gray-400">
            <ArrowDown size={20} />
          </button>
        </div>
        <SwapInput
          token={{ name: 'ETH', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png' }}
          amount={amountOut}
          onAmountChange={() => { }} // El output no se puede cambiar directamente
          balance={ethBalance}
        />
        <button onClick={handleSwap} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-xl text-lg hover:opacity-90 transition-opacity shadow-md">
          Swap
        </button>
      </div>
    </div>
  );
};

export default SwapPage;
