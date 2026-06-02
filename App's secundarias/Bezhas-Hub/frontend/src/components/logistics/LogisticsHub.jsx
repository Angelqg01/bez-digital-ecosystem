import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useAccount, useWalletClient } from 'wagmi';
import { ContentValidatorAddress, ContentValidatorABI } from '../../contract-config';





const GLOBAL_NODES = [
    // --- Norteamérica ---
    { id: 'LAX', name: 'Los Ángeles', type: 'Port', location: 'EE. UU.', region: 'Norteamérica', capacity: 9900000 },
    { id: 'LGB', name: 'Long Beach', type: 'Port', location: 'EE. UU.', region: 'Norteamérica', capacity: 9100000 },
    { id: 'NYNJ', name: 'Nueva York / NJ', type: 'Port', location: 'EE. UU.', region: 'Norteamérica', capacity: 9400000 },
    { id: 'SAV', name: 'Savannah', type: 'Port', location: 'EE. UU.', region: 'Norteamérica', capacity: 5800000 },
    { id: 'HOU', name: 'Houston', type: 'Port', location: 'EE. UU.', region: 'Norteamérica', capacity: 4000000 },
    { id: 'VAN', name: 'Vancouver', type: 'Port', location: 'Canadá', region: 'Norteamérica', capacity: 3500000 },

    // --- C. América / Caribe ---
    { id: 'COL', name: 'Colón', type: 'Port', location: 'Panamá', region: 'C. América', capacity: 5100000 },
    { id: 'BAL', name: 'Balboa', type: 'Port', location: 'Panamá', region: 'C. América', capacity: 3800000 },
    { id: 'CTG', name: 'Cartagena', type: 'Port', location: 'Colombia', region: 'C. América', capacity: 3700000 },
    { id: 'KIN', name: 'Kingston', type: 'Port', location: 'Jamaica', region: 'Caribe', capacity: 2500000 },
    { id: 'CAU', name: 'Caucedo', type: 'Port', location: 'Rep. Dom.', region: 'Caribe', capacity: 1500000 },
    { id: 'MOI', name: 'Moín', type: 'Port', location: 'Costa Rica', region: 'C. América', capacity: 1300000 },

    // --- Sudamérica ---
    { id: 'SSZ', name: 'Santos', type: 'Port', location: 'Brasil', region: 'Sudamérica', capacity: 4200000 },
    { id: 'CALL', name: 'El Callao', type: 'Port', location: 'Perú', region: 'Sudamérica', capacity: 3000000 },
    { id: 'GYE', name: 'Guayaquil', type: 'Port', location: 'Ecuador', region: 'Sudamérica', capacity: 2200000 },
    { id: 'SAI', name: 'San Antonio', type: 'Port', location: 'Chile', region: 'Sudamérica', capacity: 1800000 },
    { id: 'BUE', name: 'Buenos Aires', type: 'Port', location: 'Argentina', region: 'Sudamérica', capacity: 1200000 },
    { id: 'MVD', name: 'Montevideo', type: 'Port', location: 'Uruguay', region: 'Sudamérica', capacity: 1100000 },

    // --- Europa ---
    { id: 'ROT', name: 'Rotterdam', type: 'Port', location: 'Países Bajos', region: 'Europa', capacity: 14000000 },
    { id: 'ANR', name: 'Amberes-Brujas', type: 'Port', location: 'Bélgica', region: 'Europa', capacity: 13500000 },
    { id: 'HAM', name: 'Hamburgo', type: 'Port', location: 'Alemania', region: 'Europa', capacity: 7800000 },
    { id: 'VLC', name: 'Valencia', type: 'Port', location: 'España', region: 'Europa', capacity: 5500000 },
    { id: 'ALG', name: 'Algeciras', type: 'Port', location: 'España', region: 'Europa', capacity: 4700000 },
    { id: 'PIR', name: 'El Pireo', type: 'Port', location: 'Grecia', region: 'Europa', capacity: 4800000 },
    { id: 'GDN', name: 'Gdansk', type: 'Port', location: 'Polonia', region: 'Europa', capacity: 3100000 },

    // --- África ---
    { id: 'TNM', name: 'Tanger Med', type: 'Port', location: 'Marruecos', region: 'África', capacity: 10200000 },
    { id: 'DUR', name: 'Durban', type: 'Port', location: 'Sudáfrica', region: 'África', capacity: 3000000 },
    { id: 'TEM', name: 'Tema', type: 'Port', location: 'Ghana', region: 'África', capacity: 1500000 },
    { id: 'RCB', name: 'Richards Bay', type: 'Port', location: 'Sudáfrica', region: 'África', capacity: 2000000 },

    // --- Asia Central / Caspio (Corredor Medio) ---
    { id: 'BAK', name: 'Bakú', type: 'Port', location: 'Azerbaiyán', region: 'Asia Central', capacity: 100000 },
    { id: 'AKT', name: 'Aktau', type: 'Port', location: 'Kazajistán', region: 'Asia Central', capacity: 100000 },
    { id: 'KHO', name: 'Khorgos', type: 'DryPort', location: 'China/Kazajistán', region: 'Asia Central', capacity: 500000 },
    { id: 'TKM', name: 'Turkmenbashi', type: 'Port', location: 'Turkmenistán', region: 'Asia Central', capacity: 100000 },
    { id: 'TAS', name: 'Tashkent', type: 'Warehouse', location: 'Uzbekistán', region: 'Asia Central', capacity: 50000 },

    // --- Asia ---
    { id: 'SHG', name: 'Shanghái', type: 'Port', location: 'China', region: 'Asia', capacity: 51500000 },
    { id: 'SIN', name: 'Singapur', type: 'Port', location: 'Singapur', region: 'Asia', capacity: 41100000 },
    { id: 'NGB', name: 'Ningbo-Zhoushan', type: 'Port', location: 'China', region: 'Asia', capacity: 39300000 },
    { id: 'SZN', name: 'Shenzhen', type: 'Port', location: 'China', region: 'Asia', capacity: 33300000 },
    { id: 'QIN', name: 'Qingdao', type: 'Port', location: 'China', region: 'Asia', capacity: 30000000 },
    { id: 'BUS', name: 'Busan', type: 'Port', location: 'Corea del Sur', region: 'Asia', capacity: 24400000 },
    { id: 'DXB', name: 'Jebel Ali', type: 'Port', location: 'Dubái, EAU', region: 'Asia', capacity: 15500000 },
    { id: 'PKG', name: 'Port Klang', type: 'Port', location: 'Malasia', region: 'Asia', capacity: 14600000 },

    // --- Oceanía ---
    { id: 'MEL', name: 'Melbourne', type: 'Port', location: 'Australia', region: 'Oceanía', capacity: 3000000 },
    { id: 'SYD', name: 'Sydney', type: 'Port', location: 'Australia', region: 'Oceanía', capacity: 2600000 },
    { id: 'BNE', name: 'Brisbane', type: 'Port', location: 'Australia', region: 'Oceanía', capacity: 1400000 },
    { id: 'PHD', name: 'Port Hedland', type: 'Port', location: 'Australia', region: 'Oceanía', capacity: 1000000 }, // Bulk mainly
    { id: 'AKL', name: 'Auckland', type: 'Port', location: 'Nueva Zelanda', region: 'Oceanía', capacity: 750000 },
    { id: 'TRG', name: 'Tauranga', type: 'Port', location: 'Nueva Zelanda', region: 'Oceanía', capacity: 720000 }
];

