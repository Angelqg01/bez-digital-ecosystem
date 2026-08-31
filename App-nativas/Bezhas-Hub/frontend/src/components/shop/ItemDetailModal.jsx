import React, { useState } from 'react';
import { ethers } from 'ethers';
import { X, Star, User, ShoppingCart, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../context/AuthContext';
import './ShopComponents.css';

const ItemDetailModal = ({ item, onClose, marketplaceContract, bezhasTokenContract }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState(null);

  const handlePurchase = async () => {
    if (!user || !marketplaceContract || !bezhasTokenContract) {
      setPurchaseStatus({ type: 'error', message: 'Conecta tu wallet para continuar' });
      return;
    }

    setIsLoading(true);
    setPurchaseStatus({ type: 'info', message: 'Preparando transacción...' });

    try {
      const priceInWei = ethers.parseUnits(item.price.toString(), 18);
      const marketplaceAddress = await marketplaceContract.getAddress();

      // 1. Approve token spending
      setPurchaseStatus({ type: 'info', message: 'Aprobando gasto de tokens BEZ...' });
      const approveTx = await bezhasTokenContract.approve(marketplaceAddress, priceInWei);
      await approveTx.wait();

      // 2. Buy the item
      setPurchaseStatus({ type: 'info', message: 'Procesando compra...' });
      const buyTx = await marketplaceContract.buyItem(item.id);
      await buyTx.wait();

      setPurchaseStatus({
        type: 'success',
        message: `¡Compra exitosa! Has adquirido "${item.name}".`
      });

      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (error) {
      console.error("Purchase failed:", error);
      setPurchaseStatus({
        type: 'error',
        message: error.reason || 'La transacción falló. Revisa la consola para más detalles.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <Card className="item-detail-modal">
          <div className="modal-header">
            <h2>{item.name}</h2>
            <Button variant="secondary" onClick={onClose} className="close-button">
              <X size={20} />
            </Button>
          </div>

          <div className="modal-body">
            <div className="item-detail-image">
              <img src={item.image} alt={item.name} className="detail-image" />
            </div>

            <div className="item-detail-info">
              <div className="price-section">
                <span className="price-label">Precio:</span>
                <span className="price-value">{item.price} BEZ</span>
              </div>

              <div className="seller-section">
                <User size={16} />
                <span>Vendido por: <strong>{item.seller}</strong></span>
              </div>

              <div className="rating-section">
                <Star size={16} fill="currentColor" />
                <span>{item.rating} ({item.sales} ventas)</span>
              </div>

              <div className="description-section">
                <h3>Descripción</h3>
                <p>{item.description}</p>
              </div>

              {purchaseStatus && (
                <div className={`purchase-status ${purchaseStatus.type}`}>
                  <AlertCircle size={16} />
                  <span>{purchaseStatus.message}</span>
                </div>
              )}

              <div className="purchase-section">
                <Button
                  variant="primary"
                  onClick={handlePurchase}
                  disabled={isLoading}
                  className="purchase-button"
                >
                  <ShoppingCart size={16} />
                  {isLoading ? 'Procesando...' : `Comprar por ${item.price} BEZ`}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ItemDetailModal;
