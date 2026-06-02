import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { ShoppingCart, History } from 'lucide-react';
import './CreditsContent.css';

const CreditsContent = ({ bezBalance }) => {

  return (
    <div className="settings-content-container">
      <h2>Tus Créditos BEZ</h2>
      <p>Gestiona, compra y revisa el historial de tus tokens BEZ.</p>

      <div className="credits-main-grid">
        <Card className="balance-card">
          <h3>Balance Actual</h3>
          <div className="balance-amount">{bezBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="token-symbol">BEZ</span></div>
          <p className="balance-usd-value">~ $1,250.75 USD</p> {/* Placeholder */}
        </Card>

        <Card className="buy-tokens-card">
          <h3><ShoppingCart size={20} /> Comprar Tokens</h3>
          <div className="buy-form">
            <input type="number" placeholder="Cantidad de BEZ" className="creator-input" />
            <Button variant="primary" className="buy-button">Comprar Ahora</Button>
          </div>
          <p className="buy-note">La compra se realizará a través de un exchange descentralizado asociado.</p>
        </Card>
      </div>

      <Card className="history-card">
        <h3><History size={20} /> Historial de Transacciones</h3>
        <div className="history-placeholder">
          <p>Tu historial de transacciones aparecerá aquí.</p>
          <span>(Funcionalidad en desarrollo)</span>
        </div>
      </Card>
    </div>
  );
};

export default CreditsContent;
