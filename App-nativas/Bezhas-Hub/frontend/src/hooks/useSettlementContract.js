// frontend/src/hooks/useSettlementContract.js
import { useMemo } from 'react';
import { ethers } from 'ethers';
import SettlementABI from '../abis/SettlementContract.json';

export function useSettlementContract() {
    return useMemo(() => {
        if (!window.ethereum) return null;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(process.env.REACT_APP_SETTLEMENT_CONTRACT, SettlementABI, signer);
        return contract;
    }, []);
}
