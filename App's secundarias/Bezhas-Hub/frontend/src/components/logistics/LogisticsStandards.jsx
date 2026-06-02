import React from 'react';

export const LogisticsStandards = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-slate-900/40 p-10 rounded-[3.5rem] border border-slate-800/50 space-y-6">
                <h3 className="text-3xl font-black italic text-white">Global Standards</h3>
                <p className="text-slate-400 text-sm">Adherence to international frameworks ensures legal validity and interoperability.</p>
                <ul className="space-y-4">
                    {[
                        { title: 'DCSA e-BL', desc: 'Digital Container Shipping Association standard for electronic Bills of Lading.' },
                        { title: 'UNCITRAL MLETR', desc: 'Model Law on Electronic Transferable Records compliance.' },
                        { title: 'IATA e-Freight', desc: 'Standard for paperless air cargo operations.' },
                        { title: 'IMDG Code', desc: 'International Maritime Dangerous Goods code integration.' }
                    ].map((item, i) => (
                        <li key={i} className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800/50">
                            <h4 className="text-blue-400 font-black uppercase text-xs mb-2">{item.title}</h4>
                            <p className="text-slate-500 text-xs font-medium">{item.desc}</p>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="bg-slate-900/40 p-10 rounded-[3.5rem] border border-slate-800/50 space-y-6">
                <h3 className="text-3xl font-black italic text-white">Infrastructure</h3>
                <p className="text-slate-400 text-sm">Powered by Polygon L2 for scalability and IPFS for decentralized storage.</p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-purple-500/5 rounded-3xl border border-purple-500/20 text-center">
                        <span className="text-purple-400 font-black text-2xl block mb-2">Polygon</span>
                        <span className="text-slate-500 text-[10px] uppercase font-bold">L2 Scaling</span>
                    </div>
                    <div className="p-6 bg-cyan-500/5 rounded-3xl border border-cyan-500/20 text-center">
                        <span className="text-cyan-400 font-black text-2xl block mb-2">IPFS</span>
                        <span className="text-slate-500 text-[10px] uppercase font-bold">Storage</span>
                    </div>
                    <div className="p-6 bg-yellow-500/5 rounded-3xl border border-yellow-500/20 text-center col-span-2">
                        <span className="text-yellow-500 font-black text-2xl block mb-2">BeZhas Oracle</span>
                        <span className="text-slate-500 text-[10px] uppercase font-bold">Real-time Validation</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
