import React from 'react';
import { Validator } from '../engine/types';

interface ValidatorNodesBarProps {
  validators: Validator[];
  activeValidatorDid?: string;
  confirmedDids: string[];
}

// Barra de validadores con DIDs: se iluminan al firmar cada etapa
export const ValidatorNodesBar: React.FC<ValidatorNodesBarProps> = ({ validators, activeValidatorDid, confirmedDids }) => (
  <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
    {validators.map((v) => {
      const isActive = v.did === activeValidatorDid;
      const isConfirmed = confirmedDids.includes(v.did);
      return (
        <div
          key={v.did}
          title={v.did}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border whitespace-nowrap text-[8px] font-mono transition-all shrink-0
            ${isActive ? 'border-amber-500/50 text-amber-300' : isConfirmed ? 'border-teal-500/30 text-teal-300' : 'border-zinc-800 text-zinc-500'}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full
              ${isActive ? 'bg-amber-400 shadow-[0_0_5px_#f59e0b] animate-pulse' : isConfirmed ? 'bg-teal-400 shadow-[0_0_4px_#2dd4bf]' : 'bg-zinc-700'}`}
          />
          <span>{v.icon}</span>
          <span>{v.name}</span>
        </div>
      );
    })}
  </div>
);