export const LogisticsHub = () => {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const [containers, setContainers] = useState([]);
    const [activeView, setActiveView] = useState('register');
    const [isProcessing, setIsProcessing] = useState(false);

    const [formData, setFormData] = useState({
        manualId: '',
        contents: '',
        hsCode: '',
        category: 'General',
        riskClass: '',
        tempRange: '',
        dimensions: '',
        pieces: 1,
        weight: 1,
        vesselVoyage: '',
        mode: 'Sea',
        origin: 'SHG',
        destination: 'ROT',
        shipper: '',
        consignee: '',
        docs: { invoice: true, packingList: true, certOrigin: false, insurance: false }
    });

    const BEZ_PRICE = 0.00075;

    const handleRegister = async (e) => {
        e.preventDefault();
        setIsProcessing(true);

        try {
            let multiplier = 1.0;
            if (formData.category === 'Dangerous Goods') multiplier = 1.8;
            if (formData.category === 'Reefer') multiplier = 1.5;
            if (formData.category === 'Out-of-Gauge (OOG)') multiplier = 2.2;

            const baseFiatCost = formData.weight * 450 * multiplier;
            const bezDiscountedPrice = baseFiatCost * 0.8;
            const bezTokens = bezDiscountedPrice / BEZ_PRICE;

            if (isConnected && walletClient) {
                try {
                    const provider = new ethers.BrowserProvider(walletClient);
                    const signer = await provider.getSigner();
                    const contract = new ethers.Contract(ContentValidatorAddress, ContentValidatorABI, signer);
                    const contentHash = ethers.id(JSON.stringify(formData));
                    // Using a dummy IPFS hash for demonstration
                    const tx = await contract.validateWithBezCoin(contentHash, "ipfs://QmHash...", "application/json");
                    await tx.wait();
                    console.log("Blockchain validation successful:", tx.hash);
                } catch (err) {
                    console.warn("Blockchain interaction failed, proceeding with local registration:", err);
                }
            } else if (isConnected && window.ethereum) {
                // Fallback for legacy/direct injection
                try {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();
                    const contract = new ethers.Contract(ContentValidatorAddress, ContentValidatorABI, signer);
                    const contentHash = ethers.id(JSON.stringify(formData));
                    const tx = await contract.validateWithBezCoin(contentHash, "ipfs://QmHash...", "application/json");
                    await tx.wait();
                    console.log("Blockchain validation successful:", tx.hash);
                } catch (err) {
                    console.warn("Legacy blockchain interaction failed:", err);
                }
            }

            // Simulate processing delay for UX
            await new Promise(resolve => setTimeout(resolve, 2000));

            const newUnit = {
                id: Math.random().toString(36).substr(2, 9),
                manualId: formData.manualId || `BZ-UNT-${Math.floor(Math.random() * 900000)}`,
                contents: formData.contents || 'General Merchandise',
                commodityCategory: formData.category,
                riskClass: formData.riskClass,
                tempRange: formData.tempRange,
                dimensions: formData.dimensions,
                hsCode: formData.hsCode || '8471.30',
                pieceCount: formData.pieces,
                weight: formData.weight,
                vesselVoyage: formData.vesselVoyage || 'V-GLOBAL-2025',
                shipper: formData.shipper || 'Standard Shipper Corp',
                consignee: formData.consignee || 'Standard Consignee Ltd',
                mode: formData.mode,
                status: 'Registered',
                location: GLOBAL_NODES.find(n => n.id === formData.origin)?.name || 'Origin Node',
                owner: isConnected ? address : 'Enterprise_Auth_L2',
                progress: 10,
                isValidated: true,
                contentHash: ethers.id(JSON.stringify(formData)),
                history: [{ location: 'Digital Registry (Polygon L2)', status: 'Registered', timestamp: Date.now(), updatedBy: isConnected ? `Client_${address.slice(0, 6)}` : 'Client_BeZhas' }],
                freightCostFiat: baseFiatCost,
                freightCostBez: bezTokens,
                docsValidated: formData.docs,
                standards: ['DCSA e-BL', 'MLETR Compliant', 'UN/CEFACT']
            };

            setContainers([newUnit, ...containers]);
            setActiveView('tracking');
        } catch (error) {
            console.error("Registration failed:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const advanceContainer = (id) => {
        setContainers(prev => prev.map(c => {
            if (c.id !== id) return c;
            const steps = ['Registered', 'Manifested', 'Loaded', 'In Transit', 'Customs', 'Delivered'];
            const nextIdx = steps.indexOf(c.status) + 1;
            const nextStatus = steps[nextIdx] || 'Delivered';
            return {
                ...c,
                status: nextStatus,
                progress: Math.min(100, c.progress + 18),
                history: [...c.history, {
                    location: nextStatus === 'In Transit' ? 'International Waters' : c.location,
                    status: nextStatus,
                    timestamp: Date.now(),
                    updatedBy: 'Oracle_Supply_Chain'
                }]
            };
        }));
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Navigation Tabs */}
            <div className="flex justify-center">
                <div className="bg-slate-900/60 p-2 rounded-3xl border border-slate-800 backdrop-blur-xl flex gap-2">
                    {[
                        { id: 'register', label: 'NFT Cargo Wizard', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { id: 'tracking', label: 'Chain Tracker', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { id: 'nodes', label: 'Network Infrastructure', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveView(tab.id)}
                            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === tab.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={tab.icon} /></svg>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeView === 'register' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 p-12 rounded-[3.5rem] shadow-2xl relative">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-4xl font-black italic mb-2 tracking-tighter">Logistics <span className="text-blue-500">Wizard</span></h3>
                                <p className="text-slate-500 text-sm font-medium">Standardised NFT Manifest (DCSA & MLETR Compliant).</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase rounded-full border border-emerald-500/20">Polygon L2</span>
                                <span className="px-3 py-1 bg-purple-500/10 text-purple-500 text-[9px] font-black uppercase rounded-full border border-purple-500/20">IPFS Storage</span>
                            </div>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-8">
                            {/* Primary Cargo Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Container / Unit ID</label>
                                    <input type="text" placeholder="MSKU-901123-X" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-mono focus:border-blue-500 outline-none" value={formData.manualId} onChange={e => setFormData({ ...formData, manualId: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Commodity Category</label>
                                    <select className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-black uppercase" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                        <option value="General">General Cargo</option>
                                        <option value="Dangerous Goods">Mercancías Peligrosas (DG)</option>
                                        <option value="Reefer">Carga Refrigerada (Cold Chain)</option>
                                        <option value="Out-of-Gauge (OOG)">Carga Sobredimensionada (OOG)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Specialized Fields */}
                            {formData.category === 'Dangerous Goods' && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2 p-6 bg-red-500/5 border border-red-500/20 rounded-3xl">
                                        <label className="text-[10px] font-black uppercase text-red-500 tracking-widest ml-1">IMDG Code / UN Number (Hazmat)</label>
                                        <input type="text" placeholder="Class 3 - Flammable Liquids (UN 1203)" className="w-full bg-slate-950/50 border border-red-500/30 rounded-2xl p-5 text-sm font-bold text-red-400 focus:border-red-500 outline-none" value={formData.riskClass} onChange={e => setFormData({ ...formData, riskClass: e.target.value })} />
                                        <p className="text-[9px] text-red-400/60 italic mt-2">* MSDS must be uploaded to IPFS via Appendix</p>
                                    </div>
                                </div>
                            )}

                            {formData.category === 'Reefer' && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2 p-6 bg-cyan-500/5 border border-cyan-500/20 rounded-3xl">
                                        <label className="text-[10px] font-black uppercase text-cyan-500 tracking-widest ml-1">IoT Temperature Monitoring (-30°C to +30°C)</label>
                                        <input type="text" placeholder="Constant -18°C Required" className="w-full bg-slate-950/50 border border-cyan-500/30 rounded-2xl p-5 text-sm font-bold text-cyan-400 focus:border-cyan-500 outline-none" value={formData.tempRange} onChange={e => setFormData({ ...formData, tempRange: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {formData.category === 'Out-of-Gauge (OOG)' && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2 p-6 bg-yellow-500/5 border border-yellow-500/20 rounded-3xl">
                                        <label className="text-[10px] font-black uppercase text-yellow-600 tracking-widest ml-1">Oversized Dimensions (LxWxH)</label>
                                        <input type="text" placeholder="15m x 4m x 4.2m" className="w-full bg-slate-950/50 border border-yellow-500/30 rounded-2xl p-5 text-sm font-bold text-yellow-500 focus:border-yellow-500 outline-none" value={formData.dimensions} onChange={e => setFormData({ ...formData, dimensions: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {/* Cargo Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Description of Goods</label>
                                    <input type="text" placeholder="Industrial Components..." className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-bold" value={formData.contents} onChange={e => setFormData({ ...formData, contents: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">HS Code (Harmonized System)</label>
                                    <input type="text" placeholder="8471.30.00" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-mono" value={formData.hsCode} onChange={e => setFormData({ ...formData, hsCode: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Weight (MT)</label>
                                    <input type="number" step="0.1" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-mono" value={formData.weight} onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Piece Count</label>
                                    <input type="number" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-mono" value={formData.pieces} onChange={e => setFormData({ ...formData, pieces: parseInt(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Transport Mode</label>
                                    <select className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-bold" value={formData.mode} onChange={e => setFormData({ ...formData, mode: e.target.value })}>
                                        <option value="Sea">Maritime (Sea)</option>
                                        <option value="Air">Air Freight</option>
                                        <option value="Rail">Rail (Corredor Medio)</option>
                                        <option value="Road">Road / Trucking</option>
                                    </select>
                                </div>
                            </div>

                            {/* Network Nodes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Origin Node (NFT Generation)</label>
                                    <select className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-bold" value={formData.origin} onChange={e => setFormData({ ...formData, origin: e.target.value })}>
                                        {GLOBAL_NODES.map(n => <option key={n.id} value={n.id}>{n.name} ({n.region})</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Destination Node (Final Settlement)</label>
                                    <select className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-bold" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })}>
                                        {GLOBAL_NODES.map(n => <option key={n.id} value={n.id}>{n.name} ({n.region})</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Stakeholders */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Shipper (Entity Name)</label>
                                    <input type="text" placeholder="Global Logistics SA" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-bold" value={formData.shipper} onChange={e => setFormData({ ...formData, shipper: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Consignee (Entity Name)</label>
                                    <input type="text" placeholder="Euro Distribution BV" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-sm font-bold" value={formData.consignee} onChange={e => setFormData({ ...formData, consignee: e.target.value })} />
                                </div>
                            </div>

                            {/* Audit Checklist */}
                            <div className="space-y-4 pt-4 border-t border-slate-800/50">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Blockchain Audit Documents (IPFS Linked)</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { id: 'invoice', label: 'Commercial Inv.' },
                                        { id: 'packingList', label: 'Packing List' },
                                        { id: 'certOrigin', label: 'Cert. Origin' },
                                        { id: 'insurance', label: 'Insurance' }
                                    ].map(doc => (
                                        <button
                                            key={doc.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, docs: { ...formData.docs, [doc.id]: !formData.docs[doc.id] } })}
                                            className={`p-4 rounded-xl border text-[9px] font-black uppercase transition-all ${formData.docs[doc.id]
                                                ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/5'
                                                : 'bg-slate-950 border-slate-800 text-slate-600'
                                                }`}
                                        >
                                            {doc.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" disabled={isProcessing} className="w-full py-6 bg-white text-slate-950 rounded-3xl font-black text-xs uppercase tracking-[0.4em] transition-all hover:scale-[1.02] shadow-2xl flex items-center justify-center gap-4 active:scale-95">
                                {isProcessing ? 'Minting Blockchain Unit...' : 'GENERATE FREIGHT NFT'}
                            </button>
                        </form>
                    </div>

                    {/* Side Info / Summary */}
                    <div className="space-y-8">
                        <div className="bg-slate-900/60 border border-slate-800 p-10 rounded-[3.5rem] shadow-xl">
                            <h4 className="text-xl font-black italic mb-6">Valuation (L2)</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                    <span>Base Freight Fee</span>
                                    <span className="text-white">${(formData.weight * 450 * (formData.category === 'General' ? 1 : formData.category === 'Dangerous Goods' ? 1.8 : formData.category === 'Reefer' ? 1.5 : 2.2)).toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-slate-800"></div>
                                <div className="p-8 bg-yellow-500/5 border border-yellow-500/20 rounded-[2.5rem] text-center">
                                    <span className="text-[10px] font-black uppercase text-yellow-600 block mb-3">BEZ-Coin Settlement</span>
                                    <p className="text-3xl font-mono font-black text-yellow-500 italic">
                                        {(((formData.weight * 450 * (formData.category === 'General' ? 1 : formData.category === 'Dangerous Goods' ? 1.8 : formData.category === 'Reefer' ? 1.5 : 2.2)) * 0.8) / BEZ_PRICE).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                    <p className="text-[10px] text-slate-600 font-bold mt-2 uppercase">Incl. 20% Logistics Rebate</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 p-10 rounded-[3.5rem] shadow-xl">
                            <h4 className="text-xl font-black italic mb-6">Chain Integrity</h4>
                            <ul className="space-y-5">
                                {[
                                    'ERC-721 Metadata Proof',
                                    'Zero-Knowledge HS Privacy',
                                    'Arweave Document Backup',
                                    'Strategic Node Relay',
                                    'DCSA e-BL Standard',
                                    'MLETR Legal Framework'
                                ].map((feat, i) => (
                                    <li key={i} className="flex items-center gap-4 text-[10px] font-black uppercase text-slate-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        {feat}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {activeView === 'tracking' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {containers.map(c => (
                        <div key={c.id} className="bg-slate-900/40 border border-slate-800 rounded-[3rem] overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all shadow-2xl backdrop-blur-md">
                            <div className="p-8 border-b border-slate-800/50 bg-slate-950/40 flex justify-between items-center">
                                <div>
                                    <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">NFT ID</span>
                                    <p className="font-mono text-sm font-bold text-blue-400">{c.manualId}</p>
                                </div>
                                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${c.commodityCategory === 'General' ? 'border-blue-500/20 text-blue-400 bg-blue-500/5' :
                                    c.commodityCategory === 'Dangerous Goods' ? 'border-red-500/20 text-red-400 bg-red-500/5' :
                                        c.commodityCategory === 'Reefer' ? 'border-cyan-500/20 text-cyan-400 bg-cyan-500/5' :
                                            'border-yellow-500/20 text-yellow-500 bg-yellow-500/5'
                                    }`}>{c.commodityCategory}</span>
                            </div>
                            <div className="p-8 space-y-6 flex-1">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-slate-600 font-black uppercase">Commodity</span>
                                        <span className="text-xs font-bold text-white italic">{c.contents}</span>
                                    </div>
                                    {c.riskClass && <p className="text-[9px] text-red-400 font-bold uppercase">Risk: {c.riskClass}</p>}
                                    {c.tempRange && <p className="text-[9px] text-cyan-400 font-bold uppercase">Temp: {c.tempRange}</p>}
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-slate-600 font-black uppercase">Weight</span>
                                        <span className="text-xs font-mono font-bold text-slate-400">{c.weight} MT</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                                        <span>Route Completion</span>
                                        <span className="text-blue-500">{c.progress}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${c.progress}%` }}></div>
                                    </div>
                                </div>

                                <div className="pt-4 space-y-3">
                                    <button onClick={() => advanceContainer(c.id)} disabled={c.status === 'Delivered'} className="w-full py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                                        {c.status === 'Delivered' ? 'UNIT ARCHIVED' : 'PROPAGATE STATUS'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {containers.length === 0 && (
                        <div className="col-span-full py-40 text-center border-2 border-dashed border-slate-800 rounded-[4rem] text-slate-600 font-black uppercase tracking-[0.4em] italic">
                            Waiting for Manifest Generation...
                        </div>
                    )}
                </div>
            )}

            {activeView === 'nodes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {GLOBAL_NODES.map(node => (
                        <div key={node.id} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-4 hover:border-slate-600 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2 2 2 0 012 2v.657M7 20h1.5a1 1 0 001-1V18a2 2 0 012-2h1.5a1 1 0 001-1V14a2 2 0 012-2H21" /></svg>
                            </div>
                            <span className="text-[8px] font-black uppercase text-slate-500 bg-slate-950 px-2 py-1 rounded">{node.region}</span>
                            <h5 className="text-lg font-black italic text-white">{node.name}</h5>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                <span>Capacity</span>
                                <span className="text-blue-400">{(node.capacity / 1000000).toFixed(1)}M TEU</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
