'use client';

import { useState } from 'react';
import Step1Wallet from './steps/Step1Wallet';
import Step2BezTokens from './steps/Step2BezTokens';
import Step3Validator from './steps/Step3Validator';
import Step4EdgeNode from './steps/Step4EdgeNode';
import Step5ErpWebhook from './steps/Step5ErpWebhook';

export interface OnboardingData {
    companyName: string;
    guardian: string;
    dailyLimit: string;
    walletAddress: string;
    walletCreated: boolean;
    operatorAddress: string;
    bridgeAmount: string;
    tokensAcquired: boolean;
    bezBalance: string;
    selectedTier: string;
    stakeAmount: string;
    validatorRegistered: boolean;
    nodeUrl: string;
    nodeInstalled: boolean;
    erpType: string;
    webhookUrl: string;
    webhookSecret: string;
    selectedSectors: string[];
    webhookConfigured: boolean;
}

const INITIAL: OnboardingData = {
    companyName: '',
    guardian: '',
    dailyLimit: '',
    walletAddress: '',
    walletCreated: false,
    operatorAddress: '',
    bridgeAmount: '',
    tokensAcquired: false,
    bezBalance: '',
    selectedTier: '',
    stakeAmount: '',
    validatorRegistered: false,
    nodeUrl: '',
    nodeInstalled: false,
    erpType: 'woocommerce',
    webhookUrl: '',
    webhookSecret: '',
    selectedSectors: [],
    webhookConfigured: false,
};

const STEPS = [
    { id: 1, title: 'Wallet', description: 'Cuenta multi-sig' },
    { id: 2, title: 'BEZ Tokens', description: 'Adquisición y bridge' },
    { id: 3, title: 'Validator', description: 'Stake y registro' },
    { id: 4, title: 'Edge Node', description: 'Instalación' },
    { id: 5, title: 'ERP / Webhook', description: 'API + WordPress' },
];

export default function OnboardingPage() {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<OnboardingData>(INITIAL);

    const update = (patch: Partial<OnboardingData>) => setData((prev) => ({ ...prev, ...patch }));
    const next = () => setStep((s) => Math.min(s + 1, STEPS.length));
    const prev = () => setStep((s) => Math.max(s - 1, 1));

    return (
        <div className="min-h-screen bg-[#F5F7FB] px-4 py-10">
            <div className="max-w-4xl mx-auto space-y-6">
                <header>
                    <p className="text-xs uppercase tracking-wider text-[#3D5E80]">Onboarding empresa</p>
                    <h1 className="text-2xl font-bold text-gray-900">Alta en la red BeZhas</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Cinco pasos: wallet → tokens → validador → edge node → ERP/Webhook.
                        Puedes salir en cualquier momento; el estado se guarda al avanzar.
                    </p>
                </header>

                <nav aria-label="Progreso" className="grid grid-cols-5 gap-2">
                    {STEPS.map((s) => {
                        const state = s.id === step ? 'active' : s.id < step ? 'done' : 'todo';
                        const base = 'rounded-lg border px-3 py-2 text-left transition';
                        const styles =
                            state === 'active'
                                ? 'border-bezhas-accent bg-white shadow-sm'
                                : state === 'done'
                                ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                : 'border-gray-200 bg-white/60 text-gray-400 cursor-not-allowed';
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => state !== 'todo' && setStep(s.id)}
                                disabled={state === 'todo'}
                                className={`${base} ${styles}`}
                            >
                                <div className="text-[11px] uppercase tracking-wider text-[#3D5E80]">
                                    Paso {s.id}
                                </div>
                                <div className="text-sm font-semibold text-gray-900">{s.title}</div>
                                <div className="text-[11px] text-gray-500">{s.description}</div>
                            </button>
                        );
                    })}
                </nav>

                <div>
                    {step === 1 && <Step1Wallet data={data} update={update} next={next} prev={prev} />}
                    {step === 2 && <Step2BezTokens data={data} update={update} next={next} prev={prev} />}
                    {step === 3 && <Step3Validator data={data} update={update} next={next} prev={prev} />}
                    {step === 4 && <Step4EdgeNode data={data} update={update} next={next} prev={prev} />}
                    {step === 5 && <Step5ErpWebhook data={data} update={update} next={next} prev={prev} />}
                </div>

                <div className="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onClick={prev}
                        disabled={step === 1}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        ← Anterior
                    </button>
                    <span className="text-xs text-gray-500">
                        Paso {step} de {STEPS.length}
                    </span>
                    <button
                        type="button"
                        onClick={next}
                        disabled={step === STEPS.length}
                        className="px-4 py-2 text-sm rounded-lg bg-bezhas-accent text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Siguiente →
                    </button>
                </div>
            </div>
        </div>
    );
}
