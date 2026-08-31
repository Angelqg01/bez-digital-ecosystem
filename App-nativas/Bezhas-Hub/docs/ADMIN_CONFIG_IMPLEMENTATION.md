# Admin Unified Configuration Page - Implementation Complete

**Fecha:** 24 de Enero 2026
**Estado:** ✅ Implementado

---

## Resumen

Se ha creado un **Panel de Configuración Unificado** para el Admin que permite gestionar todas las reglas y parámetros de la plataforma. Los cambios realizados por el admin se guardan en MongoDB y se reflejan automáticamente en el frontend.

### Acceso

- **URL:** `/admin/config`
- **Requisitos:** Autenticación de administrador (`adminToken`)

---

## Archivos Creados/Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `backend/models/GlobalSettings.model.js` | NUEVO | Modelo Mongoose para configuración global |
| `backend/routes/globalSettings.routes.js` | NUEVO | API REST para CRUD de configuración |
| `frontend/src/pages/AdminConfigPage.jsx` | NUEVO | Interfaz de configuración visual |
| `backend/server.js` | MODIFICADO | Registro de nuevas rutas |
| `frontend/src/App.jsx` | MODIFICADO | Ruta `/admin/config` agregada |

---

## Código: GlobalSettings.model.js

```javascript
const mongoose = require('mongoose');

/**
 * GlobalSettings Model - Unified Configuration for Admin Panel
 * 
 * This model stores all platform-wide settings that can be configured
 * from the Admin Panel and are automatically reflected across the frontend.
 */

const globalSettingsSchema = new mongoose.Schema({
    // Singleton pattern - only one document allowed
    _id: {
        type: String,
        default: 'global_settings',
    },

    // ============================================
    // DeFi Configuration
    // ============================================
    defi: {
        enabled: { type: Boolean, default: true },
        swapFeePercent: { type: Number, default: 0.3, min: 0, max: 10 },
        maxSlippage: { type: Number, default: 1, min: 0.1, max: 50 },
        activePools: [{
            name: String,
            address: String,
            enabled: { type: Boolean, default: true },
        }],
        bridgeFeePercent: { type: Number, default: 0.1, min: 0, max: 5 },
        minSwapAmount: { type: Number, default: 1 },
        maxSwapAmount: { type: Number, default: 1000000 },
    },

    // ============================================
    // Fiat Gateway Configuration
    // ============================================
    fiat: {
        enabled: { type: Boolean, default: true },
        providers: {
            stripe: { 
                enabled: { type: Boolean, default: true },
                feePercent: { type: Number, default: 2.9 },
            },
            moonpay: { 
                enabled: { type: Boolean, default: false },
                feePercent: { type: Number, default: 4.5 },
            },
            bankTransfer: { 
                enabled: { type: Boolean, default: true },
                feePercent: { type: Number, default: 1 },
            },
        },
        minPurchaseUSD: { type: Number, default: 10 },
        maxPurchaseUSD: { type: Number, default: 10000 },
        supportedCurrencies: { type: [String], default: ['USD', 'EUR', 'GBP'] },
        kycRequired: { type: Boolean, default: true },
        kycThresholdUSD: { type: Number, default: 1000 },
    },

    // ============================================
    // BEZ Token Configuration
    // ============================================
    token: {
        contractAddress: { type: String, default: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
        symbol: { type: String, default: 'BEZ' },
        decimals: { type: Number, default: 18 },
        totalSupply: { type: String, default: '1000000000' },
        circulatingSupply: { type: String, default: '0' },
        mintingEnabled: { type: Boolean, default: false },
        mintingRules: {
            maxMintPerTx: { type: String, default: '10000' },
            dailyMintLimit: { type: String, default: '100000' },
            allowedMinters: { type: [String], default: [] },
        },
        burningEnabled: { type: Boolean, default: true },
        transferFeePercent: { type: Number, default: 0, min: 0, max: 10 },
    },

    // ============================================
    // Farming/Yield Configuration
    // ============================================
    farming: {
        enabled: { type: Boolean, default: true },
        defaultAPY: { type: Number, default: 15, min: 0, max: 1000 },
        pools: [{
            name: String,
            lpToken: String,
            rewardToken: { type: String, default: 'BEZ' },
            apy: { type: Number, default: 15 },
            lockPeriodDays: { type: Number, default: 0 },
            enabled: { type: Boolean, default: true },
            minDeposit: { type: String, default: '100' },
            maxDeposit: { type: String, default: '1000000' },
        }],
        rewardsPerBlock: { type: String, default: '1' },
        harvestLockHours: { type: Number, default: 24 },
        earlyWithdrawalPenalty: { type: Number, default: 10, min: 0, max: 50 },
    },

    // ============================================
    // Staking Configuration
    // ============================================
    staking: {
        enabled: { type: Boolean, default: true },
        minStakeAmount: { type: String, default: '100' },
        maxStakeAmount: { type: String, default: '10000000' },
        rewardRatePercent: { type: Number, default: 12, min: 0, max: 100 },
        lockPeriods: [{
            days: Number,
            bonusMultiplier: { type: Number, default: 1 },
            enabled: { type: Boolean, default: true },
        }],
        compoundingEnabled: { type: Boolean, default: true },
        compoundFrequencyHours: { type: Number, default: 24 },
        unstakeCooldownHours: { type: Number, default: 48 },
        slashingEnabled: { type: Boolean, default: false },
        slashingPercent: { type: Number, default: 5 },
    },

    // ============================================
    // DAO Governance Configuration
    // ============================================
    dao: {
        enabled: { type: Boolean, default: true },
        quorumPercentage: { type: Number, default: 10, min: 1, max: 100 },
        votingPeriodDays: { type: Number, default: 7, min: 1, max: 30 },
        proposalThreshold: { type: String, default: '100000' },
        executionDelayHours: { type: Number, default: 24 },
        allowDelegation: { type: Boolean, default: true },
        maxDelegations: { type: Number, default: 100 },
        rewardPerVote: { type: String, default: '10' },
        proposalCategories: { 
            type: [String], 
            default: ['protocol', 'treasury', 'governance', 'community'] 
        },
        vetoEnabled: { type: Boolean, default: false },
        vetoThreshold: { type: Number, default: 33 },
    },

    // ============================================
    // RWA (Real World Assets) Configuration
    // ============================================
    rwa: {
        enabled: { type: Boolean, default: true },
        minInvestmentUSD: { type: Number, default: 100 },
        maxInvestmentUSD: { type: Number, default: 1000000 },
        platformFeePercent: { type: Number, default: 2.5, min: 0, max: 10 },
        assetCategories: {
            realEstate: { enabled: { type: Boolean, default: true } },
            commodities: { enabled: { type: Boolean, default: true } },
            art: { enabled: { type: Boolean, default: false } },
            collectibles: { enabled: { type: Boolean, default: false } },
        },
        kycRequired: { type: Boolean, default: true },
        accreditedInvestorRequired: { type: Boolean, default: false },
        legalJurisdictions: { type: [String], default: ['US', 'EU', 'UK'] },
        tokenizationStandard: { type: String, default: 'ERC-1155' },
    },

    // ============================================
    // Platform General Settings
    // ============================================
    platform: {
        maintenanceMode: { type: Boolean, default: false },
        maintenanceMessage: { type: String, default: 'Platform is under maintenance. Please try again later.' },
        registrationEnabled: { type: Boolean, default: true },
        emailVerificationRequired: { type: Boolean, default: true },
        maxLoginAttempts: { type: Number, default: 5 },
        sessionTimeoutMinutes: { type: Number, default: 60 },
        loggingLevel: { type: String, enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
    },

    // Metadata
    lastUpdatedBy: { type: String, default: 'system' },
    version: { type: Number, default: 1 },

}, {
    timestamps: true,
    collection: 'global_settings',
});

// Ensure only one document exists
globalSettingsSchema.statics.getSettings = async function() {
    let settings = await this.findById('global_settings');
    if (!settings) {
        settings = await this.create({ _id: 'global_settings' });
    }
    return settings;
};

// Update settings with validation
globalSettingsSchema.statics.updateSettings = async function(updates, adminId) {
    const settings = await this.getSettings();
    
    // Deep merge updates
    Object.keys(updates).forEach(key => {
        if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
            settings[key] = { ...settings[key]?.toObject?.() || settings[key], ...updates[key] };
        } else {
            settings[key] = updates[key];
        }
    });
    
    settings.lastUpdatedBy = adminId || 'admin';
    settings.version += 1;
    
    await settings.save();
    return settings;
};

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);
```

