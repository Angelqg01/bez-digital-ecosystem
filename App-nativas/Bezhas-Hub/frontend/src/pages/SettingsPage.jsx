import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import useUserStore from '../stores/userStore';
import { toast } from 'react-hot-toast';
import { User, Shield, Bell, Network } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import AmoyNetworkSwitcher from '../components/network/AmoyNetworkSwitcher';
import SecuritySettings from '../components/settings/SecuritySettings';

const AccountSettings = () => {
  const { address, userProfile: userProfileContract, bezhasToken } = useWeb3();
  const { userProfile, fetchUserData, isLoading: isUserLoading } = useUserStore();

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  const handleUpdateProfile = async () => {
    if (!username) {
      return toast.error('El nombre de usuario no puede estar vacío.');
    }
    if (!userProfileContract || !address) {
      return toast.error('El contrato o la dirección del usuario no están disponibles.');
    }

    setIsActionLoading(true);
    try {
      const tx = await userProfileContract.updateProfile(username, bio);
      toast.loading('Actualizando perfil...', { id: 'update-profile' });
      await tx.wait();
      // Refrescar los datos del usuario en el store global
      await fetchUserData(address, userProfileContract, bezhasToken);
      toast.success('Perfil actualizado con éxito', { id: 'update-profile' });
    } catch (error) {
      console.error('Error al actualizar el perfil:', error);
      toast.error(error?.shortMessage || 'La actualización falló.', { id: 'update-profile' });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-dark-text-muted dark:text-light-text-muted">Nombre de Usuario</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full bg-dark-background dark:bg-light-background p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-primary dark:focus:ring-light-primary"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-dark-text-muted dark:text-light-text-muted">Biografía</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="mt-1 w-full bg-dark-background dark:bg-light-background p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-primary dark:focus:ring-light-primary"
        />
      </div>
      <div className="flex justify-end">
        <button onClick={handleUpdateProfile} disabled={isActionLoading || isUserLoading} className="bg-dark-primary dark:bg-light-primary text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center w-48">
          {isActionLoading || isUserLoading ? <Spinner size="sm" /> : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('account');
  const { isConnected } = useWeb3();

  const tabs = [
    { id: 'account', label: 'Cuenta', icon: <User size={18} /> },
    { id: 'network', label: 'Red', icon: <Network size={18} /> },
    { id: 'security', label: 'Seguridad', icon: <Shield size={18} /> },
    { id: 'notifications', label: 'Notificaciones', icon: <Bell size={18} /> },
  ];

  const renderContent = () => {
    if (!isConnected && activeTab !== 'network') {
      return <p className="text-center text-dark-text-muted dark:text-light-text-muted py-12">Conecta tu billetera para gestionar tu configuración.</p>;
    }
    switch (activeTab) {
      case 'account':
        return <AccountSettings />;
      case 'network':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-dark-text dark:text-light-text mb-2">
                Configuración de Red
              </h2>
              <p className="text-dark-text-muted dark:text-light-text-muted">
                Administra tu conexión a las redes blockchain de prueba y producción.
              </p>
            </div>
            <AmoyNetworkSwitcher />
          </div>
        );
      case 'security':
        return <SecuritySettings />;
      case 'notifications':
        return <p className="text-center text-dark-text-muted dark:text-light-text-muted py-12">La sección de notificaciones está en construcción.</p>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-dark-text dark:text-light-text">Configuración</h1>
        <p className="text-dark-text-muted dark:text-light-text-muted mt-1">Gestiona las opciones de tu cuenta y la aplicación.</p>
      </header>

      <div className="bg-dark-surface dark:bg-light-surface rounded-2xl">
        <div className="flex border-b border-dark-background dark:border-light-background">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-6 font-semibold transition-colors ${activeTab === tab.id
                ? 'text-dark-primary dark:text-light-primary border-b-2 border-dark-primary dark:border-light-primary'
                : 'text-dark-text-muted dark:text-light-text-muted hover:text-dark-text dark:hover:text-light-text'
                }`}>
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
