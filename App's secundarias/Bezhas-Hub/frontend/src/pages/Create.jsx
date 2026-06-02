import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLogisticsContract } from '../hooks/useLogisticsContract';
import { useCargoManifestContract } from '../hooks/useCargoManifestContract';
import { useRWAContracts, ASSET_CATEGORIES, CATEGORY_NAMES } from '../hooks/useRWAContracts';
import { GlobalPorts, searchPorts, getPortsByRegion } from '../utils/GlobalPorts';
import { BEZ_COIN_ADDRESS, formatAddress } from '../config/contracts';
import ipfsService from '../services/ipfs.service';
import RealEstateRWAForm from '../components/RealEstateRWAForm';
import GlobalStatsBar from '../components/GlobalStatsBar';
import {
    FaCube, FaBuilding, FaTruck, FaImage, FaMagic,
    FaArrowRight, FaCheckCircle, FaInfoCircle,
    FaGlobe, FaLock, FaUserFriends, FaCoins, FaMapMarkedAlt,
    FaShip, FaPlane, FaTruckMoving, FaTrain, FaExclamationTriangle,
    FaSnowflake, FaRulerCombined, FaFileInvoice, FaBox, FaCertificate,
    FaUpload, FaTimesCircle, FaSearch, FaHotel, FaStore, FaTshirt,
    FaCar, FaShip as FaBoat, FaHelicopter, FaGem, FaFileAlt, FaCamera
} from 'react-icons/fa';
// Vista previa del sistema logístico
const LogisticsPreview = ({ shipments }) => {
    if (!shipments || shipments.length === 0) {
        return (
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 h-full">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-gray-500 uppercase text-xs">Vista Previa del Sistema</h4>
                    <FaMapMarkedAlt className="text-gray-400" />
                </div>
                <p className="text-gray-400 text-xs text-center py-8">Cargando red logística...</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 h-full">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-gray-500 uppercase text-xs">Red Logística Activa</h4>
                <FaMapMarkedAlt className="text-gray-400" />
            </div>
            <div className="space-y-3">
                {shipments.slice(0, 3).map(s => (
                    <div key={s.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm text-xs">
                        <div className="flex justify-between font-bold">
                            <span className="truncate">#{s.id} {s.origin} → {s.destination}</span>
                            <span className={`text-xs ${s.status === 'PENDING' ? 'text-yellow-500' :
                                s.status === 'IN_TRANSIT' ? 'text-blue-500' :
                                    'text-green-500'
                                }`}>{s.status}</span>
                        </div>
                        <div className="text-gray-400 mt-1">{s.cargoType} - {s.payout} BEZ</div>
                    </div>
                ))}
                {shipments.length > 3 && (
                    <div className="text-center text-xs text-gray-400 mt-2">
                        + {shipments.length - 3} envíos más en la red
                    </div>
                )}
            </div>
        </div>
    );
};
const Create = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { createShipment, shipments, loading: loadingShipments } = useLogisticsContract();

    const [selectedType, setSelectedType] = useState(null);

    // Detectar parámetro tab en la URL y cambiar vista automáticamente
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'logistics') {
            setSelectedType('logistics');
        } else if (tabParam === 'service') {
            setSelectedType('service');
        } else if (tabParam === 'standard') {
            setSelectedType('nft');
        }
    }, [searchParams]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);

    // --- COMPONENTE DE PRIVACIDAD REUTILIZABLE ---
    const PrivacySettings = ({ settings, setSettings }) => (
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-200 dark:border-gray-600 mt-6">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaLock className="text-gold-500" /> Visibilidad y Acceso
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                    type="button"
                    onClick={() => setSettings({ ...settings, visibility: 'public' })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${settings.visibility === 'public'
                        ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                >
                    <FaGlobe className="text-2xl mb-2 text-blue-500" />
                    <div className="font-bold text-gray-800 dark:text-white">Público</div>
                    <div className="text-xs text-gray-500">Visible para todos en el marketplace</div>
                </button>

                <button
                    type="button"
                    onClick={() => setSettings({ ...settings, visibility: 'dao' })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${settings.visibility === 'dao'
                        ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                >
                    <FaUserFriends className="text-2xl mb-2 text-purple-500" />
                    <div className="font-bold text-gray-800 dark:text-white">Solo DAO</div>
                    <div className="text-xs text-gray-500">Exclusivo para miembros de la DAO</div>
                </button>

                <button
                    type="button"
                    onClick={() => setSettings({ ...settings, visibility: 'private' })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${settings.visibility === 'private'
                        ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                >
                    <FaLock className="text-2xl mb-2 text-red-500" />
                    <div className="font-bold text-gray-800 dark:text-white">Privado</div>
                    <div className="text-xs text-gray-500">Solo accesible mediante enlace directo</div>
                </button>
            </div>

            <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">Requisitos de Acceso</label>
                <select
                    value={settings.accessControl || 'all'}
                    onChange={(e) => setSettings({ ...settings, accessControl: e.target.value })}
                    className="w-full p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-white"
                >
                    <option value="all">Sin restricciones (Cualquiera puede ver/interactuar)</option>
                    <option value="kyc">Requiere KYC Verificado</option>
                    <option value="whitelist">Solo Whitelist (Lista Blanca)</option>
                    <option value="accredited">Solo Inversores Acreditados</option>
                </select>
            </div>
        </div>
    );

    // --- FORMULARIOS ESPECÍFICOS ---

    const NFTForm = () => {
        const [privacy, setPrivacy] = useState({ visibility: 'public', accessFee: '' });
        const [formData, setFormData] = useState({ name: '', description: '', price: '', royalty: '' });

        const handleSubmit = (e) => {
            e.preventDefault();
            handleCreate('NFT', { ...formData, privacy });
        };

        return (
            <form className="space-y-4 animate-fade-in" onSubmit={handleSubmit}>
                <div>
                    <label className="block text-sm font-bold mb-2">Nombre del NFT</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                        placeholder="Ej: CyberPunk #2077"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-2">Descripción</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                        rows="3"
                        placeholder="Historia detrás de tu obra..."
                        required
                    ></textarea>
                </div>
                <div>
                    <label className="block text-sm font-bold mb-2">Subir Archivo</label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <FaImage className="mx-auto text-4xl text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">PNG, JPG, GIF, WEBP o MP4. Max 100mb.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-2">Precio Venta (BEZ)</label>
                        <input
                            type="number"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                            placeholder="0.0"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2">Regalías (%)</label>
                        <input
                            type="number"
                            value={formData.royalty}
                            onChange={(e) => setFormData({ ...formData, royalty: e.target.value })}
                            className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                            placeholder="Ej: 5%"
                            required
                        />
                    </div>
                </div>

                <PrivacySettings settings={privacy} setSettings={setPrivacy} />

                <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold mt-4 shadow-lg">
                    Crear y Listar en Marketplace
                </button>
            </form>
        );
    };

    const RealEstateForm = () => {
        return <RealEstateRWAForm onSuccess={setSuccess} />;
    };

    const LogisticsForm = () => {
        // Contract address - Replace with your deployed contract
        const CARGO_MANIFEST_CONTRACT = process.env.REACT_APP_CARGO_MANIFEST_CONTRACT || '0x0000000000000000000000000000000000000000';

        const cargoContract = useCargoManifestContract(CARGO_MANIFEST_CONTRACT);

        // LocalStorage persistence key
        const STORAGE_KEY = 'bezhas_logistics_draft';

        // Initialize formData from localStorage or defaults
        const [formData, setFormData] = useState(() => {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    return JSON.parse(saved);
                }
            } catch (err) {
                console.error('Error loading saved form data:', err);
            }
            return {
                containerId: '',
                transportMode: 'Maritime',
                commodityDescription: '',
                weightMT: '',
                vesselVoyage: '',
                hsCode: '',
                consignee: '',
                originPort: '',
                destinationPort: '',
                isHazardous: false,
                isReefered: false,
                isOOG: false
            };
        });

        const [privacy, setPrivacy] = useState({ visibility: 'public', accessFee: '' });
        const [step, setStep] = useState(() => {
            try {
                const saved = localStorage.getItem(`${STORAGE_KEY}_step`);
                return saved ? parseInt(saved) : 1;
            } catch {
                return 1;
            }
        });
        const [isDraftSaved, setIsDraftSaved] = useState(false);
        const [lastSaved, setLastSaved] = useState(null);
        const [portSearch, setPortSearch] = useState({ origin: '', destination: '' });
        const [portResults, setPortResults] = useState({ origin: [], destination: [] });
        const [appendices, setAppendices] = useState({
            hazardous: { unClass: '', msds: null },
            reefer: { temperature: '', humidity: '', iotData: null },
            oog: { length: '', width: '', height: '', specialHandling: '' }
        });
        const [documents, setDocuments] = useState({
            invoice: null,
            packingList: null,
            certificate: null
        });

        // Manual save function to avoid continuous re-renders
        const saveDraft = useCallback(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
                localStorage.setItem(`${STORAGE_KEY}_step`, step.toString());
                setIsDraftSaved(true);
                setLastSaved(new Date().toLocaleTimeString());
            } catch (err) {
                console.error('Error saving form data:', err);
            }
        }, [formData, step]);

        // Check if draft exists on mount
        useEffect(() => {
            const hasDraft = localStorage.getItem(STORAGE_KEY) !== null;
            setIsDraftSaved(hasDraft);
        }, []);

        // Optional: Auto-save every 30 seconds if form has data (menos agresivo)
        useEffect(() => {
            // Solo auto-guardar si hay contenido significativo
            const hasContent = formData.containerId || formData.commodityDescription || formData.consignee;

            if (!hasContent) return;

            const autoSaveInterval = setInterval(() => {
                saveDraft();
            }, 30000); // 30 segundos

            return () => clearInterval(autoSaveInterval);
        }, [formData.containerId, formData.commodityDescription, formData.consignee, saveDraft]);

        // Clear draft on successful submission
        const clearDraft = useCallback(() => {
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(`${STORAGE_KEY}_step`);
                setIsDraftSaved(false);
                setLastSaved(null);
            } catch (err) {
                console.error('Error clearing draft:', err);
            }
        }, []);

        // Port search handler with useCallback to prevent unnecessary re-renders
        const handlePortSearch = useCallback((field, query) => {
            setPortSearch(prev => ({ ...prev, [field]: query }));
            if (query.length > 2) {
                const results = searchPorts(query);
                setPortResults(prev => ({ ...prev, [field]: results.slice(0, 5) }));
            } else {
                setPortResults(prev => ({ ...prev, [field]: [] }));
            }
        }, []);

        const selectPort = useCallback((field, port) => {
            setFormData(prev => ({ ...prev, [`${field}Port`]: port.code }));
            setPortSearch(prev => ({ ...prev, [field]: `${port.name}, ${port.country}` }));
            setPortResults(prev => ({ ...prev, [field]: [] }));
        }, []);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);

            try {
                // Validate consignee address
                if (!formData.consignee || formData.consignee.length !== 42) {
                    throw new Error('Invalid consignee wallet address');
                }

                // Register manifest as NFT
                const result = await cargoContract.registerManifest({
                    ...formData,
                    weightMT: parseFloat(formData.weightMT)
                });

                if (result.success) {
                    // Attach appendices if applicable
                    if (formData.isHazardous && appendices.hazardous.unClass) {
                        await cargoContract.attachHazardousAppendix(
                            result.tokenId,
                            appendices.hazardous,
                            appendices.hazardous.unClass
                        );
                    }

                    if (formData.isReefered && appendices.reefer.temperature) {
                        await cargoContract.attachReeferAppendix(
                            result.tokenId,
                            appendices.reefer
                        );
                    }

                    if (formData.isOOG && appendices.oog.length) {
                        await cargoContract.attachOOGAppendix(
                            result.tokenId,
                            appendices.oog
                        );
                    }

                    // Attach documents
                    if (documents.invoice) {
                        await cargoContract.attachDocument(result.tokenId, 'invoice', documents.invoice);
                    }
                    if (documents.packingList) {
                        await cargoContract.attachDocument(result.tokenId, 'packingList', documents.packingList);
                    }
                    if (documents.certificate) {
                        await cargoContract.attachDocument(result.tokenId, 'certificate', documents.certificate);
                    }

                    setSuccess({
                        type: 'Cargo Manifest NFT',
                        link: '/logistics',
                        tokenId: result.tokenId,
                        txHash: result.transactionHash
                    });

                    // Clear the draft after successful submission
                    clearDraft();
                }
            } catch (err) {
                setError(err.message || 'Error al registrar el manifiesto. Verifica tu conexión y los datos.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        // Step navigation with useCallback (sin dependencia de step para evitar re-crear funciones)
        const nextStep = useCallback(() => {
            setStep(prev => prev < 3 ? prev + 1 : prev);
        }, []);

        const prevStep = useCallback(() => {
            setStep(prev => prev > 1 ? prev - 1 : prev);
        }, []);

        return (
            <form className="animate-fade-in" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Draft Save Controls */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={saveDraft}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold flex items-center gap-2"
                                >
                                    <FaInfoCircle />
                                    Guardar Borrador
                                </button>
                                {isDraftSaved && lastSaved && (
                                    <span className="text-xs text-blue-700 dark:text-blue-300">
                                        Guardado: {lastSaved}
                                    </span>
                                )}
                            </div>
                            {isDraftSaved && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm('¿Eliminar el borrador guardado?')) {
                                            clearDraft();
                                            setFormData({
                                                containerId: '',
                                                transportMode: 'Maritime',
                                                commodityDescription: '',
                                                weightMT: '',
                                                vesselVoyage: '',
                                                hsCode: '',
                                                consignee: '',
                                                originPort: '',
                                                destinationPort: '',
                                                isHazardous: false,
                                                isReefered: false,
                                                isOOG: false
                                            });
                                            setStep(1);
                                        }
                                    }}
                                    className="text-xs text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100 underline"
                                >
                                    Limpiar Borrador
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-lg text-sm flex items-start gap-3">
                                <FaTimesCircle className="text-xl mt-0.5" />
                                <div>
                                    <p className="font-bold">Error</p>
                                    <p className="text-xs">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Step Indicator */}
                        <div className="flex items-center justify-between mb-6">
                            {[1, 2, 3].map((s) => (
                                <div key={s} className="flex-1">
                                    <div className={`h-2 rounded-full ${step >= s ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <p className={`text-xs mt-2 text-center ${step >= s ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                                        {s === 1 && 'Datos Básicos'}
                                        {s === 2 && 'Apéndices'}
                                        {s === 3 && 'Documentos'}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* STEP 1: Basic Information */}
                        {step === 1 && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <FaInfoCircle className="text-blue-500 text-xl mt-0.5" />
                                        <div className="text-sm">
                                            <p className="font-bold text-blue-800 dark:text-blue-200">BeZhas Cargo Manifest NFT (DCSA v3.0)</p>
                                            <p className="text-blue-700 dark:text-blue-300 text-xs">
                                                Registro: {cargoContract.registrationFee} BEZ (~$0.05 USD) | Balance: {parseFloat(cargoContract.bezBalance).toFixed(2)} BEZ
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-2">Container ID *</label>
                                        <input
                                            value={formData.containerId}
                                            onChange={e => setFormData({ ...formData, containerId: e.target.value.toUpperCase() })}
                                            type="text"
                                            className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 font-mono"
                                            placeholder="ABCD1234567"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-2">Transport Mode *</label>
                                        <select
                                            value={formData.transportMode}
                                            onChange={e => setFormData({ ...formData, transportMode: e.target.value })}
                                            className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                            required
                                        >
                                            <option value="Maritime">⚓ Maritime</option>
                                            <option value="Air">✈️ Air</option>
                                            <option value="Road">🚛 Road</option>
                                            <option value="Rail">🚂 Rail</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Origin Port with Search */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                                        <FaSearch className="text-gray-400" /> Origin Port *
                                    </label>
                                    <input
                                        value={portSearch.origin}
                                        onChange={e => handlePortSearch('origin', e.target.value)}
                                        type="text"
                                        className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                        placeholder="Search: Shanghai, Singapore, Rotterdam..."
                                        required
                                    />
                                    {portResults.origin.length > 0 && (
                                        <div className="mt-2 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {portResults.origin.map((port) => (
                                                <div
                                                    key={port.code}
                                                    onClick={() => selectPort('origin', port)}
                                                    className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0"
                                                >
                                                    <p className="font-bold text-sm">{port.name}, {port.country}</p>
                                                    <p className="text-xs text-gray-500">Code: {port.code} | {port.region}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Destination Port with Search */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                                        <FaSearch className="text-gray-400" /> Destination Port *
                                    </label>
                                    <input
                                        value={portSearch.destination}
                                        onChange={e => handlePortSearch('destination', e.target.value)}
                                        type="text"
                                        className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                        placeholder="Search: Los Angeles, Dubai, Hamburg..."
                                        required
                                    />
                                    {portResults.destination.length > 0 && (
                                        <div className="mt-2 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {portResults.destination.map((port) => (
                                                <div
                                                    key={port.code}
                                                    onClick={() => selectPort('destination', port)}
                                                    className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0"
                                                >
                                                    <p className="font-bold text-sm">{port.name}, {port.country}</p>
                                                    <p className="text-xs text-gray-500">Code: {port.code} | {port.region}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-2">Commodity Description *</label>
                                    <textarea
                                        value={formData.commodityDescription}
                                        onChange={e => setFormData({ ...formData, commodityDescription: e.target.value })}
                                        className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                        rows="3"
                                        placeholder="Electronics, Machinery, Textiles, etc."
                                        required
                                    ></textarea>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-2">Weight (Metric Tons) *</label>
                                        <input
                                            value={formData.weightMT}
                                            onChange={e => setFormData({ ...formData, weightMT: e.target.value })}
                                            type="number"
                                            step="0.001"
                                            className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                            placeholder="25.500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-2">HS Code</label>
                                        <input
                                            value={formData.hsCode}
                                            onChange={e => setFormData({ ...formData, hsCode: e.target.value })}
                                            type="text"
                                            className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 font-mono"
                                            placeholder="8471.30"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-2">Vessel/Voyage/Flight Number *</label>
                                    <input
                                        value={formData.vesselVoyage}
                                        onChange={e => setFormData({ ...formData, vesselVoyage: e.target.value })}
                                        type="text"
                                        className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                        placeholder="MSC Oscar / V.234R"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-2">Consignee Wallet Address *</label>
                                    <input
                                        value={formData.consignee}
                                        onChange={e => setFormData({ ...formData, consignee: e.target.value })}
                                        type="text"
                                        className="w-full p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 font-mono text-sm"
                                        placeholder="0x..."
                                        required
                                    />
                                </div>

                                {/* Special Cargo Types */}
                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                                    <p className="font-bold mb-3">Special Cargo Classification</p>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.isHazardous}
                                                onChange={e => setFormData({ ...formData, isHazardous: e.target.checked })}
                                                className="w-5 h-5"
                                            />
                                            <FaExclamationTriangle className="text-red-500" />
                                            <span>Hazardous (Dangerous Goods - Requires MSDS)</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.isReefered}
                                                onChange={e => setFormData({ ...formData, isReefered: e.target.checked })}
                                                className="w-5 h-5"
                                            />
                                            <FaSnowflake className="text-blue-500" />
                                            <span>Reefer (Temperature Controlled)</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.isOOG}
                                                onChange={e => setFormData({ ...formData, isOOG: e.target.checked })}
                                                className="w-5 h-5"
                                            />
                                            <FaRulerCombined className="text-purple-500" />
                                            <span>OOG (Out-of-Gauge - Oversized)</span>
                                        </label>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                                >
                                    Continue to Appendices <FaArrowRight />
                                </button>
                            </div>
                        )}

                        {/* STEP 2: Appendices */}
                        {step === 2 && (
                            <div className="space-y-4 animate-fade-in">
                                <h3 className="text-lg font-bold mb-4">Special Cargo Appendices</h3>

                                {formData.isHazardous && (
                                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FaExclamationTriangle className="text-red-500 text-xl" />
                                            <h4 className="font-bold">Hazardous Cargo Appendix (MSDS)</h4>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-bold mb-2">UN Class</label>
                                                <input
                                                    value={appendices.hazardous.unClass}
                                                    onChange={e => setAppendices({
                                                        ...appendices,
                                                        hazardous: { ...appendices.hazardous, unClass: e.target.value }
                                                    })}
                                                    type="text"
                                                    className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                    placeholder="e.g., Class 3 - Flammable Liquids"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold mb-2">MSDS Document</label>
                                                <input
                                                    type="file"
                                                    onChange={e => setAppendices({
                                                        ...appendices,
                                                        hazardous: { ...appendices.hazardous, msds: e.target.files[0] }
                                                    })}
                                                    className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                    accept=".pdf,.doc,.docx"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {formData.isReefered && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FaSnowflake className="text-blue-500 text-xl" />
                                            <h4 className="font-bold">Reefer (Temperature Controlled) Appendix</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-bold mb-2">Temperature (°C)</label>
                                                <input
                                                    value={appendices.reefer.temperature}
                                                    onChange={e => setAppendices({
                                                        ...appendices,
                                                        reefer: { ...appendices.reefer, temperature: e.target.value }
                                                    })}
                                                    type="number"
                                                    className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                    placeholder="-18"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold mb-2">Humidity (%)</label>
                                                <input
                                                    value={appendices.reefer.humidity}
                                                    onChange={e => setAppendices({
                                                        ...appendices,
                                                        reefer: { ...appendices.reefer, humidity: e.target.value }
                                                    })}
                                                    type="number"
                                                    className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                    placeholder="85"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="block text-sm font-bold mb-2">IoT Sensor Data (Optional)</label>
                                            <input
                                                type="file"
                                                onChange={e => setAppendices({
                                                    ...appendices,
                                                    reefer: { ...appendices.reefer, iotData: e.target.files[0] }
                                                })}
                                                className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                accept=".json,.csv"
                                            />
                                        </div>
                                    </div>
                                )}

                                {formData.isOOG && (
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FaRulerCombined className="text-purple-500 text-xl" />
                                            <h4 className="font-bold">OOG (Out-of-Gauge) Appendix</h4>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-sm font-bold mb-2">Length (m)</label>
                                                <input
                                                    value={appendices.oog.length}
                                                    onChange={e => setAppendices({
                                                        ...appendices,
                                                        oog: { ...appendices.oog, length: e.target.value }
                                                    })}
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                    placeholder="12.5"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold mb-2">Width (m)</label>
                                                <input
                                                    value={appendices.oog.width}
                                                    onChange={e => setAppendices({
                                                        ...appendices,
                                                        oog: { ...appendices.oog, width: e.target.value }
                                                    })}
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                    placeholder="3.5"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold mb-2">Height (m)</label>
                                                <input
                                                    value={appendices.oog.height}
                                                    onChange={e => setAppendices({
                                                        ...appendices,
                                                        oog: { ...appendices.oog, height: e.target.value }
                                                    })}
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                    placeholder="4.0"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="block text-sm font-bold mb-2">Special Handling Instructions</label>
                                            <textarea
                                                value={appendices.oog.specialHandling}
                                                onChange={e => setAppendices({
                                                    ...appendices,
                                                    oog: { ...appendices.oog, specialHandling: e.target.value }
                                                })}
                                                className="w-full p-2 rounded bg-white dark:bg-gray-800 border"
                                                rows="2"
                                                placeholder="Crane required, heavy lift..."
                                            ></textarea>
                                        </div>
                                    </div>
                                )}

                                {!formData.isHazardous && !formData.isReefered && !formData.isOOG && (
                                    <div className="text-center text-gray-500 py-8">
                                        <p>No special cargo classifications selected.</p>
                                        <p className="text-sm">You can skip this step.</p>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={nextStep}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                                    >
                                        Continue to Documents <FaArrowRight />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Documents */}
                        {step === 3 && (
                            <div className="space-y-4 animate-fade-in">
                                <h3 className="text-lg font-bold mb-4">Commercial Documents (Required)</h3>

                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FaFileInvoice className="text-green-500 text-xl" />
                                        <h4 className="font-bold">Commercial Invoice *</h4>
                                    </div>
                                    <input
                                        type="file"
                                        onChange={e => setDocuments({ ...documents, invoice: e.target.files[0] })}
                                        className="w-full p-2 rounded bg-white dark:bg-gray-700 border"
                                        accept=".pdf,.doc,.docx"
                                        required
                                    />
                                    {documents.invoice && <p className="text-xs text-green-600 mt-2">✓ {documents.invoice.name}</p>}
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FaBox className="text-blue-500 text-xl" />
                                        <h4 className="font-bold">Packing List *</h4>
                                    </div>
                                    <input
                                        type="file"
                                        onChange={e => setDocuments({ ...documents, packingList: e.target.files[0] })}
                                        className="w-full p-2 rounded bg-white dark:bg-gray-700 border"
                                        accept=".pdf,.doc,.docx"
                                        required
                                    />
                                    {documents.packingList && <p className="text-xs text-green-600 mt-2">✓ {documents.packingList.name}</p>}
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FaCertificate className="text-purple-500 text-xl" />
                                        <h4 className="font-bold">Certificate of Origin *</h4>
                                    </div>
                                    <input
                                        type="file"
                                        onChange={e => setDocuments({ ...documents, certificate: e.target.files[0] })}
                                        className="w-full p-2 rounded bg-white dark:bg-gray-700 border"
                                        accept=".pdf,.doc,.docx"
                                        required
                                    />
                                    {documents.certificate && <p className="text-xs text-green-600 mt-2">✓ {documents.certificate.name}</p>}
                                </div>

                                <PrivacySettings settings={privacy} setSettings={setPrivacy} />

                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                                    <p className="text-sm font-bold text-yellow-800 dark:text-yellow-200 mb-2">⚡ Transaction Summary</p>
                                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                                        <li>• Registration Fee: {cargoContract.registrationFee} BEZ (~$0.05 USD)</li>
                                        <li>• Gas Estimate: ~0.001 POL (Polygon)</li>
                                        <li>• NFT Standard: ERC-721</li>
                                        <li>• Metadata: IPFS (DCSA v3.0)</li>
                                    </ul>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || !documents.invoice || !documents.packingList || !documents.certificate}
                                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                Minting NFT...
                                            </>
                                        ) : (
                                            <>
                                                <FaUpload /> Register Manifest NFT
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Preview */}
                    <div className="hidden lg:block lg:col-span-1 space-y-4">
                        <LogisticsPreview shipments={shipments} />

                        {/* Contract Info */}
                        <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-4 rounded-xl border">
                            <h4 className="font-bold text-sm mb-3">📋 NFT Manifest Details</h4>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Container:</span>
                                    <span className="font-mono font-bold">{formData.containerId || '---'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Route:</span>
                                    <span className="font-bold">
                                        {formData.originPort ? formData.originPort : '?'} → {formData.destinationPort ? formData.destinationPort : '?'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Weight:</span>
                                    <span className="font-bold">{formData.weightMT || '0'} MT</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Mode:</span>
                                    <span className="font-bold">{formData.transportMode}</span>
                                </div>
                                {(formData.isHazardous || formData.isReefered || formData.isOOG) && (
                                    <div className="mt-3 pt-3 border-t">
                                        <p className="text-gray-600 dark:text-gray-400 mb-2">Special Cargo:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {formData.isHazardous && <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">⚠️ Hazardous</span>}
                                            {formData.isReefered && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">❄️ Reefer</span>}
                                            {formData.isOOG && <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">📏 OOG</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BEZ-Coin Info */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200">
                            <div className="flex items-center gap-2 mb-2">
                                <FaCoins className="text-yellow-500" />
                                <h4 className="font-bold text-sm">BEZ-Coin Balance</h4>
                            </div>
                            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                                {parseFloat(cargoContract.bezBalance).toFixed(2)} BEZ
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Contract: {formatAddress(BEZ_COIN_ADDRESS)}
                            </p>
                        </div>
                    </div>
                </div>
            </form>
        );
    };

    // --- LÓGICA DE CREACIÓN ---

    const handleCreate = async (type, data) => {
        setLoading(true);
        setError(null);
        console.log(`Creando ${type} con datos:`, data);

        try {
            // Simulación de proceso de creación (aquí podrías conectar con backend/smart contract)
            await new Promise(resolve => setTimeout(resolve, 2000));

            let link = '/marketplace';
            if (type === 'Real Estate') link = '/real-estate';
            if (type === 'NFT') link = '/marketplace';

            setSuccess({ type, link });
        } catch (err) {
            setError(`Error al crear ${type}: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER ---

    if (success) {
        return (
            <div className="container mx-auto px-4 py-20 text-center max-w-lg">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl">
                    <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FaCheckCircle className="text-5xl" />
                    </div>
                    <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">¡Activo Creado!</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-8">
                        Tu <strong>{success.type}</strong> ha sido acuñado en la Blockchain.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => navigate(success.link)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold">
                            Ver en el Mercado
                        </button>
                        <button onClick={() => { setSuccess(null); setSelectedType(null); }} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white py-3 rounded-lg font-bold">
                            Crear Otro
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12 pb-24">
            {/* Global Stats Bar - Ecosystem Metrics */}
            <GlobalStatsBar />

            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Estudio de Creación
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Tokeniza cualquier activo del mundo real o digital. Elige tu categoría y comienza a construir en la Web3.
                </p>
            </div>

            {!selectedType ? (
                // SELECCIÓN DE TIPO
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* Opción 1: NFT / Arte */}
                    <div
                        onClick={() => setSelectedType('nft')}
                        className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-purple-500 transform hover:-translate-y-2"
                    >
                        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <FaMagic className="text-3xl text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-gray-800 dark:text-white">Arte Digital & NFTs</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            Crea coleccionables únicos, arte digital o pases de acceso. Estándar ERC-721.
                        </p>
                        <span className="text-purple-600 font-bold flex items-center gap-2">Comenzar <FaArrowRight /></span>
                    </div>

                    {/* Opción 2: Real Estate */}
                    <div
                        onClick={() => setSelectedType('realestate')}
                        className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-blue-500 transform hover:-translate-y-2"
                    >
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <FaBuilding className="text-3xl text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-gray-800 dark:text-white">Real Estate (RWA)</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            Tokeniza propiedades inmobiliarias y fracciona su propiedad para inversores. Estándar ERC-1155.
                        </p>
                        <span className="text-blue-600 font-bold flex items-center gap-2">Comenzar <FaArrowRight /></span>
                    </div>

                    {/* Opción 3: Logística */}
                    <div
                        onClick={() => setSelectedType('logistics')}
                        className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-green-500 transform hover:-translate-y-2"
                    >
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <FaTruck className="text-3xl text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-gray-800 dark:text-white">Contrato Logístico</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            Crea contratos inteligentes para envíos seguros con trazabilidad y pagos en Escrow.
                        </p>
                        <span className="text-green-600 font-bold flex items-center gap-2">Comenzar <FaArrowRight /></span>
                    </div>
                </div>
            ) : (
                // FORMULARIO SELECCIONADO
                <div className={`mx-auto ${selectedType === 'logistics' ? 'max-w-6xl' : 'max-w-2xl'}`}>
                    <button
                        onClick={() => setSelectedType(null)}
                        className="mb-6 text-gray-500 hover:text-gray-800 dark:hover:text-white flex items-center gap-2 transition-colors"
                    >
                        ← Volver a categorías
                    </button>

                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
                            <div className={`p-3 rounded-xl ${selectedType === 'nft' ? 'bg-purple-100 text-purple-600' :
                                selectedType === 'realestate' ? 'bg-blue-100 text-blue-600' :
                                    'bg-green-100 text-green-600'
                                }`}>
                                {selectedType === 'nft' && <FaMagic className="text-2xl" />}
                                {selectedType === 'realestate' && <FaBuilding className="text-2xl" />}
                                {selectedType === 'logistics' && <FaTruck className="text-2xl" />}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                                    {selectedType === 'nft' && 'Crear Nuevo NFT'}
                                    {selectedType === 'realestate' && 'Tokenizar Propiedad'}
                                    {selectedType === 'logistics' && 'Nuevo Contrato de Envío'}
                                </h2>
                                <p className="text-sm text-gray-500">Completa los detalles para acuñar en la Blockchain.</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="py-20 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-gray-600 dark:text-gray-300 font-bold">Interactuando con Smart Contract...</p>
                                <p className="text-sm text-gray-500">Por favor confirma la transacción en tu wallet.</p>
                            </div>
                        ) : (
                            <>
                                {selectedType === 'nft' && <NFTForm />}
                                {selectedType === 'realestate' && <RealEstateForm />}
                                {selectedType === 'logistics' && <LogisticsForm />}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Create;
