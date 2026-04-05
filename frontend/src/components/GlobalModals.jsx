/**
 * GlobalModals.jsx
 * 
 * Modales globales de la plataforma BeZhas.
 * 
 * NOTE: BuyBezCoinModal fue ELIMINADO de aquí.
 * El BezPayModal v2 global está registrado en App.jsx vía BezPayProvider.
 * Activar el modal de compra desde cualquier componente:
 *   const { openBuyBez } = useBezPay();
 *   openBuyBez(); 
 */
import React, { memo, useEffect } from 'react';
import { useBezCoin } from '../context/BezCoinContext';
import { useBezPay } from '../context/BezPayContext';

const GlobalModals = () => {
    const { showBuyModal, setShowBuyModal } = useBezCoin();
    const { openBuyBez } = useBezPay();

    // Puente de migración: si BezCoinContext activa showBuyModal, abrimos BezPayModal
    useEffect(() => {
        if (showBuyModal) {
            setShowBuyModal(false);
            openBuyBez();
        }
    }, [showBuyModal]);

    // BuyBezCoinModal eliminado — ahora usa BezPayModal global
    return null;
};

export default memo(GlobalModals);

