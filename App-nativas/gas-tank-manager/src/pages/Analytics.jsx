import React from 'react';
import BetaNotice from '../components/BetaNotice';

export default function Analytics() {
  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Gas Analytics</h1>
        <p className="page-subtitle">Análisis detallado del consumo de gas por app y operación</p>
      </div>
      <BetaNotice>Las analíticas de consumo estarán disponibles cuando el Gas Tank registre operaciones reales.</BetaNotice>
    </div>
  );
}
