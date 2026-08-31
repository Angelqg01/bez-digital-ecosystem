import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import ProfileEditForm from '../components/profile/ProfileEditForm';
import { toast } from 'react-hot-toast';
import axios from 'axios';

export default function ProfileEditPage() {
    const { address, isConnected } = useAccount();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isConnected) {
            navigate('/');
            return;
        }
        fetchUserProfile();
    }, [address, isConnected]);

    const fetchUserProfile = async () => {
        try {
            const response = await axios.get(`/api/profile/${address}`);
            setUser(response.data);
        } catch (error) {
            console.error('Error fetching profile:', error);
            toast.error('Error al cargar el perfil');
        } finally {
            setLoading(false);
        }
    };

    const handleSuccess = (updatedProfile) => {
        setUser(updatedProfile);
        toast.success('Perfil actualizado correctamente');
        setTimeout(() => {
            navigate(`/profile/${address}`);
        }, 1500);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-light-bg dark:bg-dark-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-light-bg dark:bg-dark-background py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary mb-6 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Volver al perfil
                </button>

                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 sm:p-8 border-b border-gray-200 dark:border-gray-700">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <User className="w-6 h-6 text-primary" />
                            Editar Perfil
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Actualiza tu información personal y cómo te ven otros usuarios.
                        </p>
                    </div>

                    <ProfileEditForm user={user} onSuccess={handleSuccess} />
                </div>
            </div>
        </div>
    );
}
