import React from 'react';
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area } from 'recharts';
import { useTheme } from '../../context/ThemeContext';

const chartData = [
  { name: 'Lun', 'Transacciones': 4000 },
  { name: 'Mar', 'Transacciones': 3000 },
  { name: 'Mié', 'Transacciones': 2000 },
  { name: 'Jue', 'Transacciones': 2780 },
  { name: 'Vie', 'Transacciones': 1890 },
  { name: 'Sáb', 'Transacciones': 2390 },
  { name: 'Dom', 'Transacciones': 3490 },
];

const TransactionChart = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const strokeColor = isDark ? '#a78bfa' : '#8b5cf6'; // Lighter for dark, darker for light
  const fillColor = isDark ? 'url(#colorUvDark)' : 'url(#colorUvLight)';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div className="h-80">
      <h3 className="text-lg font-semibold mb-4">Tendencia de Transacciones (Últimos 7 días)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="colorUvLight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorUvDark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
          <XAxis dataKey="name" tick={{ fill: axisColor }} stroke={axisColor} />
          <YAxis tick={{ fill: axisColor }} stroke={axisColor} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              borderColor: isDark ? '#374151' : '#e5e7eb'
            }}
          />
          <Area type="monotone" dataKey="Transacciones" stroke={strokeColor} fill={fillColor} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TransactionChart;
