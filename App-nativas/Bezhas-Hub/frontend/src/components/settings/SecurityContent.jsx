import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Shield, UserX } from 'lucide-react';
import './SettingsContent.css';

const SecurityContent = ({ advancedSocialContract }) => {
  const { user } = useAuth();
  const [addressToBlock, setAddressToBlock] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBlockedUsers = useCallback(async () => {
    if (!user || !advancedSocialContract) return;
    try {
      const users = await advancedSocialContract.getBlockedUsers(user.address);
      setBlockedUsers(users);
    } catch (error) {
      console.error("Failed to fetch blocked users:", error);
      toast.error('No se pudo cargar la lista de usuarios bloqueados.');
    }
  }, [user, advancedSocialContract]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const handleBlockUser = async () => {
    if (!addressToBlock.trim()) {
      toast.error('Introduce una dirección válida.');
      return;
    }
    setIsLoading(true);
    toast.loading('Bloqueando usuario...');
    try {
      const tx = await advancedSocialContract.blockUser(addressToBlock);
      await tx.wait();
      toast.dismiss();
      toast.success('Usuario bloqueado con éxito.');
      setAddressToBlock('');
      fetchBlockedUsers();
    } catch (error) {
      toast.dismiss();
      console.error('Error blocking user:', error);
      toast.error(error.reason || 'No se pudo bloquear al usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockUser = async (addressToUnblock) => {
    setIsLoading(true);
    toast.loading('Desbloqueando usuario...');
    try {
      const tx = await advancedSocialContract.unblockUser(addressToUnblock);
      await tx.wait();
      toast.dismiss();
      toast.success('Usuario desbloqueado.');
      fetchBlockedUsers();
    } catch (error) {
      toast.dismiss();
      console.error('Error unblocking user:', error);
      toast.error(error.reason || 'No se pudo desbloquear al usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="settings-content-container">
      <h2><Shield size={20} /> Seguridad y Privacidad</h2>
      <p>Gestiona los usuarios que has bloqueado en la plataforma.</p>

      <Card className="settings-card">
        <h3>Bloquear un Usuario</h3>
        <p className="card-description">Los usuarios bloqueados no podrán interactuar contigo.</p>
        <div className="form-group">
          <input
            value={addressToBlock}
            onChange={(e) => setAddressToBlock(e.target.value)}
            placeholder="Introduce la dirección 0x... del usuario a bloquear"
          />
        </div>
        <Button variant="danger" onClick={handleBlockUser} disabled={isLoading}>
          {isLoading ? 'Bloqueando...' : 'Bloquear Usuario'}
        </Button>
      </Card>

      <Card className="settings-card">
        <h3>Usuarios Bloqueados</h3>
        <div className="blocked-users-list">
          {blockedUsers.length > 0 ? (
            blockedUsers.map(address => (
              <div key={address} className="blocked-user-item">
                <UserX size={16} />
                <span className="blocked-address">{address}</span>
                <Button variant="secondary" size="sm" onClick={() => handleUnblockUser(address)} disabled={isLoading}>
                  Desbloquear
                </Button>
              </div>
            ))
          ) : (
            <p>No has bloqueado a ningún usuario.</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SecurityContent;
