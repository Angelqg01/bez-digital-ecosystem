import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bot, Mail, MessageSquare, Briefcase, RefreshCw, Play, ShieldAlert, Monitor, CheckCircle, Zap } from 'lucide-react';

const AgentDashboard = () => {
    const [status, setStatus] = useState({
        scraper: { state: 'Loading...', totalLeadsCaptured: 0 },
        messaging: { state: 'Loading...', totalMessagesSent: 0 },
        wallet: { status: 'Checking...' }
    });

    const [isScraping, setIsScraping] = useState(false);
    const [testResponse, setTestResponse] = useState(null);

    // Formulario de Campaña
    const [sector, setSector] = useState('logistics');
    const [limit, setLimit] = useState(5);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const response = await axios.get('/api/agents/status');
            if (response.data.success) {
                setStatus(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching global agent status:', error);
        }
    };

    const startCampaign = async () => {
        setIsScraping(true);
        try {
            await axios.post('/api/agents/campaign/start', {
                sector,
                limit: parseInt(limit, 10),
                keywords: 'enterprise AI blockchain'
            });
            setTimeout(() => {
                fetchStatus();
                setIsScraping(false);
            }, 3000);
        } catch (error) {
            console.error('Failure starting campaign:', error);
            setIsScraping(false);
        }
    };

    const runSmokeTest = async () => {
        try {
            setTestResponse('Enviando Pitch de Prueba...');
            const res = await axios.post('/api/agents/test-pitch', {
                email: 'test-director@empresa.com',
                type: 'B2B',
                companyName: 'BeZhas Smoke Corp',
                phone: '+15555555555' // trigger whatsapp
            });
            setTestResponse(res.data);
        } catch (error) {
            setTestResponse({ error: error.message });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-600 flex items-center gap-3">
                        <Bot className="w-8 h-8 text-purple-500" />
                        Centro de AIOps Global (Nivel 5)
                    </h1>
                    <p className="text-gray-400 mt-2">Monitorea y orquesta tus Agentes Autónomos de Adquisición.</p>
                </div>
                <button
                    onClick={fetchStatus}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
                >
                    <RefreshCw className="w-4 h-4" /> Sincronizar
                </button>
            </div>

            {/* STATUS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Monitor className="w-5 h-5 text-blue-400" />
                            <h3 className="text-lg font-semibold text-white">Lead Scraper Agent</h3>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">Estado actual del rastreador automático de URLs institucionales y corporativas.</p>
                    </div>
                    <div>
                        <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md mb-2">
                            <span className="text-sm text-gray-400">Estado</span>
                            <span className={`text-sm font-bold ${status.scraper.state === 'Idle' ? 'text-green-400' : 'text-yellow-400'}`}>
                                {status.scraper.state}
                            </span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md">
                            <span className="text-sm text-gray-400">Leads Encontrados</span>
                            <span className="text-xl font-bold text-white">{status.scraper.totalLeadsCaptured}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-5 h-5 text-indigo-400" />
                            <h3 className="text-lg font-semibold text-white">Outbound Messaging</h3>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">Motor de mensajería IA que negocia y envía tokens iniciales.</p>
                    </div>
                    <div>
                        <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md mb-2">
                            <span className="text-sm text-gray-400">Estado</span>
                            <span className="text-sm font-bold text-green-400">{status.messaging.state}</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md">
                            <span className="text-sm text-gray-400">Mensajes Emitidos</span>
                            <span className="text-xl font-bold text-white">{status.messaging.totalMessagesSent}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Briefcase className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-lg font-semibold text-white">Fondos de Tesorería</h3>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">Aprobación de crédito para nuevos leads corporativos o estatales.</p>
                    </div>
                    <div>
                        <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md mb-2">
                            <span className="text-sm text-gray-400">Estado Conexión</span>
                            <span className="text-sm font-bold text-green-400">{status.wallet.status}</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md">
                            <span className="text-sm text-gray-400">Presupuesto Growth</span>
                            <span className="text-xl font-bold text-emerald-400">Ilimitado (GCP Mode)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTROLS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* CAMPAÑA MANUAL */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        Lanzar Campaña Autónoma
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Sector Objetivo</label>
                            <select
                                value={sector}
                                onChange={(e) => setSector(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                <option value="logistics">Empresas Logísticas</option>
                                <option value="government">Entidades Gubernamentales</option>
                                <option value="real_estate">Inversiones & Bienes Raíces</option>
                                <option value="ecommerce">E-Commerce</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Volumen de Prospección (Nodos a escanear)</label>
                            <input
                                type="number"
                                value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>

                        <button
                            onClick={startCampaign}
                            disabled={isScraping}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all mt-4 ${isScraping ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'
                                }`}
                        >
                            <Play className="w-5 h-5" />
                            {isScraping ? 'Iniciando IA...' : 'Disparar Agentes'}
                        </button>
                    </div>
                </div>

                {/* SMOKE TEST */}
                <div className="bg-blue-900/20 border border-blue-800/50 p-6 rounded-xl">
                    <h3 className="text-xl font-semibold text-blue-400 flex items-center gap-2 mb-6">
                        <ShieldAlert className="w-5 h-5" />
                        Simulador Smoke Test (Módulo 5)
                    </h3>
                    <p className="text-gray-300 mb-6 text-sm">
                        Permite ejecutar el pipeline de IA "Pitch Generation → Message Delivery" directamente desde la consola, usando mock data, para validar la arquitectura base.
                    </p>

                    <button
                        onClick={runSmokeTest}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all"
                    >
                        <CheckCircle className="w-5 h-5" />
                        Trigger Smoke Test Pipeline
                    </button>

                    {testResponse && (
                        <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-lg overflow-x-auto">
                            <pre className="text-xs text-green-400 whitespace-pre-wrap">
                                {JSON.stringify(testResponse, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
