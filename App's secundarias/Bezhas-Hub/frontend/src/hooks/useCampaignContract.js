// frontend/src/hooks/useCampaignContract.js
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import CampaignABI from '../abis/CampaignContract.json';

export function useCampaignContract() {
    const [contract, setContract] = useState(null);

    useEffect(() => {
        const initContract = async () => {
            try {
                // Verificar que window.ethereum esté disponible
                if (!window.ethereum) {
                    console.warn('MetaMask no detectado');
                    return;
                }

                // Verificar que la dirección del contrato esté configurada
                const contractAddress = process.env.REACT_APP_CAMPAIGN_CONTRACT;
                if (!contractAddress) {
                    console.warn('Dirección del contrato de campaña no configurada');
                    return;
                }

                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const contractInstance = new ethers.Contract(contractAddress, CampaignABI, signer);
                setContract(contractInstance);
            } catch (error) {
                console.error('Error al inicializar el contrato de campaña:', error);
            }
        };

        initContract();
    }, []);

    return contract;
}
