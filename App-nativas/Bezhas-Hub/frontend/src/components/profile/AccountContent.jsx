import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import '../settings/SettingsContent.css';

const AccountContent = ({ account }) => {
  return (
    <div className="settings-content-container">
      <h2>Cuenta</h2>
      <p>Gestiona los datos de tu cuenta y las preferencias de notificación.</p>

      <Card className="settings-card">
        <div className="profile-field">
          <label>Email de Notificaciones</label>
          <span>{account.email} {account.isVerified && <span className='verified-badge'>Verificado</span>}</span>
          <Button variant="secondary">Cambiar</Button>
        </div>
        <div className="profile-field">
          <label>Wallet Conectada</label>
          <span className="wallet-address">{account.walletAddress}</span>
          <Button variant="secondary">Desconectar</Button>
        </div>
      </Card>

      <Card className="settings-card danger-zone">
        <h3>Zona de Peligro</h3>
        <div className="profile-field">
            <label>Eliminar Perfil</label>
            <p>Esta acción es irreversible y eliminará tus datos de perfil de la plataforma. No afectará a tus activos en la blockchain.</p>
            <Button variant="danger">Eliminar mi perfil</Button>
        </div>
      </Card>
    </div>
  );
};

export default AccountContent;