---

## Código: globalSettings.routes.js

```javascript
const express = require('express');
const router = express.Router();
const GlobalSettings = require('../models/GlobalSettings.model');
const { verifyAdminToken } = require('../middleware/admin.middleware');
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * /api/admin/settings/global:
 *   get:
 *     summary: Get all global platform settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global settings retrieved successfully
 */
router.get('/', verifyAdminToken, async (req, res) => {
    try {
        const settings = await GlobalSettings.getSettings();
        
        res.json({
            success: true,
            settings: settings.toObject(),
            version: settings.version,
            lastUpdated: settings.updatedAt,
            lastUpdatedBy: settings.lastUpdatedBy,
        });
    } catch (error) {
        console.error('Error fetching global settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch global settings',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global:
 *   put:
 *     summary: Update global platform settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.put('/', verifyAdminToken, async (req, res) => {
    try {
        const updates = req.body;
        const adminId = req.admin?.id || req.user?.id || 'admin';

        // Remove protected fields
        delete updates._id;
        delete updates.createdAt;
        delete updates.updatedAt;
        delete updates.__v;

        const settings = await GlobalSettings.updateSettings(updates, adminId);

        res.json({
            success: true,
            message: 'Settings updated successfully',
            settings: settings.toObject(),
            version: settings.version,
        });
    } catch (error) {
        console.error('Error updating global settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update global settings',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/{section}:
 *   get:
 *     summary: Get a specific section of settings
 *     tags: [Admin Settings]
 */
router.get('/:section', verifyAdminToken, async (req, res) => {
    try {
        const { section } = req.params;
        const validSections = ['defi', 'fiat', 'token', 'farming', 'staking', 'dao', 'rwa', 'platform'];
        
        if (!validSections.includes(section)) {
            return res.status(400).json({
                success: false,
                error: `Invalid section. Valid sections: ${validSections.join(', ')}`,
            });
        }

        const settings = await GlobalSettings.getSettings();
        
        res.json({
            success: true,
            section,
            data: settings[section],
            version: settings.version,
        });
    } catch (error) {
        console.error('Error fetching section settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch section settings',
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/{section}:
 *   patch:
 *     summary: Update a specific section of settings
 *     tags: [Admin Settings]
 */
router.patch('/:section', verifyAdminToken, async (req, res) => {
    try {
        const { section } = req.params;
        const validSections = ['defi', 'fiat', 'token', 'farming', 'staking', 'dao', 'rwa', 'platform'];
        
        if (!validSections.includes(section)) {
            return res.status(400).json({
                success: false,
                error: `Invalid section. Valid sections: ${validSections.join(', ')}`,
            });
        }

        const adminId = req.admin?.id || req.user?.id || 'admin';
        const updates = { [section]: req.body };
        
        const settings = await GlobalSettings.updateSettings(updates, adminId);

        res.json({
            success: true,
            message: `${section} settings updated successfully`,
            section,
            data: settings[section],
            version: settings.version,
        });
    } catch (error) {
        console.error('Error updating section settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update section settings',
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/reset:
 *   post:
 *     summary: Reset all settings to defaults
 *     tags: [Admin Settings]
 */
router.post('/reset', verifyAdminToken, async (req, res) => {
    try {
        const adminId = req.admin?.id || req.user?.id || 'admin';
        
        // Delete existing and recreate with defaults
        await GlobalSettings.deleteOne({ _id: 'global_settings' });
        const settings = await GlobalSettings.create({ 
            _id: 'global_settings',
            lastUpdatedBy: adminId,
        });

        res.json({
            success: true,
            message: 'Settings reset to defaults',
            settings: settings.toObject(),
        });
    } catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset settings',
        });
    }
});

/**
 * Public endpoint to get settings relevant for frontend (non-sensitive)
 * No auth required
 */
router.get('/public/frontend', async (req, res) => {
    try {
        const settings = await GlobalSettings.getSettings();
        
        // Return only non-sensitive, frontend-relevant settings
        res.json({
            success: true,
            settings: {
                defi: {
                    enabled: settings.defi?.enabled,
                    swapFeePercent: settings.defi?.swapFeePercent,
                    maxSlippage: settings.defi?.maxSlippage,
                },
                fiat: {
                    enabled: settings.fiat?.enabled,
                    minPurchaseUSD: settings.fiat?.minPurchaseUSD,
                    maxPurchaseUSD: settings.fiat?.maxPurchaseUSD,
                    supportedCurrencies: settings.fiat?.supportedCurrencies,
                },
                token: {
                    contractAddress: settings.token?.contractAddress,
                    symbol: settings.token?.symbol,
                    decimals: settings.token?.decimals,
                },
                farming: {
                    enabled: settings.farming?.enabled,
                    defaultAPY: settings.farming?.defaultAPY,
                },
                staking: {
                    enabled: settings.staking?.enabled,
                    rewardRatePercent: settings.staking?.rewardRatePercent,
                    minStakeAmount: settings.staking?.minStakeAmount,
                },
                dao: {
                    enabled: settings.dao?.enabled,
                    quorumPercentage: settings.dao?.quorumPercentage,
                    votingPeriodDays: settings.dao?.votingPeriodDays,
                },
                rwa: {
                    enabled: settings.rwa?.enabled,
                    minInvestmentUSD: settings.rwa?.minInvestmentUSD,
                },
                platform: {
                    maintenanceMode: settings.platform?.maintenanceMode,
                    maintenanceMessage: settings.platform?.maintenanceMessage,
                    registrationEnabled: settings.platform?.registrationEnabled,
                },
            },
            version: settings.version,
        });
    } catch (error) {
        console.error('Error fetching public settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch settings',
        });
    }
});

module.exports = router;
```

