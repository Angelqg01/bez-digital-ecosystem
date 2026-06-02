import React, { useState, useEffect, useCallback } from 'react';
import {
    Brain, Zap, Settings, Play, CheckCircle, Save,
    MessageSquare, Cpu, Workflow, Terminal, Trash2, Plug,
    Globe, GitBranch, Bug, Eye, Layers, Lock, Vote, Server, Truck, LineChart, Shield, TrendingUp, AlertCircle, RefreshCw, X, ArrowRight,
    Clock, Search, Mail, Filter, Code2, ArrowDown, Loader2, FileText, Copy, Plus, ChevronDown, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import http from '../../services/http';

// ─── Tool Icon/Color Registry ───
const TOOL_REGISTRY = {
    analyze_gas_strategy: { name: 'Polygon Gas MCP', icon: Zap, color: 'purple', category: 'Blockchain' },
    calculate_smart_swap: { name: 'Balance Swap MCP', icon: TrendingUp, color: 'blue', category: 'Blockchain' },
    verify_regulatory_compliance: { name: 'Compliance MCP', icon: Shield, color: 'green', category: 'Compliance' },
    github_repo_manager: { name: 'GitHub MCP', icon: GitBranch, color: 'purple', category: 'DevOps' },
    firecrawl_scraper: { name: 'Firecrawl MCP', icon: Globe, color: 'yellow', category: 'Intelligence' },
    playwright_automation: { name: 'Playwright MCP', icon: Bug, color: 'red', category: 'Testing' },
    blockscout_explorer: { name: 'Blockscout MCP', icon: Eye, color: 'blue', category: 'Blockchain' },
    skill_creator_ai: { name: 'Skill Creator AI', icon: Layers, color: 'purple', category: 'AI' },
    auditmos_security: { name: 'Auditmos Security', icon: Lock, color: 'red', category: 'Security' },
    tally_dao_governance: { name: 'Tally DAO MCP', icon: Vote, color: 'green', category: 'Governance' },
    obliq_ai_sre: { name: 'Obliq AI SRE', icon: Server, color: 'yellow', category: 'SRE' },
    kinaxis_supply_chain: { name: 'Kinaxis IoT MCP', icon: Truck, color: 'blue', category: 'IoT' },
    alpaca_markets: { name: 'Alpaca Markets MCP', icon: LineChart, color: 'green', category: 'Trading' },
    send_email: { name: 'Enviar Email', icon: Mail, color: 'blue', category: 'Communication' },
    http_request: { name: 'HTTP Request', icon: Globe, color: 'yellow', category: 'Integration' },
    delay: { name: 'Delay', icon: Clock, color: 'gray', category: 'Logic' },
    filter: { name: 'Filtrar', icon: Filter, color: 'green', category: 'Logic' },
    transform: { name: 'Transformar', icon: Code2, color: 'purple', category: 'Logic' },
};

function getToolInfo(toolId) {
    return TOOL_REGISTRY[toolId] || { name: toolId, icon: Cpu, color: 'gray', category: 'Unknown' };
}

const COLOR_CLASSES = {
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    gray: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

// ─── Step Node Component ───
const StepNode = ({ step, index, total, status, onConfigure }) => {
    const info = getToolInfo(step.toolId);
    const Icon = info.icon;
    const cls = COLOR_CLASSES[info.color] || COLOR_CLASSES.gray;
    const statusColor = status === 'success' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : status === 'running' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-600';

    return (
        <>
            <div className="w-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg hover:border-gray-500 transition-all cursor-pointer group relative">
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onConfigure && (
                        <button onClick={() => onConfigure(index)} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800">
                            <Settings size={14} />
                        </button>
                    )}
                </div>
                <div className="p-4 flex items-start gap-4">
                    <div className={`p-3 rounded-lg border ${cls}`}>
                        <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-500 uppercase">{info.category}</span>
                            <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                        </div>
                        <h4 className="font-semibold text-white">{step.toolName || info.name}</h4>
                        {step.params && Object.keys(step.params).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {Object.entries(step.params).filter(([k]) => !k.startsWith('_')).slice(0, 4).map(([k, v]) => (
                                    <span key={k} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                                        {k}: {typeof v === 'string' ? v.substring(0, 20) : JSON.stringify(v).substring(0, 20)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-gray-800/50 px-4 py-2 border-t border-gray-800 text-xs text-gray-400 flex justify-between items-center">
                    <span>Step {index + 1}</span>
                    <code className="text-[10px] bg-gray-950 px-2 py-0.5 rounded text-gray-500">{step.toolId}</code>
                </div>
            </div>
            {index < total - 1 && (
                <div className="my-2 flex flex-col items-center">
                    <div className="w-0.5 h-6 bg-gray-700"></div>
                    <div className="w-6 h-6 rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center -my-1 z-10 text-gray-500">
                        <ArrowDown size={12} />
                    </div>
                    <div className="w-0.5 h-6 bg-gray-700"></div>
                </div>
            )}
        </>
    );
};

// ─── Main Component ───
export default function AutomationHub() {
    const { address } = useAccount();
    const [activeTab, setActiveTab] = useState('builder');

    // Builder state
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedWorkflow, setGeneratedWorkflow] = useState(null);

    // Saved workflows
    const [savedWorkflows, setSavedWorkflows] = useState([]);
    const [loadingWorkflows, setLoadingWorkflows] = useState(false);

    // Templates
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Execution
    const [isRunning, setIsRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);

    // Logs
    const [logs, setLogs] = useState([]);

    // Config modal
    const [configStep, setConfigStep] = useState(null);

    // ─── Fetch helpers ───
    const adminHeaders = useCallback(() => ({
        headers: address ? { 'x-wallet-address': address } : {}
    }), [address]);

    const addLog = (msg, level = 'info') => {
        setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, level }, ...prev].slice(0, 100));
    };

    // ─── Generate workflow from prompt ───
    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        addLog(`Generando workflow: "${prompt}"`, 'info');

        try {
            const res = await http.post('/api/automation/generate', { prompt }, adminHeaders());
            const data = res.data?.data;
            if (data) {
                setGeneratedWorkflow(data);
                addLog(`✅ Workflow generado: "${data.name}" con ${data.steps?.length || 0} pasos`, 'success');
            }
        } catch (err) {
            addLog(`❌ Error generando: ${err.response?.data?.error || err.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── Save workflow ───
    const handleSave = async () => {
        if (!generatedWorkflow) return;
        try {
            const res = await http.post('/api/automation/workflows', {
                name: generatedWorkflow.name,
                description: generatedWorkflow.description,
                steps: generatedWorkflow.steps,
            }, adminHeaders());

            addLog(`💾 Workflow guardado: "${generatedWorkflow.name}"`, 'success');
            fetchSavedWorkflows();
            return res.data?.data;
        } catch (err) {
            addLog(`❌ Error guardando: ${err.response?.data?.error || err.message}`, 'error');
        }
    };

    // ─── Run inline (test unsaved workflow) ───
    const handleTestRun = async () => {
        if (!generatedWorkflow?.steps?.length) return;
        setIsRunning(true);
        setRunResult(null);
        addLog(`🚀 Ejecutando workflow de prueba...`, 'info');

        try {
            const res = await http.post('/api/automation/run-inline', {
                steps: generatedWorkflow.steps,
            }, adminHeaders());

            const result = res.data?.data;
            setRunResult(result);

            if (result?.status === 'success') {
                addLog(`✅ Ejecución exitosa (${result.stepResults?.length} pasos completados)`, 'success');
            } else {
                const failedStep = result?.stepResults?.find(s => s.status === 'failed');
                addLog(`⚠️ Ejecución terminó con status: ${result?.status}. Error en paso ${failedStep?.stepIndex}: ${failedStep?.error}`, 'error');
            }

            result?.stepResults?.forEach((sr, i) => {
                addLog(`  Step ${i + 1} (${sr.toolId}): ${sr.status} ${sr.error ? '→ ' + sr.error : ''}`, sr.status === 'success' ? 'info' : 'error');
            });
        } catch (err) {
            addLog(`❌ Error ejecutando: ${err.response?.data?.error || err.message}`, 'error');
        } finally {
            setIsRunning(false);
        }
    };

    // ─── Run saved workflow ───
    const handleRunSaved = async (workflowId) => {
        setIsRunning(true);
        addLog(`🚀 Ejecutando workflow guardado...`, 'info');
        try {
            const res = await http.post(`/api/automation/workflows/${workflowId}/run`, {}, adminHeaders());
            const result = res.data?.data;
            if (result?.status === 'success') {
                addLog(`✅ Workflow ejecutado exitosamente`, 'success');
            } else {
                addLog(`⚠️ Workflow terminó con status: ${result?.status}`, 'error');
            }
            fetchSavedWorkflows();
        } catch (err) {
            addLog(`❌ Error: ${err.response?.data?.error || err.message}`, 'error');
        } finally {
            setIsRunning(false);
        }
    };

    // ─── Delete saved workflow ───
    const handleDelete = async (workflowId) => {
        if (!window.confirm('¿Eliminar este workflow?')) return;
        try {
            await http.delete(`/api/automation/workflows/${workflowId}`, adminHeaders());
            addLog(`🗑️ Workflow eliminado`, 'info');
            fetchSavedWorkflows();
        } catch (err) {
            addLog(`❌ Error eliminando: ${err.response?.data?.error || err.message}`, 'error');
        }
    };

    // ─── Load template into builder ───
    const loadTemplate = (template) => {
        setGeneratedWorkflow({
            name: template.name,
            description: template.description,
            steps: template.steps,
        });
        setActiveTab('builder');
        addLog(`📋 Template cargado: "${template.name}"`, 'info');
    };

    // ─── Fetch saved workflows ───
    const fetchSavedWorkflows = useCallback(async () => {
        setLoadingWorkflows(true);
        try {
            const res = await http.get('/api/automation/workflows', adminHeaders());
            setSavedWorkflows(res.data?.data || []);
        } catch (err) {
            console.error('Error fetching workflows:', err);
        } finally {
            setLoadingWorkflows(false);
        }
    }, [adminHeaders]);

    // ─── Fetch templates ───
    const fetchTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        try {
            const res = await http.get('/api/automation/templates', adminHeaders());
            setTemplates(res.data?.data || []);
        } catch (err) {
            console.error('Error fetching templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    }, [adminHeaders]);

    useEffect(() => {
        fetchSavedWorkflows();
        fetchTemplates();
    }, [fetchSavedWorkflows, fetchTemplates]);

    // ─── Tabs ───
    const tabs = [
        { id: 'builder', label: 'Vibe Builder', icon: Brain },
        { id: 'templates', label: 'Templates', icon: FileText },
        { id: 'workflows', label: 'Mis Workflows', icon: Workflow },
        { id: 'catalog', label: 'MCP Catalog', icon: Plug },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between bg-gray-900/80 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg shadow-purple-500/20">
                            <Workflow size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Automation Hub</h1>
                            <p className="text-gray-400 text-sm">Crea automatizaciones con IA usando MCP tools · {savedWorkflows.length} workflows guardados</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/admin/ai"
                            className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Brain size={18} />
                            <span>Centro IA</span>
                        </Link>
                    </div>
                </div>

                {/* Tab Nav */}
                <div className="flex gap-2 p-1 bg-gray-900/50 rounded-lg border border-gray-800 w-fit">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-gray-400 hover:bg-gray-800'}`}
                            >
                                <Icon size={16} />
                                {tab.label}
                                {tab.id === 'workflows' && savedWorkflows.length > 0 && (
                                    <span className="ml-1 text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded-full">{savedWorkflows.length}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ═══ VIBE BUILDER TAB ═══ */}
                {activeTab === 'builder' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Left: Prompt + Logs */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <SparklesIcon /> Asistente de Flujos IA
                                </h2>
                                <p className="text-sm text-gray-400 mb-4">
                                    Describe lo que quieres automatizar. La IA generará un workflow real conectado a los MCP tools.
                                </p>

                                <div className="space-y-4">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Ej: Busca leads en LinkedIn del sector IA, filtra los CEOs y envíame un email con el resumen..."
                                        className="w-full h-32 bg-gray-950 border border-gray-700 rounded-xl p-4 text-sm text-gray-200 focus:outline-none focus:border-purple-500 resize-none transition-colors"
                                    />

                                    <button
                                        onClick={handleGenerate}
                                        disabled={!prompt.trim() || isGenerating}
                                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-medium transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                                    >
                                        {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Brain size={18} />}
                                        {isGenerating ? 'Generando con IA...' : 'Generar Workflow'}
                                    </button>
                                </div>

                                {/* Quick Prompts */}
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Prompts rápidos</p>
                                    {[
                                        'Buscar leads en LinkedIn del sector fintech',
                                        'Auditar seguridad del smart contract y notificar por email',
                                        'Monitorear precio BEZ y alertar si sube 10%',
                                        'Analizar repo GitHub y crear PR con docs',
                                    ].map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => setPrompt(q)}
                                            className="w-full text-left text-xs text-gray-400 hover:text-purple-400 bg-gray-800/50 hover:bg-gray-800 p-2 rounded-lg transition-colors"
                                        >
                                            💡 {q}
                                        </button>
                                    ))}
                                </div>

                                {/* Console Logs */}
                                <div className="mt-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Console Logs</h3>
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    </div>
                                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] space-y-1">
                                        {logs.map((log, i) => (
                                            <div key={i} className={`border-b border-gray-800/50 pb-1 ${log.level === 'error' ? 'text-red-400' : log.level === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                                                <span className="text-purple-400 mr-2">[{log.time}]</span>
                                                {log.msg}
                                            </div>
                                        ))}
                                        {logs.length === 0 && <div className="text-gray-600 italic">Esperando actividad...</div>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Workflow Canvas */}
                        <div className="lg:col-span-2">
                            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl h-full min-h-[600px] flex flex-col">
                                {/* Canvas Header */}
                                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Layers size={18} />
                                        <span className="font-medium text-sm">
                                            {generatedWorkflow ? generatedWorkflow.name : 'Workflow Canvas'}
                                        </span>
                                    </div>
                                    {generatedWorkflow && (
                                        <div className="flex gap-2">
                                            <button onClick={() => { setGeneratedWorkflow(null); setRunResult(null); }} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors" title="Limpiar">
                                                <Trash2 size={16} />
                                            </button>
                                            <button onClick={handleSave} className="px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                                                <Save size={16} /> Guardar
                                            </button>
                                            <button
                                                onClick={handleTestRun}
                                                disabled={isRunning}
                                                className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                                                {isRunning ? 'Ejecutando...' : 'Test Run'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Flow Area */}
                                <div className="flex-1 p-8 overflow-y-auto bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')]">
                                    {!generatedWorkflow ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                            <Workflow size={48} className="text-gray-700" />
                                            <p className="max-w-xs text-center text-sm">
                                                Escribe un prompt o selecciona un template para generar un workflow de automatización real.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center max-w-lg mx-auto pb-10">
                                            {/* Workflow header */}
                                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 w-full text-center shadow-xl shadow-black/50 mb-6">
                                                <h3 className="font-bold text-white mb-1">{generatedWorkflow.name}</h3>
                                                <p className="text-xs text-gray-400">{generatedWorkflow.description}</p>
                                                <p className="text-[10px] text-gray-500 mt-2">{generatedWorkflow.steps?.length || 0} pasos · Generado por IA</p>
                                            </div>

                                            {/* Steps */}
                                            {(generatedWorkflow.steps || []).map((step, idx) => {
                                                const sr = runResult?.stepResults?.[idx];
                                                return (
                                                    <StepNode
                                                        key={idx}
                                                        step={step}
                                                        index={idx}
                                                        total={generatedWorkflow.steps.length}
                                                        status={sr?.status}
                                                        onConfigure={setConfigStep}
                                                    />
                                                );
                                            })}

                                            {/* End node */}
                                            <div className="mt-8 flex items-center justify-center">
                                                <div className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-lg ${runResult?.status === 'success' ? 'border-green-500 bg-green-500/20 text-green-400' : runResult?.status === 'failed' ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-gray-700 bg-gray-800 text-gray-500'}`}>
                                                    <CheckCircle size={20} />
                                                </div>
                                            </div>

                                            {/* Run Result */}
                                            {runResult && (
                                                <div className={`mt-6 w-full border rounded-xl p-4 text-sm ${runResult.status === 'success' ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {runResult.status === 'success' ? <CheckCircle size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
                                                        <span className={runResult.status === 'success' ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                                                            {runResult.status === 'success' ? 'Ejecución Exitosa' : 'Ejecución con Errores'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 space-y-1">
                                                        {runResult.stepResults?.map((sr, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${sr.status === 'success' ? 'bg-green-500' : sr.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}`} />
                                                                <span>Step {i + 1} ({sr.toolId}): {sr.status}</span>
                                                                {sr.error && <span className="text-red-400">— {sr.error}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TEMPLATES TAB ═══ */}
                {activeTab === 'templates' && (
                    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 min-h-[400px]">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <FileText size={20} className="text-purple-400" />
                                Templates de Automatización
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">Workflows pre-construidos listos para usar. Selecciona uno para cargarlo en el builder.</p>
                        </div>

                        {loadingTemplates ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-purple-500" size={32} /></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {templates.map(template => (
                                    <div key={template.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition-all group">
                                        <div className="flex items-start justify-between mb-3">
                                            <h3 className="font-semibold text-white text-sm">{template.name}</h3>
                                            <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full">{template.category}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mb-4 line-clamp-2">{template.description}</p>
                                        <div className="flex flex-wrap gap-1 mb-4">
                                            {template.steps?.map((s, i) => {
                                                const info = getToolInfo(s.toolId);
                                                const Icon = info.icon;
                                                return (
                                                    <div key={i} className="flex items-center gap-1 text-[10px] bg-gray-900 text-gray-400 px-2 py-1 rounded">
                                                        <Icon size={10} />
                                                        <span>{info.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={() => loadTemplate(template)}
                                            className="w-full py-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Copy size={14} /> Usar Template
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ MY WORKFLOWS TAB ═══ */}
                {activeTab === 'workflows' && (
                    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Workflow size={20} className="text-blue-400" />
                                    Mis Workflows Guardados
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">{savedWorkflows.length} workflows · Click para ejecutar</p>
                            </div>
                            <button
                                onClick={fetchSavedWorkflows}
                                disabled={loadingWorkflows}
                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-sm flex items-center gap-2 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingWorkflows ? 'animate-spin' : ''}`} />
                                Actualizar
                            </button>
                        </div>

                        {loadingWorkflows ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-purple-500" size={32} /></div>
                        ) : savedWorkflows.length === 0 ? (
                            <div className="text-center text-gray-500 py-16">
                                <Workflow size={48} className="mx-auto mb-4 opacity-30" />
                                <p>No tienes workflows guardados</p>
                                <p className="text-xs mt-1">Usa el Builder o un Template para crear uno</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {savedWorkflows.map(wf => (
                                    <div key={wf._id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-white font-medium">{wf.name}</h4>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${wf.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-400'}`}>
                                                        {wf.status}
                                                    </span>
                                                </div>
                                                <p className="text-gray-500 text-sm mt-1 truncate">{wf.description}</p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                    <span>{wf.steps?.length || 0} pasos</span>
                                                    <span>Runs: {wf.totalRuns || 0}</span>
                                                    {wf.lastRun && <span>Último: {new Date(wf.lastRun).toLocaleDateString()}</span>}
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {(wf.steps || []).slice(0, 5).map((s, i) => {
                                                        const info = getToolInfo(s.toolId);
                                                        return <span key={i} className="text-[10px] bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded">{info.name}</span>;
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4">
                                                <button
                                                    onClick={() => handleRunSaved(wf._id)}
                                                    disabled={isRunning}
                                                    className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                                    title="Ejecutar"
                                                >
                                                    {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(wf._id)}
                                                    className="p-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ MCP CATALOG TAB ═══ */}
                {activeTab === 'catalog' && (
                    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 min-h-[600px]">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Plug size={20} className="text-blue-400" />
                                Catálogo de Conectores MCP + Built-in
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">
                                {Object.keys(TOOL_REGISTRY).length} herramientas disponibles para construir automatizaciones.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {Object.entries(TOOL_REGISTRY).map(([id, info]) => {
                                const Icon = info.icon;
                                const cls = COLOR_CLASSES[info.color] || COLOR_CLASSES.gray;
                                return (
                                    <div key={id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-500 transition-colors group">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className={`p-2 rounded-lg border flex-shrink-0 ${cls}`}>
                                                <Icon size={18} />
                                            </div>
                                            <span className="text-[10px] px-2 py-0.5 bg-gray-900 rounded border border-gray-700 text-gray-400 uppercase font-medium">
                                                {info.category}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-white text-sm mb-1">{info.name}</h3>
                                        <div className="bg-gray-900 rounded p-2 text-[10px] text-gray-500 font-mono">
                                            {id}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

const SparklesIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
        <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);
