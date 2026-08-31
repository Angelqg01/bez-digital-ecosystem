import { useSignMessage, useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';

export const useAdminActions = () => {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const executeSecureAction = async (actionName, callback) => {
        try {
            const message = `Autorizo la acción: ${actionName} en BeZhas Panel. Timestamp: ${Date.now()}`;

            toast.loading('Por favor firma la transacción en tu wallet...', { id: 'signing' });

            const signature = await signMessageAsync({ message });

            toast.success('Firma verificada', { id: 'signing' });

            // Retornamos los headers necesarios para la petición
            const authHeaders = {
                signature,
                message,
                address
            };

            await callback(authHeaders);
        } catch (error) {
            console.error("Firma rechazada por el usuario", error);
            toast.error('Acción cancelada: Firma rechazada', { id: 'signing' });
        }
    };

    return { executeSecureAction };
};