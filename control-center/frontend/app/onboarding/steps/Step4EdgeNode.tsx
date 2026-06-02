'use client';

import { useState } from 'react';
import { api } from '../../../lib/api';
import type { OnboardingData } from '../page';

interface Props {
    data: OnboardingData;
    update: (d: Partial<OnboardingData>) => void;
    next: () => void;
    prev: () => void;
}

const DOCKER_COMMAND = `docker run -d \\
  --name bezhas-edge-node \\
  --restart unless-stopped \\
  -e OPERATOR_KEY=<YOUR_PRIVATE_KEY> \\
  -e RPC_URL=\${RPC_URL:-http://localhost:8545} \\
  -e API_URL=\${API_URL:-http://localhost:3001/api} \\
  -e HEARTBEAT_INTERVAL=30000 \\
  -p 4000:4000 \\
  bezhas/edge-node:latest`;

const PNPM_COMMAND = `# Clonar e instalar
git clone https://github.com/bezhas/bezhas-edge-node.git
cd bezhas-edge-node
corepack enable
pnpm install

# Configurar .env
cp .env.example .env
# Editar OPERATOR_KEY, RPC_URL, API_URL

# Ejecutar
pnpm start`;

export default function Step4EdgeNode({ data, update, next }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [method, setMethod] = useState<'docker' | 'pnpm'>('docker');
    const [copied, setCopied] = useState(false);
    const [checkResult, setCheckResult] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

    const command = method === 'docker' ? DOCKER_COMMAND : PNPM_COMMAND;

    const copyCmd = () => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const checkNode = async () => {
        if (!data.nodeUrl.trim()) {
            setError('Ingrese la URL del Edge Node');
            return;
        }
        setCheckResult('checking');
        setError('');
        try {
            const token = localStorage.getItem('bezhas_token') || '';
            const res = await api.get<{ status: string }>(
                `/validators/node-health?url=${encodeURIComponent(data.nodeUrl)}`,
                { token },
            );
            if (res.status === 'ok' || res.status === 'healthy') {
                setCheckResult('ok');
                update({ nodeInstalled: true });
            } else {
                setCheckResult('fail');
            }
        } catch {
            setCheckResult('fail');
            setError('No se pudo conectar al Edge Node. Verifique que está ejecutándose.');
        }
    };

    const markDone = () => {
        update({ nodeInstalled: true });
        next();
    };

    return (
        <div className="space-y-6">
            <div className="border border-[#0D2040] rounded-xl p-6 bg-[#0C1628]">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    🖥️ Paso 4: Instalar Edge Node
                </h2>
                <p className="text-[#3D5E80] mt-2 text-sm">
                    El Edge Node ejecuta tareas de validación, envía heartbeats y acumula recompensas DePIN.
                    Instálelo en su servidor o máquina local.
                </p>

                {/* Method selection */}
                <div className="mt-5 flex gap-3">
                    <button
                        onClick={() => setMethod('docker')}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                            method === 'docker'
                                ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-400'
                                : 'border-[#0D2040] text-[#3D5E80] hover:border-[#1A3055]'
                        }`}
                    >
                        🐳 Docker (Recomendado)
                    </button>
                    <button
                        onClick={() => setMethod('pnpm')}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                            method === 'pnpm'
                                ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-400'
                                : 'border-[#0D2040] text-[#3D5E80] hover:border-[#1A3055]'
                        }`}
                    >
                        📦 Node.js / pnpm
                    </button>
                </div>

                {/* Command block */}
                <div className="mt-4 relative">
                    <pre className="p-4 bg-[#03060E] border border-[#0D2040] rounded-lg overflow-auto text-sm text-cyan-400/80 leading-relaxed">
                        {command}
                    </pre>
                    <button
                        onClick={copyCmd}
                        className="absolute top-2 right-2 px-3 py-1 rounded bg-[#0D2040] text-xs
                                   hover:bg-[#1A3055] transition-colors"
                    >
                        {copied ? '✓ Copiado' : 'Copiar'}
                    </button>
                </div>

                {/* Node URL + health check */}
                <div className="mt-6 space-y-4">
                    <p className="text-sm text-[#3D5E80]">Verificar conexión del Edge Node:</p>
                    <div className="flex gap-3">
                        <input
                            className="flex-1 bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                       focus:outline-none focus:border-cyan-500/60 transition-colors"
                            placeholder="http://localhost:4000"
                            value={data.nodeUrl}
                            onChange={(e) => update({ nodeUrl: e.target.value })}
                        />
                        <button
                            onClick={checkNode}
                            disabled={checkResult === 'checking'}
                            className="px-5 py-2.5 rounded-lg bg-[#0D2040] hover:bg-[#1A3055]
                                       transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            {checkResult === 'checking' ? 'Verificando...' : 'Verificar'}
                        </button>
                    </div>

                    {checkResult === 'ok' && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                            ✓ Edge Node conectado y funcionando correctamente
                        </div>
                    )}
                    {checkResult === 'fail' && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                            ⚠ No se pudo verificar el Edge Node. Asegúrese de que está ejecutándose.
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {data.nodeInstalled ? (
                    <div className="mt-5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <p className="text-emerald-400 font-medium">✓ Edge Node configurado</p>
                        <button
                            onClick={next}
                            className="mt-3 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm transition-colors"
                        >
                            Continuar al Paso 5 →
                        </button>
                    </div>
                ) : (
                    <div className="mt-5 flex items-center gap-3">
                        <button
                            onClick={markDone}
                            className="px-4 py-3 rounded-lg border border-[#0D2040] hover:bg-[#0C1628]
                                       text-sm text-[#3D5E80] transition-colors"
                        >
                            Marcar como instalado — Omitir verificación
                        </button>
                    </div>
                )}
            </div>

            {/* Requirements */}
            <div className="border border-[#0D2040] rounded-xl p-5 bg-[#0C1628]/50">
                <h3 className="text-sm font-semibold text-[#3D5E80]">📋 Requisitos del Edge Node</h3>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-[#03060E] border border-[#0D2040]">
                        <p className="font-medium text-sm">CPU</p>
                        <p className="text-xs text-[#3D5E80] mt-0.5">2+ cores</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#03060E] border border-[#0D2040]">
                        <p className="font-medium text-sm">RAM</p>
                        <p className="text-xs text-[#3D5E80] mt-0.5">4 GB mínimo</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#03060E] border border-[#0D2040]">
                        <p className="font-medium text-sm">Almacenamiento</p>
                        <p className="text-xs text-[#3D5E80] mt-0.5">20 GB SSD</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
