import React, { useState, useCallback } from 'react';
import {
    FaBuilding, FaHotel, FaStore, FaTshirt, FaCar,
    FaShip, FaHelicopter, FaGem, FaUpload, FaFileAlt,
    FaCamera, FaInfoCircle, FaCheckCircle, FaArrowRight,
    FaArrowLeft, FaCoins, FaTimesCircle, FaGlobe, FaLock, FaUserFriends
} from 'react-icons/fa';
import { useRWAContracts, ASSET_CATEGORIES, CATEGORY_NAMES } from '../hooks/useRWAContracts';
import ipfsService from '../services/ipfs.service';

const CATEGORY_ICONS = {
    [ASSET_CATEGORIES.INMUEBLE]: FaBuilding,
    [ASSET_CATEGORIES.HOTEL]: FaHotel,
    [ASSET_CATEGORIES.LOCAL]: FaStore,
    [ASSET_CATEGORIES.ROPA]: FaTshirt,
    [ASSET_CATEGORIES.COCHE]: FaCar,
    [ASSET_CATEGORIES.BARCO]: FaShip,
    [ASSET_CATEGORIES.HELICOPTERO]: FaHelicopter,
    [ASSET_CATEGORIES.OBJETO]: FaGem
};

const RealEstateRWAForm = ({ onSuccess }) => {
    const rwaContracts = useRWAContracts();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [uploadingIPFS, setUploadingIPFS] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        // Step 1: Category
        category: null,

        // Step 2: Asset Details
        name: '',
        description: '',
        valuationUSD: '',
        location: '',
        specifications: '',

        // Step 3: Tokenization
        totalSupply: '',
        pricePerFraction: '',
        estimatedYield: '',

        // Step 4: Legal Documents
        legalDocuments: [],
        images: [],
        legalDocumentCID: '',
        imagesCID: '',

        // Step 5: Visibility & Access
        visibility: 'public',
        accessControl: 'all'
    });

    // Category-specific fields
    const getCategoryFields = () => {
        switch (formData.category) {
            case ASSET_CATEGORIES.INMUEBLE:
                return [
                    { name: 'location', label: 'Dirección Completa', type: 'text', required: true, placeholder: 'Calle, Ciudad, País' },
                    { name: 'specifications', label: 'Metros Cuadrados', type: 'number', required: true, placeholder: '150' },
                ];
            case ASSET_CATEGORIES.HOTEL:
                return [
                    { name: 'location', label: 'Ubicación del Hotel', type: 'text', required: true },
                    { name: 'specifications', label: 'Número de Habitaciones', type: 'number', required: true },
                ];
            case ASSET_CATEGORIES.COCHE:
                return [
                    { name: 'location', label: 'Marca y Modelo', type: 'text', required: true, placeholder: 'Tesla Model S 2024' },
                    { name: 'specifications', label: 'Matrícula/VIN', type: 'text', required: true },
                ];
            case ASSET_CATEGORIES.BARCO:
                return [
                    { name: 'location', label: 'Puerto Base', type: 'text', required: true },
                    { name: 'specifications', label: 'Eslora (pies)', type: 'number', required: true },
                ];
            case ASSET_CATEGORIES.HELICOPTERO:
                return [
                    { name: 'location', label: 'Hangar/Base', type: 'text', required: true },
                    { name: 'specifications', label: 'Matrícula Aeronáutica', type: 'text', required: true },
                ];
            default:
                return [
                    { name: 'location', label: 'Ubicación/Origen', type: 'text', required: true },
                    { name: 'specifications', label: 'Especificaciones', type: 'text', required: false },
                ];
        }
    };

    // Handle file uploads
    const handleFileUpload = async (files, type) => {
        setUploadingIPFS(true);
        setError(null);

        try {
            const results = await ipfsService.uploadMultipleToIPFS(files);

            if (type === 'legal') {
                setFormData(prev => ({
                    ...prev,
                    legalDocuments: results,
                    legalDocumentCID: results[0]?.cid || ''
                }));
            } else if (type === 'images') {
                setFormData(prev => ({
                    ...prev,
                    images: results,
                    imagesCID: results[0]?.cid || ''
                }));
            }

            setUploadingIPFS(false);
        } catch (err) {
            setError('Error al subir archivos a IPFS: ' + err.message);
            setUploadingIPFS(false);
        }
    };

    // Submit tokenization
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate required documents
            if (!formData.legalDocumentCID) {
                throw new Error('Debes subir documentación legal');
            }

            // Prepare asset data
            const assetData = {
                name: formData.name,
                category: formData.category,
                legalCID: formData.legalDocumentCID,
                imagesCID: formData.imagesCID || '',
                totalSupply: parseInt(formData.totalSupply),
                valuationUSD: parseInt(formData.valuationUSD),
                pricePerFraction: formData.pricePerFraction,
                estimatedYield: Math.floor(parseFloat(formData.estimatedYield) * 100), // Convert to basis points
                location: formData.location
            };

            // Call smart contract
            const result = await rwaContracts.tokenizeAsset(assetData);

            if (result.success) {
                onSuccess?.({
                    type: 'RWA',
                    assetId: result.assetId,
                    txHash: result.transactionHash,
                    category: CATEGORY_NAMES[formData.category]
                });
            }

        } catch (err) {
            console.error('Tokenization error:', err);
            setError(err.message || 'Error al tokenizar el activo');
        } finally {
            setLoading(false);
        }
    };

    // Navigation
    const nextStep = () => {
        if (step < 4) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const canProceed = () => {
        switch (step) {
            case 1:
                return formData.category !== null;
            case 2:
                return formData.name && formData.valuationUSD && formData.location;
            case 3:
                return formData.totalSupply && formData.pricePerFraction && formData.estimatedYield;
            case 4:
                return formData.legalDocumentCID;
            default:
                return false;
        }
    };

    return (
        <form onSubmit={handleSubmit} className="animate-fade-in">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-8">
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex-1">
                        <div className={`h-2 rounded-full transition-all ${step >= s ? 'bg-gradient-to-r from-gold-500 to-gold-400' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                        <p className={`text-xs mt-2 text-center font-bold ${step >= s ? 'text-gold-500' : 'text-gray-400'}`}>
                            {s === 1 && 'Categoría'}
                            {s === 2 && 'Detalles'}
                            {s === 3 && 'Tokenización'}
                            {s === 4 && 'Documentos'}
                        </p>
                    </div>
                ))}
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg mb-6 flex items-start gap-3">
                    <FaTimesCircle className="text-red-500 text-xl mt-0.5" />
                    <div>
                        <p className="font-bold text-red-800 dark:text-red-200">Error</p>
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                </div>
            )}

            {/* STEP 1: Category Selection */}
            {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                        <FaInfoCircle className="inline mr-2 text-blue-500" />
                        <span className="text-sm text-blue-800 dark:text-blue-200">
                            Selecciona el tipo de activo que deseas tokenizar
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(ASSET_CATEGORIES).map(([key, value]) => {
                            const Icon = CATEGORY_ICONS[value];
                            const isSelected = formData.category === value;

                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, category: value })}
                                    className={`p-6 rounded-xl border-2 transition-all text-center ${isSelected
                                        ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20 ring-2 ring-gold-500'
                                        : 'border-gray-300 dark:border-gray-700 hover:border-gold-300 dark:hover:border-gold-700'
                                        }`}
                                >
                                    <Icon className={`text-4xl mx-auto mb-3 ${isSelected ? 'text-gold-500' : 'text-gray-600 dark:text-gray-400'}`} />
                                    <p className="font-bold text-sm text-gray-800 dark:text-white">{CATEGORY_NAMES[value]}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* STEP 2: Asset Details */}
            {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-sm font-bold mb-2">Nombre del Activo *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                            placeholder={`Ej: ${formData.category === ASSET_CATEGORIES.HOTEL ? 'Hotel Playa Sol 5 Estrellas' : 'Apartamento Luxury Penthouse'}`}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Descripción</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                            rows="4"
                            placeholder="Describe las características principales del activo..."
                        ></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Valoración Total (USD) *</label>
                        <input
                            type="number"
                            value={formData.valuationUSD}
                            onChange={(e) => setFormData({ ...formData, valuationUSD: e.target.value })}
                            className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                            placeholder="1000000"
                            required
                        />
                    </div>

                    {/* Category-specific fields */}
                    {getCategoryFields().map((field) => (
                        <div key={field.name}>
                            <label className="block text-sm font-bold mb-2">
                                {field.label} {field.required && '*'}
                            </label>
                            <input
                                type={field.type}
                                value={formData[field.name]}
                                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                placeholder={field.placeholder}
                                required={field.required}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* STEP 3: Tokenization Parameters */}
            {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-gold-800 dark:text-gold-200">Fee de Tokenización</span>
                            <span className="text-xl font-bold text-gold-600">{rwaContracts.tokenizationFee} BEZ</span>
                        </div>
                        <p className="text-xs text-gold-700 dark:text-gold-300">
                            Tu balance: {parseFloat(rwaContracts.bezBalance).toFixed(2)} BEZ
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Total de Fracciones *</label>
                            <input
                                type="number"
                                value={formData.totalSupply}
                                onChange={(e) => setFormData({ ...formData, totalSupply: e.target.value })}
                                className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                placeholder="1000"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">Número de tokens a crear (total supply)</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2">Precio por Fracción (BEZ) *</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.pricePerFraction}
                                onChange={(e) => setFormData({ ...formData, pricePerFraction: e.target.value })}
                                className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 font-mono"
                                placeholder="100.00"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Rendimiento Estimado (APY %) *</label>
                        <input
                            type="number"
                            step="0.1"
                            value={formData.estimatedYield}
                            onChange={(e) => setFormData({ ...formData, estimatedYield: e.target.value })}
                            className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                            placeholder="8.5"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Estimación anual de rentas pasivas</p>
                    </div>

                    {/* Calculation Preview */}
                    {formData.totalSupply && formData.pricePerFraction && (
                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                            <p className="text-sm font-bold mb-2">Vista Previa de Cálculos</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <p>Capital Total a Recaudar:</p>
                                <p className="font-mono font-bold text-right">{(formData.totalSupply * formData.pricePerFraction).toLocaleString()} BEZ</p>

                                <p>Valor por Fracción (USD):</p>
                                <p className="font-mono font-bold text-right">${(formData.valuationUSD / formData.totalSupply).toFixed(2)}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 4: Legal Documentation */}
            {step === 4 && (
                <div className="space-y-6 animate-fade-in">
                    {/* Legal Documents Upload */}
                    <div>
                        <label className="block text-sm font-bold mb-3">Documentación Legal * (PDF)</label>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center hover:border-gold-500 dark:hover:border-gold-600 transition-colors cursor-pointer">
                            <input
                                type="file"
                                multiple
                                accept="application/pdf"
                                onChange={(e) => handleFileUpload(e.target.files, 'legal')}
                                className="hidden"
                                id="legal-upload"
                            />
                            <label htmlFor="legal-upload" className="cursor-pointer">
                                <FaFileAlt className="text-4xl text-gray-400 mx-auto mb-3" />
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                    {uploadingIPFS ? 'Subiendo a IPFS...' : 'Click para subir PDFs'}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Escrituras, contratos, seguros, licencias</p>
                            </label>
                        </div>

                        {formData.legalDocuments.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {formData.legalDocuments.map((doc, idx) => (
                                    <div key={idx} className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FaCheckCircle className="text-green-500" />
                                            <span className="text-sm font-mono truncate max-w-xs">{doc.name}</span>
                                        </div>
                                        <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline"
                                        >
                                            Ver en IPFS
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Images Upload */}
                    <div>
                        <label className="block text-sm font-bold mb-3">Imágenes (Opcional)</label>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center hover:border-gold-500 dark:hover:border-gold-600 transition-colors cursor-pointer">
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e.target.files, 'images')}
                                className="hidden"
                                id="images-upload"
                            />
                            <label htmlFor="images-upload" className="cursor-pointer">
                                <FaCamera className="text-4xl text-gray-400 mx-auto mb-3" />
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                    Click para subir fotos
                                </p>
                                <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP. Max 10MB por archivo</p>
                            </label>
                        </div>

                        {formData.images.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {formData.images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-xs text-white text-center truncate">
                                            {img.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Visibility & Access Control */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <FaLock className="text-gold-500" /> Visibilidad y Acceso
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, visibility: 'public' })}
                                className={`p-4 rounded-lg border-2 text-left transition-all ${formData.visibility === 'public'
                                        ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <FaGlobe className="text-2xl mb-2 text-blue-500" />
                                <div className="font-bold">Público</div>
                                <div className="text-xs text-gray-500">Visible para todos en el marketplace</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, visibility: 'dao' })}
                                className={`p-4 rounded-lg border-2 text-left transition-all ${formData.visibility === 'dao'
                                        ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <FaUserFriends className="text-2xl mb-2 text-purple-500" />
                                <div className="font-bold">Solo DAO</div>
                                <div className="text-xs text-gray-500">Exclusivo para miembros de la DAO</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, visibility: 'private' })}
                                className={`p-4 rounded-lg border-2 text-left transition-all ${formData.visibility === 'private'
                                        ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <FaLock className="text-2xl mb-2 text-red-500" />
                                <div className="font-bold">Privado</div>
                                <div className="text-xs text-gray-500">Solo accesible mediante enlace directo</div>
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2">Requisitos de Acceso</label>
                            <select
                                value={formData.accessControl}
                                onChange={(e) => setFormData({ ...formData, accessControl: e.target.value })}
                                className="w-full p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600"
                            >
                                <option value="all">Sin restricciones (Cualquiera puede invertir)</option>
                                <option value="kyc">Requiere KYC Verificado</option>
                                <option value="whitelist">Solo Whitelist (Lista Blanca)</option>
                                <option value="accredited">Solo Inversores Acreditados</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                {step > 1 && (
                    <button
                        type="button"
                        onClick={prevStep}
                        className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold flex items-center gap-2"
                    >
                        <FaArrowLeft /> Anterior
                    </button>
                )}

                {step < 4 ? (
                    <button
                        type="button"
                        onClick={nextStep}
                        disabled={!canProceed()}
                        className="ml-auto px-6 py-3 rounded-lg bg-gold-500 hover:bg-gold-600 disabled:bg-gray-400 text-black font-bold flex items-center gap-2"
                    >
                        Siguiente <FaArrowRight />
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={loading || !canProceed()}
                        className="ml-auto px-8 py-3 rounded-lg bg-gradient-to-r from-gold-600 to-gold-400 hover:from-gold-700 hover:to-gold-500 disabled:from-gray-400 disabled:to-gray-400 text-black font-bold shadow-lg flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
                                Tokenizando...
                            </>
                        ) : (
                            <>
                                <FaCoins /> Tokenizar Activo
                            </>
                        )}
                    </button>
                )}
            </div>
        </form>
    );
};

export default RealEstateRWAForm;
