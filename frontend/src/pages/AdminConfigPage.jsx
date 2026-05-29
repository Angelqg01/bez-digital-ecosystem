import React, { useState, useEffect, useCallback } from 'react';
import {
    Settings,
    Save,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Coins,
    CreditCard,
    Leaf,
    Lock,
    Users,
    Building2,
    Shield,
    ToggleLeft,
    ToggleRight,
    Info,
    Loader2,
    Undo2,
    Cpu,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================
// Section Configuration Card Component
// ============================================
const ConfigSection = ({ title, icon: Icon, color, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${color}`}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white font-semibold text-lg">{title}</span>
                </div>
                {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
            </button>
            {isOpen && (
                <div className="p-4 pt-0 border-t border-gray-700/50">
                    {children}
                </div>
            )}
        </div>
    );
};

// ============================================
// Toggle Switch Component
// ============================================
const ToggleSwitch = ({ label, value, onChange, description }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-700/30 last:border-0">
        <div className="flex-1">
            <span className="text-white font-medium">{label}</span>
            {description && (
                <p className="text-gray-400 text-sm mt-1">{description}</p>
            )}
        </div>
        <button
            onClick={() => onChange(!value)}
            className={`p-1 rounded-full transition-colors ${value ? 'bg-green-500' : 'bg-gray-600'}`}
        >
            {value ? (
                <ToggleRight className="w-8 h-8 text-white" />
            ) : (
                <ToggleLeft className="w-8 h-8 text-gray-400" />
            )}
        </button>
    </div>
);

// ============================================
// Number Input Component
// ============================================
const NumberInput = ({ label, value, onChange, min, max, step = 1, suffix = '', description }) => (
    <div className="py-3 border-b border-gray-700/30 last:border-0">
        <div className="flex items-center justify-between mb-2">
            <span className="text-white font-medium">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    min={min}
                    max={max}
                    step={step}
                    className="w-24 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {suffix && <span className="text-gray-400">{suffix}</span>}
            </div>
        </div>
        {description && (
            <p className="text-gray-400 text-sm">{description}</p>
        )}
    </div>
);

// ============================================
// Text Input Component
// ============================================
const TextInput = ({ label, value, onChange, placeholder = '', description }) => (
    <div className="py-3 border-b border-gray-700/30 last:border-0">
        <label className="block text-white font-medium mb-2">{label}</label>
        <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {description && (
            <p className="text-gray-400 text-sm mt-1">{description}</p>
        )}
    </div>
);

// ============================================
// Select Input Component
// ============================================
const SelectInput = ({ label, value, onChange, options, description }) => (
    <div className="py-3 border-b border-gray-700/30 last:border-0">
        <div className="flex items-center justify-between mb-2">
            <span className="text-white font-medium">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
        {description && (
            <p className="text-gray-400 text-sm">{description}</p>
        )}
    </div>
);

// ============================================
// Main Admin Config Page Component
// ============================================
const AdminConfigPage = () => {
    const [settings, setSettings] = useState(null);
    const [originalSettings, setOriginalSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch settings on mount
    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_URL}/api/admin/settings/global`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data.success) {
                setSettings(response.data.settings);
                setOriginalSettings(JSON.parse(JSON.stringify(response.data.settings)));
                setHasChanges(false);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
            setError('Error al cargar la configuración. Verifica tu conexión.');
            toast.error('Error al cargar configuración');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Update a nested setting
    const updateSetting = (section, key, value) => {
        setSettings((prev) => {
            const updated = { ...prev };
            if (typeof key === 'string' && key.includes('.')) {
                // Handle nested keys like 'providers.stripe.enabled'
                const keys = key.split('.');
                let current = updated[section];
                for (let i = 0; i < keys.length - 1; i++) {
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = value;
            } else {
                updated[section] = { ...updated[section], [key]: value };
            }
            return updated;
        });
        setHasChanges(true);
    };

    // Save all settings
    const saveSettings = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.put(
                `${API_URL}/api/admin/settings/global`,
                settings,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                toast.success('✅ Configuración guardada correctamente');
                setOriginalSettings(JSON.parse(JSON.stringify(settings)));
                setHasChanges(false);
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            toast.error('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    // Reset to original
    const resetChanges = () => {
        setSettings(JSON.parse(JSON.stringify(originalSettings)));
        setHasChanges(false);
        toast.success('Cambios descartados');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-gray-400">Cargando configuración...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-400 text-center">{error}</p>
                    <button
                        onClick={fetchSettings}
                        className="mt-4 w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                            <Settings className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Panel de Configuración</h1>
                            <p className="text-gray-400">Gestiona todas las reglas de la plataforma</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasChanges && (
                            <button
                                onClick={resetChanges}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                <Undo2 className="w-4 h-4" />
                                Descartar
                            </button>
                        )}
                        <button
                            onClick={fetchSettings}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Recargar
                        </button>
                        <button
                            onClick={saveSettings}
                            disabled={!hasChanges || saving}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${hasChanges
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Guardar Cambios
                        </button>
                    </div>
                </div>

                {/* Change indicator */}
                {hasChanges && (
                    <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
                        <Info className="w-5 h-5 text-yellow-500" />
                        <span className="text-yellow-400">Tienes cambios sin guardar. Recuerda guardar antes de salir.</span>
                    </div>
                )}

                {/* Configuration Sections */}
                <div className="space-y-4">
                    {/* DeFi Configuration */}
                    <ConfigSection title="DeFi / Intercambio" icon={Coins} color="bg-blue-500" defaultOpen>
                        <ToggleSwitch
                            label="DeFi Habilitado"
                            value={settings?.defi?.enabled}
                            onChange={(v) => updateSetting('defi', 'enabled', v)}
                            description="Activa o desactiva todas las funciones DeFi"
                        />
                        <NumberInput
                            label="Comisión de Swap"
                            value={settings?.defi?.swapFeePercent}
                            onChange={(v) => updateSetting('defi', 'swapFeePercent', v)}
                            min={0}
                            max={10}
                            step={0.1}
                            suffix="%"
                            description="Porcentaje cobrado por cada intercambio"
                        />
                        <NumberInput
                            label="Slippage Máximo"
                            value={settings?.defi?.maxSlippage}
                            onChange={(v) => updateSetting('defi', 'maxSlippage', v)}
                            min={0.1}
                            max={50}
                            step={0.1}
                            suffix="%"
                            description="Deslizamiento máximo permitido en swaps"
                        />
                        <NumberInput
                            label="Comisión de Bridge"
                            value={settings?.defi?.bridgeFeePercent}
                            onChange={(v) => updateSetting('defi', 'bridgeFeePercent', v)}
                            min={0}
                            max={5}
                            step={0.1}
                            suffix="%"
                        />
                        <NumberInput
                            label="Monto Mínimo de Swap"
                            value={settings?.defi?.minSwapAmount}
                            onChange={(v) => updateSetting('defi', 'minSwapAmount', v)}
                            min={0}
                            suffix="tokens"
                        />
                        <NumberInput
                            label="Monto Máximo de Swap"
                            value={settings?.defi?.maxSwapAmount}
                            onChange={(v) => updateSetting('defi', 'maxSwapAmount', v)}
                            min={1}
                            suffix="tokens"
                        />
                    </ConfigSection>

                    {/* Fiat Gateway Configuration */}
                    <ConfigSection title="Pasarela Fiat" icon={CreditCard} color="bg-green-500">
                        <ToggleSwitch
                            label="Pasarela Fiat Habilitada"
                            value={settings?.fiat?.enabled}
                            onChange={(v) => updateSetting('fiat', 'enabled', v)}
                        />
                        <ToggleSwitch
                            label="Stripe Habilitado"
                            value={settings?.fiat?.providers?.stripe?.enabled}
                            onChange={(v) => {
                                setSettings(prev => ({
                                    ...prev,
                                    fiat: {
                                        ...prev.fiat,
                                        providers: {
                                            ...prev.fiat.providers,
                                            stripe: { ...prev.fiat.providers.stripe, enabled: v }
                                        }
                                    }
                                }));
                                setHasChanges(true);
                            }}
                        />
                        <ToggleSwitch
                            label="Transferencia Bancaria"
                            value={settings?.fiat?.providers?.bankTransfer?.enabled}
                            onChange={(v) => {
                                setSettings(prev => ({
                                    ...prev,
                                    fiat: {
                                        ...prev.fiat,
                                        providers: {
                                            ...prev.fiat.providers,
                                            bankTransfer: { ...prev.fiat.providers.bankTransfer, enabled: v }
                                        }
                                    }
                                }));
                                setHasChanges(true);
                            }}
                        />
                        <ToggleSwitch
                            label="KYC Requerido"
                            value={settings?.fiat?.kycRequired}
                            onChange={(v) => updateSetting('fiat', 'kycRequired', v)}
                            description="Verificación de identidad obligatoria"
                        />
                        <NumberInput
                            label="Compra Mínima"
                            value={settings?.fiat?.minPurchaseUSD}
                            onChange={(v) => updateSetting('fiat', 'minPurchaseUSD', v)}
                            min={1}
                            suffix="USD"
                        />
                        <NumberInput
                            label="Compra Máxima"
                            value={settings?.fiat?.maxPurchaseUSD}
                            onChange={(v) => updateSetting('fiat', 'maxPurchaseUSD', v)}
                            min={100}
                            suffix="USD"
                        />
                        <NumberInput
                            label="Umbral KYC"
                            value={settings?.fiat?.kycThresholdUSD}
                            onChange={(v) => updateSetting('fiat', 'kycThresholdUSD', v)}
                            min={0}
                            suffix="USD"
                            description="Monto a partir del cual se requiere KYC"
                        />
                    </ConfigSection>

                    {/* Token BEZ Configuration */}
                    <ConfigSection title="Token BEZ" icon={Shield} color="bg-purple-500">
                        <TextInput
                            label="Dirección del Contrato"
                            value={settings?.token?.contractAddress}
                            onChange={(v) => updateSetting('token', 'contractAddress', v)}
                            description="Dirección del contrato en Polygon Mainnet"
                        />
                        <TextInput
                            label="Símbolo"
                            value={settings?.token?.symbol}
                            onChange={(v) => updateSetting('token', 'symbol', v)}
                        />
                        <NumberInput
                            label="Decimales"
                            value={settings?.token?.decimals}
                            onChange={(v) => updateSetting('token', 'decimals', v)}
                            min={0}
                            max={18}
                        />
                        <ToggleSwitch
                            label="Minting Habilitado"
                            value={settings?.token?.mintingEnabled}
                            onChange={(v) => updateSetting('token', 'mintingEnabled', v)}
                            description="Permitir la creación de nuevos tokens"
                        />
                        <ToggleSwitch
                            label="Burning Habilitado"
                            value={settings?.token?.burningEnabled}
                            onChange={(v) => updateSetting('token', 'burningEnabled', v)}
                            description="Permitir la destrucción de tokens"
                        />
                        <NumberInput
                            label="Comisión por Transferencia"
                            value={settings?.token?.transferFeePercent}
                            onChange={(v) => updateSetting('token', 'transferFeePercent', v)}
                            min={0}
                            max={10}
                            step={0.1}
                            suffix="%"
                        />
                    </ConfigSection>

                    {/* Farming Configuration */}
                    <ConfigSection title="Farming / Yield" icon={Leaf} color="bg-emerald-500">
                        <ToggleSwitch
                            label="Farming Habilitado"
                            value={settings?.farming?.enabled}
                            onChange={(v) => updateSetting('farming', 'enabled', v)}
                        />
                        <NumberInput
                            label="APY por Defecto"
                            value={settings?.farming?.defaultAPY}
                            onChange={(v) => updateSetting('farming', 'defaultAPY', v)}
                            min={0}
                            max={1000}
                            suffix="%"
                        />
                        <NumberInput
                            label="Bloqueo de Cosecha (horas)"
                            value={settings?.farming?.harvestLockHours}
                            onChange={(v) => updateSetting('farming', 'harvestLockHours', v)}
                            min={0}
                            max={168}
                            description="Tiempo mínimo entre cosechas"
                        />
                        <NumberInput
                            label="Penalización por Retiro Anticipado"
                            value={settings?.farming?.earlyWithdrawalPenalty}
                            onChange={(v) => updateSetting('farming', 'earlyWithdrawalPenalty', v)}
                            min={0}
                            max={50}
                            suffix="%"
                        />
                        <TextInput
                            label="Recompensas por Bloque"
                            value={settings?.farming?.rewardsPerBlock}
                            onChange={(v) => updateSetting('farming', 'rewardsPerBlock', v)}
                            description="Cantidad de tokens BEZ distribuidos por bloque"
                        />
                    </ConfigSection>

                    {/* Staking Configuration */}
                    <ConfigSection title="Staking" icon={Lock} color="bg-orange-500">
                        <ToggleSwitch
                            label="Staking Habilitado"
                            value={settings?.staking?.enabled}
                            onChange={(v) => updateSetting('staking', 'enabled', v)}
                        />
                        <NumberInput
                            label="Tasa de Recompensa"
                            value={settings?.staking?.rewardRatePercent}
                            onChange={(v) => updateSetting('staking', 'rewardRatePercent', v)}
                            min={0}
                            max={100}
                            suffix="%"
                        />
                        <TextInput
                            label="Stake Mínimo"
                            value={settings?.staking?.minStakeAmount}
                            onChange={(v) => updateSetting('staking', 'minStakeAmount', v)}
                            description="Cantidad mínima de tokens para hacer staking"
                        />
                        <TextInput
                            label="Stake Máximo"
                            value={settings?.staking?.maxStakeAmount}
                            onChange={(v) => updateSetting('staking', 'maxStakeAmount', v)}
                        />
                        <ToggleSwitch
                            label="Auto-Compounding"
                            value={settings?.staking?.compoundingEnabled}
                            onChange={(v) => updateSetting('staking', 'compoundingEnabled', v)}
                            description="Reinvertir automáticamente las recompensas"
                        />
                        <NumberInput
                            label="Frecuencia de Compounding (horas)"
                            value={settings?.staking?.compoundFrequencyHours}
                            onChange={(v) => updateSetting('staking', 'compoundFrequencyHours', v)}
                            min={1}
                            max={168}
                        />
                        <NumberInput
                            label="Cooldown de Unstake (horas)"
                            value={settings?.staking?.unstakeCooldownHours}
                            onChange={(v) => updateSetting('staking', 'unstakeCooldownHours', v)}
                            min={0}
                            max={720}
                        />
                        <ToggleSwitch
                            label="Slashing Habilitado"
                            value={settings?.staking?.slashingEnabled}
                            onChange={(v) => updateSetting('staking', 'slashingEnabled', v)}
                            description="Penalizar comportamiento malicioso"
                        />
                    </ConfigSection>

                    {/* DAO Configuration */}
                    <ConfigSection title="DAO / Gobernanza" icon={Users} color="bg-indigo-500">
                        <ToggleSwitch
                            label="DAO Habilitado"
                            value={settings?.dao?.enabled}
                            onChange={(v) => updateSetting('dao', 'enabled', v)}
                        />
                        <NumberInput
                            label="Quórum"
                            value={settings?.dao?.quorumPercentage}
                            onChange={(v) => updateSetting('dao', 'quorumPercentage', v)}
                            min={1}
                            max={100}
                            suffix="%"
                            description="Porcentaje mínimo de participación para validar votación"
                        />
                        <NumberInput
                            label="Período de Votación"
                            value={settings?.dao?.votingPeriodDays}
                            onChange={(v) => updateSetting('dao', 'votingPeriodDays', v)}
                            min={1}
                            max={30}
                            suffix="días"
                        />
                        <TextInput
                            label="Umbral de Propuesta"
                            value={settings?.dao?.proposalThreshold}
                            onChange={(v) => updateSetting('dao', 'proposalThreshold', v)}
                            description="Tokens mínimos para crear una propuesta"
                        />
                        <NumberInput
                            label="Retraso de Ejecución"
                            value={settings?.dao?.executionDelayHours}
                            onChange={(v) => updateSetting('dao', 'executionDelayHours', v)}
                            min={0}
                            max={168}
                            suffix="horas"
                        />
                        <ToggleSwitch
                            label="Delegación Permitida"
                            value={settings?.dao?.allowDelegation}
                            onChange={(v) => updateSetting('dao', 'allowDelegation', v)}
                        />
                        <TextInput
                            label="Recompensa por Voto"
                            value={settings?.dao?.rewardPerVote}
                            onChange={(v) => updateSetting('dao', 'rewardPerVote', v)}
                            description="Tokens ganados por participar en votación"
                        />
                        <ToggleSwitch
                            label="Veto Habilitado"
                            value={settings?.dao?.vetoEnabled}
                            onChange={(v) => updateSetting('dao', 'vetoEnabled', v)}
                            description="Permitir veto de propuestas"
                        />
                    </ConfigSection>

                    {/* RWA Configuration */}
                    <ConfigSection title="RWA (Activos del Mundo Real)" icon={Building2} color="bg-teal-500">
                        <ToggleSwitch
                            label="RWA Habilitado"
                            value={settings?.rwa?.enabled}
                            onChange={(v) => updateSetting('rwa', 'enabled', v)}
                        />
                        <NumberInput
                            label="Inversión Mínima"
                            value={settings?.rwa?.minInvestmentUSD}
                            onChange={(v) => updateSetting('rwa', 'minInvestmentUSD', v)}
                            min={1}
                            suffix="USD"
                        />
                        <NumberInput
                            label="Inversión Máxima"
                            value={settings?.rwa?.maxInvestmentUSD}
                            onChange={(v) => updateSetting('rwa', 'maxInvestmentUSD', v)}
                            min={100}
                            suffix="USD"
                        />
                        <NumberInput
                            label="Comisión de Plataforma"
                            value={settings?.rwa?.platformFeePercent}
                            onChange={(v) => updateSetting('rwa', 'platformFeePercent', v)}
                            min={0}
                            max={10}
                            step={0.1}
                            suffix="%"
                        />
                        <ToggleSwitch
                            label="KYC Requerido"
                            value={settings?.rwa?.kycRequired}
                            onChange={(v) => updateSetting('rwa', 'kycRequired', v)}
                        />
                        <ToggleSwitch
                            label="Inversor Acreditado Requerido"
                            value={settings?.rwa?.accreditedInvestorRequired}
                            onChange={(v) => updateSetting('rwa', 'accreditedInvestorRequired', v)}
                        />
                        <SelectInput
                            label="Estándar de Tokenización"
                            value={settings?.rwa?.tokenizationStandard}
                            onChange={(v) => updateSetting('rwa', 'tokenizationStandard', v)}
                            options={[
                                { value: 'ERC-721', label: 'ERC-721 (NFT Único)' },
                                { value: 'ERC-1155', label: 'ERC-1155 (Multi-Token)' },
                                { value: 'ERC-20', label: 'ERC-20 (Fungible)' },
                            ]}
                        />
                        <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                            <p className="text-sm text-gray-400 mb-2">Categorías de Activos:</p>
                            <div className="grid grid-cols-2 gap-2">
                                <ToggleSwitch
                                    label="Bienes Raíces"
                                    value={settings?.rwa?.assetCategories?.realEstate?.enabled}
                                    onChange={(v) => {
                                        setSettings(prev => ({
                                            ...prev,
                                            rwa: {
                                                ...prev.rwa,
                                                assetCategories: {
                                                    ...prev.rwa.assetCategories,
                                                    realEstate: { enabled: v }
                                                }
                                            }
                                        }));
                                        setHasChanges(true);
                                    }}
                                />
                                <ToggleSwitch
                                    label="Commodities"
                                    value={settings?.rwa?.assetCategories?.commodities?.enabled}
                                    onChange={(v) => {
                                        setSettings(prev => ({
                                            ...prev,
                                            rwa: {
                                                ...prev.rwa,
                                                assetCategories: {
                                                    ...prev.rwa.assetCategories,
                                                    commodities: { enabled: v }
                                                }
                                            }
                                        }));
                                        setHasChanges(true);
                                    }}
                                />
                                <ToggleSwitch
                                    label="Arte"
                                    value={settings?.rwa?.assetCategories?.art?.enabled}
                                    onChange={(v) => {
                                        setSettings(prev => ({
                                            ...prev,
                                            rwa: {
                                                ...prev.rwa,
                                                assetCategories: {
                                                    ...prev.rwa.assetCategories,
                                                    art: { enabled: v }
                                                }
                                            }
                                        }));
                                        setHasChanges(true);
                                    }}
                                />
                                <ToggleSwitch
                                    label="Coleccionables"
                                    value={settings?.rwa?.assetCategories?.collectibles?.enabled}
                                    onChange={(v) => {
                                        setSettings(prev => ({
                                            ...prev,
                                            rwa: {
                                                ...prev.rwa,
                                                assetCategories: {
                                                    ...prev.rwa.assetCategories,
                                                    collectibles: { enabled: v }
                                                }
                                            }
                                        }));
                                        setHasChanges(true);
                                    }}
                                />
                            </div>
                        </div>
                    </ConfigSection>

                    {/* OpenClaw AI Agent Configuration */}
                    <ConfigSection title="OpenClaw AI Agent" icon={Cpu} color="bg-rose-500">
                        <ToggleSwitch
                            label="OpenClaw Habilitado"
                            value={settings?.openclaw?.enabled}
                            onChange={(v) => updateSetting('openclaw', 'enabled', v)}
                            description="Activa el aprovisionamiento automático de agentes IA"
                        />
                        <TextInput
                            label="URL Base del Agente"
                            value={settings?.openclaw?.baseUrl}
                            onChange={(v) => updateSetting('openclaw', 'baseUrl', v)}
                            description="Endpoint de la API de OpenClaw"
                        />
                        <TextInput
                            label="Global API Key"
                            value={settings?.openclaw?.apiKey}
                            onChange={(v) => updateSetting('openclaw', 'apiKey', v)}
                            description="Clave maestra para comunicación Bridge-OpenClaw"
                        />

                        <div className="mt-4 p-4 bg-gray-700/30 rounded-xl border border-gray-700/50">
                            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-rose-400" />
                                Configuración de Planes
                            </h4>
                            
                            {/* Pro Plan Limits (Example of editable plan) */}
                            <div className="space-y-4">
                                <div className="border-b border-gray-700/50 pb-4">
                                    <p className="text-rose-400 text-xs font-bold uppercase mb-2">Plan Pro (Creator)</p>
                                    <NumberInput
                                        label="Límite de Plataformas"
                                        value={settings?.openclaw?.plans?.pro?.platforms}
                                        onChange={(v) => updateSetting('openclaw', 'plans.pro.platforms', v)}
                                        min={1}
                                    />
                                    <NumberInput
                                        label="TTL de Credenciales (días)"
                                        value={settings?.openclaw?.plans?.pro?.credentialTTL}
                                        onChange={(v) => updateSetting('openclaw', 'plans.pro.credentialTTL', v)}
                                        min={1}
                                    />
                                    <TextInput
                                        label="Intervalo de Sincronización"
                                        value={settings?.openclaw?.plans?.pro?.syncInterval}
                                        onChange={(v) => updateSetting('openclaw', 'plans.pro.syncInterval', v)}
                                    />
                                </div>

                                <div className="pb-2">
                                    <p className="text-rose-400 text-xs font-bold uppercase mb-2">Plan Enterprise (Business)</p>
                                    <NumberInput
                                        label="Límite de Plataformas"
                                        value={settings?.openclaw?.plans?.enterprise?.platforms}
                                        onChange={(v) => updateSetting('openclaw', 'plans.enterprise.platforms', v)}
                                        min={1}
                                    />
                                    <NumberInput
                                        label="Rate Limit (Req/Min)"
                                        value={settings?.openclaw?.plans?.enterprise?.rateLimit}
                                        onChange={(v) => updateSetting('openclaw', 'plans.enterprise.rateLimit', v)}
                                        min={1}
                                    />
                                </div>
                            </div>
                        </div>
                    </ConfigSection>

                    {/* Platform General Settings */}
                    <ConfigSection title="Configuración General" icon={Settings} color="bg-gray-500">
                        <ToggleSwitch
                            label="Modo Mantenimiento"
                            value={settings?.platform?.maintenanceMode}
                            onChange={(v) => updateSetting('platform', 'maintenanceMode', v)}
                            description="Desactiva el acceso público a la plataforma"
                        />
                        <TextInput
                            label="Mensaje de Mantenimiento"
                            value={settings?.platform?.maintenanceMessage}
                            onChange={(v) => updateSetting('platform', 'maintenanceMessage', v)}
                        />
                        <ToggleSwitch
                            label="Registros Habilitados"
                            value={settings?.platform?.registrationEnabled}
                            onChange={(v) => updateSetting('platform', 'registrationEnabled', v)}
                        />
                        <ToggleSwitch
                            label="Verificación de Email"
                            value={settings?.platform?.emailVerificationRequired}
                            onChange={(v) => updateSetting('platform', 'emailVerificationRequired', v)}
                        />
                        <NumberInput
                            label="Intentos de Login Máximos"
                            value={settings?.platform?.maxLoginAttempts}
                            onChange={(v) => updateSetting('platform', 'maxLoginAttempts', v)}
                            min={1}
                            max={20}
                        />
                        <NumberInput
                            label="Timeout de Sesión"
                            value={settings?.platform?.sessionTimeoutMinutes}
                            onChange={(v) => updateSetting('platform', 'sessionTimeoutMinutes', v)}
                            min={5}
                            max={1440}
                            suffix="minutos"
                        />
                        <SelectInput
                            label="Nivel de Logging"
                            value={settings?.platform?.loggingLevel}
                            onChange={(v) => updateSetting('platform', 'loggingLevel', v)}
                            options={[
                                { value: 'debug', label: 'Debug (Detallado)' },
                                { value: 'info', label: 'Info (Normal)' },
                                { value: 'warn', label: 'Warning (Solo alertas)' },
                                { value: 'error', label: 'Error (Solo errores)' },
                            ]}
                        />
                    </ConfigSection>
                </div>

                {/* Version info */}
                <div className="mt-8 text-center text-gray-500 text-sm">
                    <p>Versión de configuración: {settings?.version || 1}</p>
                    <p>Última actualización: {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'N/A'}</p>
                </div>
            </div>
        </div>
    );
};

export default AdminConfigPage;
