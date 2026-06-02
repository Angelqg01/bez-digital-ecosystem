import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Componente reutilizable para mostrar una métrica con diseño moderno
 * @param {string} title - Título de la estadística
 * @param {string|number} value - Valor principal a mostrar
 * @param {object} icon - Componente de icono de lucide-react
 * @param {number} trend - Porcentaje de cambio (positivo o negativo)
 * @param {string} bgGradient - Gradiente de fondo (Tailwind classes)
 * @param {string} change - Cambio en formato string (compatibilidad)
 * @param {string} changeType - Tipo de cambio: 'increase' o 'decrease' (compatibilidad)
 */
const StatCard = ({ title, value, icon: Icon, trend, bgGradient, change, changeType }) => {
  // Soporte para ambos formatos de props
  const trendValue = trend !== undefined ? trend : (change ? parseFloat(change) : 0);
  const isPositive = trend !== undefined ? trend >= 0 : changeType === 'increase';

  return (
    <div className={`relative overflow-hidden rounded-xl ${bgGradient || 'bg-gradient-to-br from-gray-500 to-gray-600'} p-6 shadow-lg hover:shadow-2xl transition-all duration-300`}>
      {/* Fondo decorativo con opacidad */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

      <div className="relative">
        {/* Icono y título */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {Icon && (
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Icon className="h-6 w-6 text-white" />
              </div>
            )}
            <h3 className="text-sm font-medium text-white/80">{title}</h3>
          </div>

          {/* Indicador de tendencia */}
          {(trend !== undefined || change) && (
            <div className={`flex items-center space-x-1 text-xs font-semibold ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{change || `${Math.abs(trendValue)}%`}</span>
            </div>
          )}
        </div>

        {/* Valor principal */}
        <div className="text-3xl font-bold text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
