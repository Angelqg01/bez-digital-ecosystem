'use client';

import { useState } from 'react';
import Step5ErpWebhook from '../steps/Step5ErpWebhook';
import type { OnboardingData } from '../page';

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

export default function ErpWebhookStandalonePage() {
    const [data, setData] = useState<OnboardingData>(INITIAL);
    const update = (patch: Partial<OnboardingData>) => setData((prev) => ({ ...prev, ...patch }));
    const noop = () => { /* standalone view: no wizard navigation */ };

    return (
        <div className="min-h-screen bg-[#F5F7FB] px-4 py-10">
            <div className="max-w-3xl mx-auto space-y-4">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-[#3D5E80]">Integraciones</p>
                    <h1 className="text-2xl font-bold text-gray-900">API, Webhook y plugin WordPress</h1>
                    <p className="text-sm text-gray-600">
                        Configura el webhook que tu ERP (WooCommerce, SAP, Shopify…) usará para
                        recibir eventos de la plataforma. Requiere plan Professional o Enterprise.
                    </p>
                </div>
                <Step5ErpWebhook data={data} update={update} next={noop} prev={noop} />
            </div>
        </div>
    );
}
