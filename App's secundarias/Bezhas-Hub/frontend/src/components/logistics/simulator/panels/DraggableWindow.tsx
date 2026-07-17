import React, { useState, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';

interface DraggableWindowProps {
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  width?: number;
  maxHeight?: number;
  theme?: 'emerald' | 'amber' | 'cyan';
  onClose?: () => void;
  isOpen: boolean;
  containerRef?: React.RefObject<HTMLElement>;
}

// Ventana flotante arrastrable (framer-motion, sin react-rnd)
export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  title,
  children,
  defaultPosition = { x: 40, y: 40 },
  width = 330,
  maxHeight = 460,
  theme = 'emerald',
  onClose,
  isOpen,
  containerRef,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const dragControls = useDragControls();
  const constraintsFallback = useRef(null);

  if (!isOpen) return null;

  const themeColors = {
    emerald: { border: 'border-emerald-900/50', headerBg: 'bg-emerald-950/40', text: 'text-emerald-500', shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]', icon: '◆' },
    amber: { border: 'border-amber-900/50', headerBg: 'bg-amber-950/40', text: 'text-amber-500', shadow: 'shadow-[0_0_20px_rgba(217,119,6,0.15)]', icon: '⬢' },
    cyan: { border: 'border-cyan-900/50', headerBg: 'bg-cyan-950/40', text: 'text-cyan-400', shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]', icon: '◈' },
  }[theme];

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragConstraints={containerRef ?? constraintsFallback}
      initial={{ x: defaultPosition.x, y: defaultPosition.y, opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ width, position: 'absolute', top: 0, left: 0, zIndex: 50 }}
      className={`flex flex-col bg-black/85 backdrop-blur border ${themeColors.border} ${themeColors.shadow} overflow-hidden pointer-events-auto rounded-md`}
    >
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className={`${themeColors.headerBg} border-b ${themeColors.border} px-3 h-[34px] flex justify-between items-center cursor-move select-none shrink-0 touch-none`}
      >
        <span className={`${themeColors.text} font-bold tracking-widest text-[10px] uppercase flex items-center gap-2`}>
          <span className="opacity-50">{themeColors.icon}</span>
          {title}
        </span>
        <div className="flex items-center gap-1.5 ml-4">
          <button
            onClick={() => setIsMinimized((m) => !m)}
            className="w-3 h-3 rounded-full bg-zinc-600 hover:bg-yellow-400 transition-colors"
            title={isMinimized ? 'Restaurar' : 'Minimizar'}
          />
          {onClose && (
            <button onClick={onClose} className="w-3 h-3 rounded-full bg-zinc-600 hover:bg-red-400 transition-colors" title="Cerrar" />
          )}
        </div>
      </div>
      {!isMinimized && (
        <div className="p-3 flex-1 overflow-y-auto min-h-0 flex flex-col custom-scrollbar" style={{ maxHeight }}>
          {children}
        </div>
      )}
    </motion.div>
  );
};