---

## Código: AdminConfigPage.jsx

```jsx
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

    // ... (resto del componente con secciones de configuración)
    // El código completo está en: frontend/src/pages/AdminConfigPage.jsx
};

export default AdminConfigPage;
```

---

## Modificaciones en server.js

```javascript
// Línea 745-747 (después de adminSettingsRoutes)
app.use('/api/admin/settings', adminSettingsRoutes);
const globalSettingsRoutes = require('./routes/globalSettings.routes');
app.use('/api/admin/settings/global', globalSettingsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
```

---

## Modificaciones en App.jsx

```jsx
// Línea 81 (nuevo import)
const AdminConfigPage = lazy(() => import('./pages/AdminConfigPage')); // NEW: Unified Platform Config

// Línea 387 (nueva ruta en admin)
{ path: 'config', element: <Suspense fallback={<Spinner size="lg" />}><AdminConfigPage /></Suspense> },
```

---

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/settings/global` | Obtener toda la configuración |
| PUT | `/api/admin/settings/global` | Actualizar toda la configuración |
| GET | `/api/admin/settings/global/:section` | Obtener sección específica |
| PATCH | `/api/admin/settings/global/:section` | Actualizar sección específica |
| POST | `/api/admin/settings/global/reset` | Resetear a valores por defecto |
| GET | `/api/admin/settings/global/public/frontend` | Configuración pública (sin auth) |

---

## Secciones Configurables

1. **DeFi / Intercambio**
   - Comisiones de swap y bridge
   - Slippage máximo
   - Montos mínimos/máximos

2. **Pasarela Fiat**
   - Proveedores (Stripe, MoonPay, transferencia bancaria)
   - Límites de compra
   - Configuración KYC

3. **Token BEZ**
   - Dirección del contrato
   - Reglas de minting/burning
   - Comisiones de transferencia

4. **Farming / Yield**
   - APY por defecto
   - Penalizaciones por retiro anticipado
   - Períodos de bloqueo

5. **Staking**
   - Tasa de recompensa
   - Montos mínimos/máximos
   - Auto-compounding

6. **DAO / Gobernanza**
   - Quórum requerido
   - Período de votación
   - Umbral de propuestas
   - Sistema de veto

7. **RWA (Activos del Mundo Real)**
   - Categorías habilitadas
   - Límites de inversión
   - Requisitos KYC

8. **Configuración General**
   - Modo mantenimiento
   - Registro de usuarios
   - Nivel de logging

---

## Verificación

Para probar la implementación:

1. Iniciar el backend: `cd backend && npm start`
2. Iniciar el frontend: `cd frontend && npm run dev`
3. Acceder a `/admin-login` y autenticarse
4. Navegar a `/admin/config`
5. Modificar cualquier configuración
6. Guardar cambios y verificar persistencia
