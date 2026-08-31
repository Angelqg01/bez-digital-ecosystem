import React from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';

const mockTransactions = [
  { hash: '0xabc...123', type: 'Stake', from: '0x123...abc', to: '0xStaking...', value: '1,000 BEZ', time: 'Hace 2 minutos' },
  { hash: '0xdef...456', type: 'Transfer', from: '0x456...def', to: '0x789...ghi', value: '50 BEZ', time: 'Hace 15 minutos' },
  { hash: '0xghi...789', type: 'Approve', from: '0x789...ghi', to: '0xMarket...', value: 'N/A', time: 'Hace 1 hora' },
  { hash: '0xjkl...012', type: 'Mint NFT', from: '0x000...000', to: '0xjkl...012', value: '1 NFT', time: 'Hace 3 horas' },
  { hash: '0xmno...345', type: 'Unstake', from: '0xStaking...', to: '0xmno...345', value: '500 BEZ', time: 'Hace 5 horas' },
];

const getTypeClass = (type) => {
  switch (type) {
    case 'Stake': return 'bg-blue-500/10 text-blue-400';
    case 'Transfer': return 'bg-purple-500/10 text-purple-400';
    case 'Approve': return 'bg-yellow-500/10 text-yellow-400';
    case 'Mint NFT': return 'bg-green-500/10 text-green-400';
    case 'Unstake': return 'bg-red-500/10 text-red-400';
    default: return 'bg-gray-500/10 text-gray-400';
  }
};

const TransactionHistory = () => {
  return (
    <div className="bg-dark-surface dark:bg-light-surface p-6 rounded-2xl">
      <h3 className="text-lg font-semibold mb-4">Historial de Transacciones Recientes</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-dark-background dark:border-light-background">
              <th className="p-3">Hash</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Origen / Destino</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {mockTransactions.map(tx => (
              <tr key={tx.hash} className="border-b border-dark-background dark:border-light-background last:border-b-0 font-mono text-sm">
                <td className="p-3">
                  <a href="#" className="flex items-center gap-2 hover:text-dark-primary dark:hover:text-light-primary">
                    {tx.hash.substring(0, 12)}...
                    <ExternalLink size={14} />
                  </a>
                </td>
                <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-sans font-semibold ${getTypeClass(tx.type)}`}>{tx.type}</span></td>
                <td className="p-3 flex items-center gap-2">
                  <span title={tx.from}>{tx.from.substring(0, 8)}...</span>
                  <ArrowRight size={14} className="flex-shrink-0" />
                  <span title={tx.to}>{tx.to.substring(0, 8)}...</span>
                </td>
                <td className="p-3 font-sans font-semibold">{tx.value}</td>
                <td className="p-3 text-dark-text-muted dark:text-light-text-muted font-sans">{tx.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionHistory;
