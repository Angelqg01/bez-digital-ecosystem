import React from 'react';
import { CheckCircle2, Package, Truck, Anchor, MapPin } from 'lucide-react';

const LogisticsTimeline = ({ history }) => {
    // history es el array que devuelve contract.getHistory(tokenId)
    return (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Package className="text-blue-400" /> Historial de Trazabilidad Inmutable
            </h3>
            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-purple-500 before:to-transparent">
                {history.map((event, index) => (
                    <div key={index} className="relative flex items-start gap-6 group">
                        <div className="absolute left-0 w-10 h-10 flex items-center justify-center rounded-full bg-slate-900 border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10 transition-transform group-hover:scale-110">
                            {event.status === "Delivered" ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Truck className="w-5 h-5 text-blue-400" />}
                        </div>
                        <div className="ml-12 bg-white/5 p-4 rounded-lg border border-white/5 hover:border-blue-500/50 transition-colors w-full">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-blue-400 font-mono text-sm uppercase tracking-wider">{event.status}</span>
                                <span className="text-slate-400 text-xs">{new Date(Number(event.timestamp) * 1000).toLocaleString()}</span>
                            </div>
                            <h4 className="text-white font-semibold flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" /> {event.location}
                            </h4>
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                                <span className="bg-slate-800 px-2 py-1 rounded">Signed by:</span>
                                <span className="font-mono text-blue-300/70">{event.updatedBy.substring(0, 6)}...{event.updatedBy.substring(38)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LogisticsTimeline;
