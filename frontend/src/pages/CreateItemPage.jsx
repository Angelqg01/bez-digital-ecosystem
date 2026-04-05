import React, { useState } from 'react';
import { useBezCoin } from '../context/BezCoinContext';
import { LOGOS } from '../config/cryptoLogos';
// BuyBezCoinModal -> useBezPay().openBuyBez()
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { mintNFT } from '../services/nftService';
import { createListing } from '../services/marketplaceService';
import { Spinner } from '../components/ui/Spinner';
import { toast } from 'react-hot-toast';

const CreateItemPage = () => {
  const { address, contracts } = useWeb3();
  const { balance, showBuyModal, setShowBuyModal, verifyAndProceed } = useBezCoin();
  const [tokenURI, setTokenURI] = useState('');
  const [price, setPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const marketplaceContract = contracts.marketplace;
  const nftContract = contracts.bezhasNFT; // Assuming bezhasNFT is the contract to mint from

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tokenURI || parseFloat(price) <= 0) {
      return toast.error('Please provide a valid metadata URI and price.');
    }
    if (!address || !marketplaceContract || !nftContract) {
      return toast.error('Please connect your wallet and ensure contracts are loaded.');
    }

    // Verificar saldo BEZ antes de mintear/listar
    const hasFunds = await verifyAndProceed(price, 'crear NFT', async () => {
      /* BezPayModal auto-cierra */;
      // Reintentar tras comprar BEZ
      handleSubmit(e);
    });
    if (!hasFunds) {
      return; // El modal de compra se mostrará automáticamente
    }

    setIsLoading(true);
    try {
      // Step 1: Mint the NFT
      const newTokenId = await mintNFT(nftContract, address, tokenURI);

      if (newTokenId === null) {
        throw new Error('Minting failed, so listing was not created.');
      }

      // Step 2: List the newly minted NFT
      await createListing(marketplaceContract, nftContract, newTokenId, price);

      // On success, navigate to the marketplace to see the new listing
      navigate('/marketplace');

    } catch (error) {
      console.error('Failed to create and list item:', error);
      // Error toasts are already handled in the services
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <img src={LOGOS.bezcoin} alt="BEZ-Coin" className="w-10 h-10 rounded-full" />
        Crear y Listar un Nuevo NFT
      </h1>
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <div className="mb-4">
          <label htmlFor="tokenURI" className="block text-sm font-medium mb-1">Token Metadata URI</label>
          <input
            id="tokenURI"
            type="text"
            value={tokenURI}
            onChange={(e) => setTokenURI(e.target.value)}
            placeholder="ipfs://... or https://..."
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
          />
        </div>
        <div className="mb-6">
          <label htmlFor="price" className="block text-sm font-medium mb-1 flex items-center gap-2">
            Precio (en BEZ)
            <img src={LOGOS.bezcoin} alt="BEZ-Coin" className="w-5 h-5 rounded-full inline-block" />
          </label>
          <input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.0"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
          />
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            Saldo actual: <span className="font-bold">{parseFloat(balance).toFixed(2)} BEZ</span>
            <button
              type="button"
              className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-semibold"
              onClick={() => openBuyBez()}
            >
              Comprar BEZ-Coin
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-500 text-white p-3 rounded-lg disabled:opacity-50 flex justify-center items-center"
        >
          {isLoading ? <Spinner size="sm" /> : 'Mint and List Item'}
        </button>
      </form>
      <BuyBezCoinModal isOpen={showBuyModal} onClose={() => {}} />
    </div>
  );
};

export default CreateItemPage;
