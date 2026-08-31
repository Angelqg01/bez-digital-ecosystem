import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { CheckCircle, PlusCircle, Key } from 'lucide-react';
import './SettingsContent.css';

const WalletsContent = () => {
  const { user } = useAuth();

  return (
    <div className="settings-content-container">
      <h2>Wallets y Métodos de Pago</h2>
      <p>Gestiona las wallets que usas para interactuar con BeZhas y comprar tokens.</p>

      <Card className="settings-card">
        <div className="card-header">
          <h3>Wallet Cripto Conectada</h3>
        </div>
        <div className="wallet-info">
          <CheckCircle size={20} className="success-icon" />
          <span className="wallet-address">{user ? `${user.address.substring(0, 6)}...${user.address.substring(user.address.length - 4)}` : 'No conectada'}</span>
          <span className="wallet-provider">MetaMask</span>
        </div>
        <p className="card-description">Esta es la wallet principal de tu cuenta, usada para la autenticación y las transacciones en la blockchain.</p>
      </Card>

      <Card className="settings-card">
        <div className="card-header">
          <h3>Métodos de Pago (FIAT)</h3>
          <Button variant="secondary"><PlusCircle size={16} /> Añadir Método</Button>
        </div>
        <p className="card-description">Conecta tu cuenta de Stripe o PayPal para comprar tokens BEZ directamente con dinero tradicional. (Simulación)</p>
        <div className="fiat-methods-placeholder">
          <p>No hay métodos de pago FIAT conectados.</p>
        </div>
      </Card>

      <Card className="settings-card">
        <div className="card-header">
          <h3><Key size={18} /> API Keys de Exchanges</h3>
        </div>
        <p className="card-description">Si usas un bot de trading o una herramienta externa, puedes añadir tu API key aquí para sincronizar balances. Asegúrate de usar permisos de "solo lectura".</p>
        <div className="api-key-form">
          <input type="password" placeholder="Introduce tu API Key" className="creator-input" />
          <Button variant="primary">Guardar Key</Button>
        </div>
      </Card>
    </div>
  );
};

export default WalletsContent;
