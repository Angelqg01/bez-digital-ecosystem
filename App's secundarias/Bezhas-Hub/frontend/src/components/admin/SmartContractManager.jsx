import React, { useState } from 'react';
import { FileCode, Play, Pause, Settings, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const mockContracts = [
  { name: 'StakingPool', address: '0x123...abc', pausable: true, paused: false },
  { name: 'BezhasToken', address: '0x456...def', pausable: true, paused: true },
  { name: 'UserProfile', address: '0x789...ghi', pausable: false, paused: false },
  { name: 'Marketplace', address: '0xabc...123', pausable: true, paused: false },
];

const SmartContractManager = () => {
  const [contracts, setContracts] = useState(mockContracts);

  const togglePause = (address) => {
    setContracts(contracts.map(c => {
      if (c.address === address && c.pausable) {
        toast.success(`Contrato ${c.name} ${c.paused ? 'reanudado' : 'pausado'}.`);
        return { ...c, paused: !c.paused };
      }
      return c;
    }));
  };

  return (
    <div className="bg-dark-surface dark:bg-light-surface p-6 rounded-2xl">
      <h3 className="text-lg font-semibold mb-4">Gestión de Contratos Inteligentes</h3>
      <div className="space-y-4">
        {contracts.map(contract => (
          <div key={contract.address} className="bg-dark-background dark:bg-light-background p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileCode className="text-dark-primary dark:text-light-primary" />
              <div>
                <p className="font-bold">{contract.name}</p>
                <p className="text-xs text-dark-text-muted dark:text-light-text-muted font-mono">{contract.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`flex items-center gap-1 text-sm font-semibold ${contract.paused ? 'text-yellow-500' : 'text-green-500'}`}>
                {contract.paused ? <XCircle size={16} /> : <CheckCircle size={16} />}
                {contract.paused ? 'Pausado' : 'Activo'}
              </span>
              {contract.pausable && (
                <button 
                  onClick={() => togglePause(contract.address)}
                  className="p-2 rounded-md bg-dark-surface dark:bg-light-surface hover:opacity-80 transition-opacity"
                  title={contract.paused ? 'Reanudar Contrato' : 'Pausar Contrato'}
                >
                  {contract.paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
              )}
              <button className="p-2 rounded-md bg-dark-surface dark:bg-light-surface hover:opacity-80 transition-opacity" title="Configuración">
                <Settings size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SmartContractManager;
