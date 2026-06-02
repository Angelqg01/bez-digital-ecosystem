import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import Button from '../ui/Button';
import Card from '../ui/Card';
import './SettingsContent.css';

const AccountContent = ({ userProfileContract }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ username: '', bio: '', profilePictureUri: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || !userProfileContract) return;
      try {
        const userProfile = await userProfileContract.getProfile(user.address);
        setProfile({
          username: userProfile.username,
          bio: userProfile.bio,
          profilePictureUri: userProfile.profilePictureUri,
        });
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error('No se pudo cargar tu perfil.');
      }
    };
    fetchProfile();
  }, [user, userProfileContract]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async () => {
    if (!user || !userProfileContract) {
      toast.error('Conecta tu wallet para continuar.');
      return;
    }

    setIsLoading(true);
    toast.loading('Actualizando perfil...');

    try {
      const tx = await userProfileContract.updateProfile(
        profile.username,
        profile.bio,
        profile.profilePictureUri,
        '' // Public key is not being managed in this form
      );
      await tx.wait();
      toast.dismiss();
      toast.success('¡Perfil actualizado!');
    } catch (error) {
      toast.dismiss();
      console.error('Error updating profile:', error);
      toast.error(error.reason || 'No se pudo actualizar el perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="settings-content-container">
      <h2>Configuración de la Cuenta</h2>
      <p>Personaliza la información de tu perfil público.</p>

      <Card className="settings-card">
        <div className="form-group">
          <label>Nombre de Usuario</label>
          <input name="username" value={profile.username} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Biografía</label>
          <textarea name="bio" value={profile.bio} onChange={handleChange} rows="4" />
        </div>
        <div className="form-group">
          <label>URI de la Foto de Perfil</label>
          <input name="profilePictureUri" value={profile.profilePictureUri} onChange={handleChange} placeholder="https://..." />
        </div>
        <Button variant="primary" onClick={handleUpdateProfile} disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </Card>
    </div>
  );
};

export default AccountContent;
