import React from 'react';
import { Link } from 'react-router-dom';
import { Send, Download, ShoppingCart, History, Fuel, ShieldCheck } from 'lucide-react';
import { useBEZBalance } from '@bezhas/platform-sdk/wallet';
import { useGasTank } from '@bezhas/platform-sdk/gas';

export default function Dashboard() {
  const { formatted: bezBalance, usd_value: bezUsd, isLoading: balanceLoading } = useBEZBalance();
  const { balance_bez: gasBalance, estimated_txs_remaining: gasTxs, isLoading: gasLoading } = useGasTank();

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Tu wallet BeZhas de un vistazo.</p>
      </div>

      <div className="balance-hero mb-8">
        <div className="balance-label">Balance BEZ</div>
        <div className="balance-value">
          {balanceLoading ? '...' : (bezBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} BEZ
        </div>
        <div className="balance-usd">${balanceLoading ? '...' : (bezUsd || 0).toFixed(2)} USD</div>
      </div>

      <div className="action-grid mb-8">
        <Link to="/send" className="action-btn">
          <div className="action-btn-icon send"><Send size={20} /></div>
          Enviar
        </Link>
        <Link to="/receive" className="action-btn">
          <div className="action-btn-icon receive"><Download size={20} /></div>
          Recibir
        </Link>
        <Link to="/buy" className="action-btn">
          <div className="action-btn-icon scan"><ShoppingCart size={20} /></div>
          Comprar BEZ
        </Link>
        <Link to="/history" className="action-btn">
          <div className="action-btn-icon bridge"><History size={20} /></div>
          Historial
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="page-subtitle" style={{ marginBottom: 6 }}>Gas Tank</p>
          <div className="balance-value" style={{ fontSize: '1.4rem' }}>
            {gasLoading ? '...' : (gasBalance || 0).toLocaleString()} BEZ
          </div>
          <div className="balance-usd">
            ~{gasLoading ? '...' : (gasTxs || 0).toLocaleString()} txs patrocinadas
          </div>
        </div>

        <Link to="/smart-wallet" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <p className="page-subtitle" style={{ marginBottom: 6 }}>Smart Wallet</p>
          <ShieldCheck size={22} />
          <div className="balance-usd">Guardianes y límites</div>
        </Link>

        <Link to="/gas-tank" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <p className="page-subtitle" style={{ marginBottom: 6 }}>Paymaster</p>
          <Fuel size={22} />
          <div className="balance-usd">Recargar Gas Tank</div>
        </Link>
      </div>
    </div>
  );
}
