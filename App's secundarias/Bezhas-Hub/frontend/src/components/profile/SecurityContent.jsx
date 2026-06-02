import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Smartphone, Monitor, Globe } from 'lucide-react';
import '../settings/SettingsContent.css';

const SecurityContent = () => {
  // Mock data from SecurityManager.sol
  const sessionHistory = [
    { device: 'Desktop', browser: 'Chrome', ip: '192.168.1.1', location: 'Madrid, ES', date: 'Hoy a las 11:50', icon: <Monitor /> },
    { device: 'iPhone 14 Pro', browser: 'Safari', ip: '88.12.34.56', location: 'Barcelona, ES', date: 'Ayer a las 20:15', icon: <Smartphone /> },
  ];

  return (
    <div className="settings-content-container">
      <h2>Seguridad y Privacidad</h2>
      <p>Revisa tu historial de sesiones y gestiona la privacidad de tu perfil.</p>

      <Card className="settings-card">
        <h3>Historial de Inicio de Sesión</h3>
        <ul className="session-list">
          {sessionHistory.map((session, index) => (
            <li key={index} className="session-item">
              <div className="session-icon">{session.icon}</div>
              <div className="session-details">
                <strong>{session.device}</strong> ({session.browser}) - {session.location}
                <span>{session.date}</span>
              </div>
              <Button variant="secondary">Revocar</Button>
            </li>
          ))}
        </ul>
      </Card>

       <Card className="settings-card">
        <h3>Configuración de Privacidad</h3>
         <div className="profile-field">
            <label>Visibilidad del perfil</label>
            <p>Controla quién puede ver tu perfil y tu actividad.</p>
            <select className='creator-input' defaultValue="public">
                <option value="public">Público</option>
                <option value="followers">Solo seguidores</option>
                <option value="private">Privado</option>
            </select>
        </div>
      </Card>
    </div>
  );
};

export default SecurityContent;
