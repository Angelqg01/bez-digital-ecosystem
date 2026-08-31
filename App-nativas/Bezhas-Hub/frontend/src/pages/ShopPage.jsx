import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useBezCoin } from '../context/BezCoinContext';
import { useBezPay } from '../context/BezPayContext';
import { NFTGrid } from '../components/shop/NFTGrid';
import { Link } from 'react-router-dom';
import { PlusCircle, Search } from 'lucide-react';
import { FaCoins } from 'react-icons/fa';
import InsufficientFundsModal from '../components/modals/InsufficientFundsModal';

const LISTINGS_PER_PAGE = 12;

const ShopPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalListings, setTotalListings] = useState(0);
  const [isLoadingTotal, setIsLoadingTotal] = useState(true);
  const { marketplace, isConnected } = useWeb3();
  const {
    balance,
    insufficientFundsModal,
    setInsufficientFundsModal
  } = useBezCoin();
  const { openBuyBez } = useBezPay();

  useEffect(() => {
    const fetchTotalListings = async () => {
      if (!isConnected || !marketplace) return;
      setIsLoadingTotal(true);
      try {
        const nextId = await marketplace.nextListingId();
        setTotalListings(Number(nextId));
      } catch (error) {
        console.error("Error al obtener el total de listados:", error);
        setTotalListings(0);
      } finally {
        setIsLoadingTotal(false);
      }
    };
    fetchTotalListings();
    // Refrescar cada 30 segundos
    const interval = setInterval(fetchTotalListings, 30000);
    return () => clearInterval(interval);
  }, [isConnected, marketplace]);

  const totalPages = Math.ceil(totalListings / LISTINGS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * LISTINGS_PER_PAGE;
  // Ensure we don't go out of bounds
  const endIndex = Math.min(startIndex + LISTINGS_PER_PAGE, totalListings);

  // Generate IDs for the current page (assuming 0-based indexing from contract)
  // If contract uses 1-based, this should be (startIndex + 1 + i)
  const listingIds = totalListings > 0
    ? Array.from({ length: Math.max(0, endIndex - startIndex) }, (_, i) => BigInt(startIndex + i))
    : [];

  return (
    <div className="space-y-8">
      {/* Header with Balance */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-dark-text dark:text-light-text">Marketplace</h1>
          <p className="text-dark-text-muted dark:text-light-text-muted mt-1">Explora y colecciona NFTs únicos de la comunidad.</p>
        </div>

        {/* Balance Display */}
        {isConnected && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl shadow-lg">
              <FaCoins className="text-yellow-300" size={22} />
              <div>
                <p className="text-xs text-cyan-100">Tu Balance</p>
                <p className="text-lg font-bold">{parseFloat(balance).toFixed(2)} BEZ</p>
              </div>
            </div>
            <button
              onClick={() => openBuyBez()}
              className="px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              Comprar BEZ
            </button>
          </div>
        )}
      </header>

      {/* Filtros y Acciones */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center bg-dark-surface dark:bg-light-surface rounded-full px-4 py-2 w-full md:w-auto">
          <Search size={20} className="text-dark-text-muted dark:text-light-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre o ID..."
            className="bg-transparent focus:outline-none ml-3 text-dark-text dark:text-light-text placeholder-dark-text-muted dark:placeholder-light-text-muted w-full"
          />
        </div>
        <Link to="/shop/create" className="w-full md:w-auto">
          <button className="w-full bg-dark-primary dark:bg-light-primary text-white font-semibold py-3 px-6 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <PlusCircle size={20} />
            <span>Crear NFT</span>
          </button>
        </Link>
      </div>

      {/* Cuadrícula de NFTs */}
      <div>
        {isLoadingTotal ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(LISTINGS_PER_PAGE)].map((_, i) => <div key={i} className="bg-dark-surface dark:bg-light-surface rounded-2xl animate-pulse aspect-[3/4]"></div>)}
          </div>
        ) : (
          <NFTGrid listingIds={listingIds} />
        )}

        {/* Controles de Paginación */}
        {totalListings > LISTINGS_PER_PAGE && (
          <div className="flex justify-center items-center space-x-4 mt-12">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="bg-dark-surface dark:bg-light-surface px-4 py-2 rounded-full font-semibold disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="font-medium text-dark-text-muted dark:text-light-text-muted">Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="bg-dark-surface dark:bg-light-surface px-4 py-2 rounded-full font-semibold disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      <InsufficientFundsModal
        isOpen={insufficientFundsModal.show}
        onClose={() => setInsufficientFundsModal({ show: false, requiredAmount: 0, actionName: '', onPurchaseComplete: null })}
        requiredAmount={insufficientFundsModal.requiredAmount}
        currentBalance={balance}
        actionName={insufficientFundsModal.actionName}
        onPurchaseComplete={insufficientFundsModal.onPurchaseComplete}
      />
    </div>
  );
};

export default ShopPage;
