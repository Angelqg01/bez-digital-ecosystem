import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../../context/Web3Context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Datos de ejemplo para el gráfico de actividad semanal
const generateWeeklyData = () => {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return days.map(day => ({
    name: day,
    transacciones: Math.floor(Math.random() * 20) + 5,
    volumen: Math.floor(Math.random() * 10) + 1
  }));
};

// Datos de ejemplo para transacciones recientes
const recentTransactions = [
  { id: 1, type: 'compra', amount: 1.25, token: 'BEZ', from: '0x1a2b...3c4d', to: 'Tú', time: 'Hace 5 min' },
  { id: 2, type: 'venta', amount: 0.75, token: 'BEZ', from: 'Tú', to: '0x5e6f...7g8h', time: 'Hace 2 horas' },
  { id: 3, type: 'stake', amount: 50, token: 'BEZ', from: 'Tú', to: 'Pool', time: 'Ayer' },
  { id: 4, type: 'recompensa', amount: 2.5, token: 'BEZ', from: 'Staking', to: 'Tú', time: 'Ayer' },
];

const ActivityGraphWidget = () => {
  const { isConnected } = useWeb3();
  const [activeTab, setActiveTab] = useState('semana');
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTransacciones: 0,
    volumen24h: 0,
    usuariosActivos: 0,
    cambio24h: 2.5
  });

  useEffect(() => {
    // Simular carga de datos
    const timer = setTimeout(() => {
      setChartData(generateWeeklyData());
      setStats({
        totalTransacciones: 128,
        volumen24h: 2450.75,
        usuariosActivos: 84,
        cambio24h: 2.5
      });
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeTab]);

  const renderTransactionIcon = (type) => {
    switch (type) {
      case 'compra':
        return <ArrowDownRight className="w-4 h-4 text-green-500" />;
      case 'venta':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'stake':
        return <div className="w-4 h-4 rounded-full bg-blue-500"></div>;
      case 'recompensa':
        return <div className="w-4 h-4 rounded-full bg-yellow-500"></div>;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark-text dark:text-light-text">Actividad Reciente</h3>
        </div>
        <div className="text-center py-8">
          <div className="mx-auto w-12 h-12 bg-dark-background/30 dark:bg-light-background/30 rounded-full flex items-center justify-center mb-3">
            <Activity className="w-6 h-6 text-dark-text-muted dark:text-light-text-muted" />
          </div>
          <p className="text-dark-text-muted dark:text-light-text-muted">Conecta tu wallet para ver la actividad</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 bg-dark-background/30 dark:bg-light-background/30 rounded"></div>
          <div className="h-64 bg-dark-background/30 dark:bg-light-background/30 rounded-lg"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-dark-background/30 dark:bg-light-background/30 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-lg font-semibold text-dark-text dark:text-light-text">Actividad Reciente</h3>
        <div className="flex mt-2 md:mt-0 space-x-2 bg-dark-background/30 dark:bg-light-background/30 p-1 rounded-lg">
          {['día', 'semana', 'mes'].map((period) => (
            <button
              key={period}
              onClick={() => setActiveTab(period)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                activeTab === period
                  ? 'bg-dark-primary dark:bg-light-primary text-white'
                  : 'text-dark-text-muted dark:text-light-text-muted hover:bg-dark-background/20 dark:hover:bg-light-background/20'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico de actividad */}
      <div className="h-64 mb-8">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2D3748" opacity={0.1} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#718096' }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#718096' }}
              width={30}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(26, 32, 44, 0.95)',
                border: 'none',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
              itemStyle={{ color: '#E2E8F0' }}
              labelStyle={{ color: '#A0AEC0', fontWeight: 'bold' }}
            />
            <Bar 
              dataKey="transacciones" 
              fill="#4F46E5" 
              radius={[4, 4, 0, 0]}
              animationDuration={1500}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Transacciones', value: stats.totalTransacciones, change: stats.cambio24h },
          { label: 'Volumen 24h', value: `$${stats.volumen24h.toLocaleString()}`, change: -1.2 },
          { label: 'Usuarios activos', value: stats.usuariosActivos, change: 5.7 },
          { label: 'Nuevos usuarios', value: 12, change: 8.3 }
        ].map((stat, index) => (
          <div key={index} className="bg-dark-background/30 dark:bg-light-background/30 p-4 rounded-xl">
            <p className="text-sm text-dark-text-muted dark:text-light-text-muted mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-xl font-bold text-dark-text dark:text-light-text">{stat.value}</p>
              {stat.change && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  stat.change >= 0 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {stat.change >= 0 ? '↑' : '↓'} {Math.abs(stat.change)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Transacciones recientes */}
      <div>
        <h4 className="font-medium text-dark-text dark:text-light-text mb-4 flex items-center">
          <Clock className="w-4 h-4 mr-2" /> Últimas transacciones
        </h4>
        <div className="space-y-3">
          {recentTransactions.map((tx) => (
            <div 
              key={tx.id} 
              className="flex items-center justify-between p-3 bg-dark-background/20 dark:bg-light-background/20 rounded-lg hover:bg-dark-background/30 dark:hover:bg-light-background/30 transition-colors"
            >
              <div className="flex items-center">
                <div className="p-2 bg-dark-background/30 dark:bg-light-background/30 rounded-lg mr-3">
                  {renderTransactionIcon(tx.type)}
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-text dark:text-light-text capitalize">
                    {tx.type === 'compra' ? 'Compra recibida' : tx.type === 'venta' ? 'Venta realizada' : tx.type === 'stake' ? 'Tokens en staking' : 'Recompensa de staking'}
                  </p>
                  <p className="text-xs text-dark-text-muted dark:text-light-text-muted">
                    {tx.from} → {tx.to} • {tx.time}
                  </p>
                </div>
              </div>
              <div className={`text-right ${
                tx.type === 'compra' || tx.type === 'recompensa' 
                  ? 'text-green-500' 
                  : 'text-dark-text dark:text-light-text'
              }`}>
                <p className="font-medium">
                  {tx.type === 'compra' || tx.type === 'recompensa' ? '+' : ''}
                  {tx.amount} {tx.token}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <button className="text-sm text-dark-primary dark:text-light-primary hover:underline">
            Ver todas las transacciones
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityGraphWidget;
