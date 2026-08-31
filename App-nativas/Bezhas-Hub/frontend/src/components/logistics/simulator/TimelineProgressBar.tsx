import React from 'react';
import { SimulationStep, Phase } from './engine/types';

interface TimelineProgressBarProps {
  currentStepIndex: number;
  isRunning: boolean;
  isFinished: boolean;
  onStepClick: (index: number) => void;
  flowSteps: SimulationStep[];
}

const PHASE_LABEL: Record<Phase, string> = {
  origin: 'FASE A · ZONA FRANCA DE ORIGEN',
  transit: 'FASE B · TRÁNSITO',
  destination: 'FASE C · DESTINO',
};

const PHASE_COLOR: Record<Phase, string> = {
  origin: 'text-teal-400 border-teal-500/30',
  transit: 'text-sky-400 border-sky-500/30',
  destination: 'text-amber-400 border-amber-500/30',
};

// Timeline con las 3 fases del flujo 360 marcadas
export const TimelineProgressBar: React.FC<TimelineProgressBarProps> = ({
  currentStepIndex, isRunning, isFinished, onStepClick, flowSteps,
}) => {
  const currentPhase = flowSteps[currentStepIndex]?.phase ?? 'origin';

  return (
    <div className="w-full bg-gradient-to-t from-black via-black/85 to-transparent pt-8 pb-4 px-8 pointer-events-auto flex flex-col z-20">
      <div className="flex justify-between items-center mb-3">
        <span className={`text-[10px] font-bold tracking-[0.25em] uppercase drop-shadow-md border rounded px-2 py-0.5 bg-black/50 ${PHASE_COLOR[currentPhase]}`}>
          {PHASE_LABEL[currentPhase]}
        </span>
        <span className="text-[11px] text-zinc-300 font-mono tracking-widest bg-black/50 px-2 py-0.5 rounded border border-white/5">
          ETAPA {currentStepIndex + 1} / {flowSteps.length}
        </span>
      </div>

      <div className="relative flex items-center w-full h-9">
        <div className="absolute left-0 right-0 h-1.5 bg-zinc-800/80 rounded-full shadow-inner" />
        <div
          className="absolute left-0 h-1.5 bg-teal-500/20 rounded-full transition-all duration-700 blur-sm"
          style={{ width: `${(currentStepIndex / (flowSteps.length - 1)) * 100}%` }}
        />
        <div
          className="absolute left-0 h-1.5 bg-gradient-to-r from-teal-600 via-sky-500 to-amber-400 rounded-full transition-all duration-700 shadow-[0_0_10px_#00d4aa]"
          style={{ width: `${(currentStepIndex / (flowSteps.length - 1)) * 100}%` }}
        />

        <div className="absolute inset-0 flex justify-between items-center">
          {flowSteps.map((step, index) => {
            const isCompleted = isFinished || index < currentStepIndex;
            const isActive = isRunning && index === currentStepIndex;
            const isSelectable = isCompleted || (isFinished && index === currentStepIndex);
            const phaseDot = step.phase === 'origin' ? 'bg-teal-400' : step.phase === 'transit' ? 'bg-sky-400' : 'bg-amber-400';

            return (
              <button
                key={step.id}
                onClick={() => { if (isSelectable) onStepClick(index); }}
                disabled={!isSelectable}
                className={`relative flex flex-col items-center justify-center group ${isSelectable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                title={`${step.id}. ${step.bUidStage} — ${step.validator.name}`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-500 ring-2
                    ${isActive ? 'bg-emerald-400 scale-[1.7] animate-pulse ring-emerald-500/50 shadow-[0_0_15px_#10b981]' :
                      isCompleted ? `${phaseDot} ring-zinc-900/80 group-hover:scale-125 shadow-[0_0_8px_rgba(45,212,191,0.5)]` :
                      'bg-zinc-700 ring-zinc-900 shadow-inner'}`}
                />
                <div className={`absolute -top-7 text-[9px] font-mono whitespace-nowrap transition-all duration-300 transform -translate-y-1 uppercase tracking-widest bg-black/60 px-2 py-0.5 border rounded backdrop-blur-sm
                    ${isActive ? 'opacity-100 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                      'opacity-0 group-hover:opacity-100 text-zinc-400 border-zinc-700'}`}
                >
                  {step.bUidStage}
                </div>
                {isActive && <div className="absolute top-[7px] -translate-y-full w-0.5 h-3 bg-emerald-500/50 pointer-events-none animate-pulse" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
