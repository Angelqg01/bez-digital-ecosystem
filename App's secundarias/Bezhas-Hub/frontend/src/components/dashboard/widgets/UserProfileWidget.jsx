import React from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../../../context/Web3Context';
import useUserStore from '../../../stores/userStore';
import { Copy, User, Shield } from 'lucide-react';
import ConnectWalletButton from '../../common/ConnectWalletButton';

const UserProfileWidget = () => {
  const { address, isConnected } = useWeb3();
  const { userProfile, isLoading, isAdmin } = useUserStore();

  const username = userProfile?.username || 'Invitado';
  const bio = userProfile?.bio || 'Sin biografía';

  // Función para truncar la dirección del wallet
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Función para copiar al portapapeles
  const copyToClipboard = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    // Aquí podrías añadir un toast de confirmación
  };

  return (
    <div className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6">
      <div className="flex flex-col items-center text-center">
        <img
          src={`https://i.pravatar.cc/80?u=${address}`}
          alt="User Avatar"
          className="w-20 h-20 rounded-full border-2 border-dark-primary/20 dark:border-light-primary/20"
        />

        <div className="mt-4">
          {isLoading && isConnected ? (
            <div className="h-7 w-32 bg-dark-surface/50 dark:bg-light-surface/50 rounded-md animate-pulse mx-auto"></div>
          ) : (
            <h3 className="font-bold text-xl text-dark-text dark:text-light-text">
              {isConnected ? username : 'Invitado'}
              {isAdmin && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full flex items-center justify-center mt-1">
                  <Shield className="w-3 h-3 mr-1" /> Admin
                </span>
              )}
            </h3>
          )}

          {isConnected && address && (
            <div className="mt-2 flex items-center justify-center bg-dark-background/30 dark:bg-light-background/30 rounded-lg p-2">
              <code className="text-sm text-dark-text/80 dark:text-light-text/80 font-mono">
                {truncateAddress(address)}
              </code>
              <button
                onClick={copyToClipboard}
                className="ml-2 text-dark-text-muted dark:text-light-text-muted hover:text-dark-primary dark:hover:text-light-primary transition-colors"
                title="Copiar dirección"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          )}

          {!isConnected && (
            <p className="text-sm text-dark-text-muted dark:text-light-text-muted mt-1">
              Conecta tu wallet para empezar
            </p>
          )}
        </div>

        <p className="mt-3 text-sm text-dark-text-muted dark:text-light-text-muted line-clamp-2">
          {isConnected ? bio : 'Conecta tu wallet para ver tu perfil'}
        </p>
      </div>

      {isConnected ? (
        <div className="mt-6 space-y-3">
          <Link
            to="/profile"
            className="block w-full bg-dark-primary dark:bg-light-primary text-white font-medium py-2 px-4 rounded-xl text-center hover:opacity-90 transition-opacity flex items-center justify-center"
          >
            <User className="w-4 h-4 mr-2" />
            Ver perfil completo
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              className="block w-full bg-yellow-100 text-yellow-800 font-medium py-2 px-4 rounded-xl text-center hover:bg-yellow-200 transition-colors flex items-center justify-center text-sm"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              Panel de administración
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <ConnectWalletButton
            variant="minimal"
            size="md"
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default UserProfileWidget;
