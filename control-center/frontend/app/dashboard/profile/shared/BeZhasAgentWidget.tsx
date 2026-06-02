
'use client';
import React, { useState } from 'react';
import { Bot, Sparkles, Check, X, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useAgentAlerts } from '../hooks/useAgentAlerts';

export default function BeZhasAgentWidget() {
  const { alerts, isConnected, resolveAlert } = useAgentAlerts();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleResolve = async (id: string, approved: boolean) => {
    setProcessingId(id);
    await resolveAlert(id, approved);
    setProcessingId(null);
  };

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/40 border border-slate-700/30 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-slate-400 text-sm">
            <div className="flex items-center gap-2">
                <Bot size={18} />
                <span>Asistente BeZhas</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <p className="mt-3 text-xs text-slate-500 italic">No hay alertas activas en este momento.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-900/40 to-fuchsia-900/20 border border-violet-500/30 p-5 space-y-4 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-violet-300 font-bold">
            <div className="bg-violet-500/20 p-1.5 rounded-lg">
                <Bot size={20} className="text-violet-400" />
            </div>
            <h4 className="tracking-tight flex items-center gap-2">
                Asistente BeZhas 
                <Sparkles size={14} className="text-amber-400 animate-pulse" />
            </h4>
        </div>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        {alerts.map((alert) => (
          <div 
            key={alert.id} 
            className={`bg-slate-900/60 border ${
                alert.status === 'resolved' ? 'border-green-500/40' :
                alert.status === 'rejected' ? 'border-slate-500/20' :
                alert.severity === 'critical' ? 'border-red-500/40' : 
                alert.severity === 'warning' ? 'border-amber-500/40' : 
                'border-violet-500/10'
            } p-4 rounded-xl text-sm text-slate-200 transition-all group relative overflow-hidden`}
          >
            <div className={`flex items-start gap-3 ${alert.status !== 'pending' && alert.status ? 'opacity-50' : ''}`}>
                {alert.status === 'resolved' ? (
                    <Check size={16} className="text-green-400" />
                ) : alert.status === 'rejected' ? (
                    <X size={16} className="text-slate-400" />
                ) : alert.severity === 'critical' || alert.severity === 'warning' ? (
                    <AlertTriangle size={16} className={alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'} />
                ) : (
                    <Info size={16} className="text-blue-400" />
                )}
                
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">
                            {alert.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] opacity-40">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <p className="leading-relaxed opacity-90">{alert.message}</p>
                </div>
            </div>

            {alert.status === 'pending' && (
                <div className="mt-4 flex gap-2">
                    <button 
                        disabled={processingId === alert.id}
                        onClick={() => handleResolve(alert.id, true)}
                        className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wider"
                    >
                        {processingId === alert.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Aprobar
                    </button>
                    <button 
                        disabled={processingId === alert.id}
                        onClick={() => handleResolve(alert.id, false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[10px] font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wider border border-slate-700"
                    >
                        Rechazar
                    </button>
                </div>
            )}

            {alert.status === 'resolved' && (
                <div className="mt-2 text-[10px] text-green-400 font-bold flex items-center gap-1 uppercase tracking-widest">
                    <Check size={10} /> Acción Ejecutada
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
