import React from 'react';
import { ActiveNode } from './engine/types';

interface BlockchainNodesProps {
  activeNodes: ActiveNode[];
  status: {
    rwa: string;
    contract: string;
    mcp: string;
    oraculo: string;
  };
}

export const BlockchainNodes: React.FC<BlockchainNodesProps> = ({ activeNodes, status }) => {
  const nodes = [
    { id: 'rwa', label: 'RWA Tokenizer', stat: status.rwa },
    { id: 'contract', label: 'Contratos Int.', stat: status.contract },
    { id: 'mcp', label: 'Agente IA (MCP)', stat: status.mcp },
    { id: 'oraculo', label: 'Oráculo IoT', stat: status.oraculo },
  ];

  return (
    <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-800/80 rounded-xl p-3 flex justify-around items-center px-4 w-full relative z-10 gap-3 shadow-2xl">
      {nodes.map((node) => {
        const isActive = activeNodes.includes(node.id as ActiveNode);
        return (
          <div
            key={node.id}
            className={`transition-all duration-300 border rounded-lg p-2.5 text-zinc-200 text-xs font-mono flex-1 text-center min-w-[120px]
              ${isActive ? 'border-teal-500 bg-teal-500/10' : 'border-zinc-800 bg-zinc-900 opacity-60'}`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-teal-400 shadow-[0_0_8px_#2dd4bf] animate-pulse' : 'bg-zinc-600'}`}></div>
              <span className="font-bold text-[9px] uppercase tracking-widest text-zinc-300">{node.label}</span>
            </div>
            <span className={`text-[9px] tracking-widest ${isActive ? 'text-teal-300' : 'text-zinc-500'}`}>{node.stat}</span>
          </div>
        );
      })}
    </div>
  );
};
