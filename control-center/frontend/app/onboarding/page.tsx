'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/api';

type TierDef = { name: string; minStake: number; boostPct: number; color: string };

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

export default function OnboardingPage() {
    const [companyName, setCompanyName] = useState('Global Logistics S.A.');
    const [stakeAmountEth, setStakeAmountEth] = useState('50000');
    const [doHeartbeat, setDoHeartbeat] = useState(true);
    const [doRegisterNode, setDoRegisterNode] = useState(true);

    const { data: tiersData } = useSWR<{ tiers: Record<string, TierDef> }>('/validators/tiers', fetcher);
    const { data: contractsFlat } = useSWR<
        { contract_name: string; address: string }[]
    >('/contracts?flat=true', fetcher);

    const contractAddrs = useMemo(() => {
        const rows = contractsFlat || [];
        const pick = (name: string) => rows.find((r) => r.contract_name === name)?.address || '';
        return {
            bez: pick('BEZCoinV2'),
            validatorRegistry: pick('ValidatorRegistry'),
            edgeNodeRewards: pick('EdgeNodeRewards'),
        };
    }, [contractsFlat]);

    const cliCommand = useMemo(() => {
        const args = [
            'node scripts/register-validator.js',
            `--chainId ${process.env.NEXT_PUBLIC_CHAIN_ID || '31337'}`,
            `--rpcUrl ${process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'}`,
            `--companyName "${companyName}"`,
            `--stakeAmountEth ${stakeAmountEth}`,
            '--privateKey <DEPLOYER_PRIVATE_KEY>',
        ];
        // Provide overrides only when backend address registry doesn't have them yet.
        if (!contractAddrs.validatorRegistry) args.push('--validatorRegistryAddress <ValidatorRegistryAddress>');
        if (!contractAddrs.edgeNodeRewards) args.push('--edgeNodeRewardsAddress <EdgeNodeRewardsAddress>');
        if (!contractAddrs.bez) args.push('--bezAddress <BEZCoinV2Address>');

        if (doHeartbeat) args.push('--heartbeat');
        if (doRegisterNode) args.push('--registerNode');

        return args.join(' \\\\\n');
    }, [
        companyName,
        stakeAmountEth,
        doHeartbeat,
        doRegisterNode,
        contractAddrs.bez,
        contractAddrs.edgeNodeRewards,
        contractAddrs.validatorRegistry,
    ]);

    return (
        <div className="min-h-screen bg-[#03060E] text-[#E8F4FF] p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold">Onboarding Validator (Fase 12B)</h1>
                    <p className="text-[#3D5E80] mt-1">
                        Wizard mínimo para preparar el registro/heartbeat del validador. El registro on-chain se
                        ejecuta con el CLI (ver comando generado).
                    </p>
                </header>

                <section className="border border-[#0D2040] rounded-lg p-4 bg-[#0C1628]">
                    <h2 className="font-semibold">1) Datos del validador</h2>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="space-y-1">
                            <span className="text-sm text-[#3D5E80]">Company Name</span>
                            <input
                                className="w-full bg-[#03060E] border border-[#0D2040] rounded px-3 py-2"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-sm text-[#3D5E80]">Stake Amount (BEZ, ETH-decimals)</span>
                            <input
                                className="w-full bg-[#03060E] border border-[#0D2040] rounded px-3 py-2"
                                value={stakeAmountEth}
                                onChange={(e) => setStakeAmountEth(e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={doHeartbeat}
                                onChange={(e) => setDoHeartbeat(e.target.checked)}
                            />
                            Heartbeat
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={doRegisterNode}
                                onChange={(e) => setDoRegisterNode(e.target.checked)}
                            />
                            Register EdgeNode
                        </label>
                    </div>
                </section>

                <section className="border border-[#0D2040] rounded-lg p-4 bg-[#0C1628]">
                    <h2 className="font-semibold">2) Tier & Direcciones de contratos</h2>
                    <div className="mt-3 space-y-2 text-sm">
                        {tiersData?.tiers ? (
                            <>
                                <p className="text-[#3D5E80]">Tiers (min stake / boost):</p>
                                {Object.entries(tiersData.tiers).map(([tierId, def]) => (
                                    <div key={tierId}>
                                        <span className="font-semibold">Tier {def.name}:</span>{' '}
                                        <span>
                                            minStake={def.minStake} BEZ, boost={def.boostPct / 100}x
                                        </span>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <p className="text-[#3D5E80]">Cargando tiers...</p>
                        )}

                        <div className="pt-2 text-[#3D5E80]">Direcciones (desde backend):</div>
                        <div className="break-all">
                            <div>BEZCoinV2: {contractAddrs.bez || <span className="text-[#3D5E80]">No encontrado</span>}</div>
                            <div>ValidatorRegistry: {contractAddrs.validatorRegistry || <span className="text-[#3D5E80]">No encontrado</span>}</div>
                            <div>EdgeNodeRewards: {contractAddrs.edgeNodeRewards || <span className="text-[#3D5E80]">No encontrado</span>}</div>
                        </div>
                    </div>
                </section>

                <section className="border border-[#0D2040] rounded-lg p-4 bg-[#0C1628]">
                    <h2 className="font-semibold">3) Comando CLI</h2>
                    <p className="text-[#3D5E80] mt-2 text-sm">
                        Copia/pega este comando en tu terminal (ajustando `--privateKey` y overrides si faltan direcciones).
                    </p>
                    <pre className="mt-3 p-3 bg-[#03060E] border border-[#0D2040] rounded overflow-auto text-sm">
                        {cliCommand}
                    </pre>
                </section>
            </div>
        </div>
    );
}
