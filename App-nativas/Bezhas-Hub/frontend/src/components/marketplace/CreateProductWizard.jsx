import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight, ChevronLeft, Check, Package, Tag, Truck,
    FileText, Sparkles, AlertCircle, Upload, X, Wallet, CreditCard, ExternalLink
} from 'lucide-react';
import {
    MARKETPLACE_CATEGORIES,
    SALE_TYPES,
    getSaleTypesForCategory,
    SHIPPING_METHODS,
    PAYMENT_METHODS,
    CERTIFICATIONS,
    MANUFACTURING_COUNTRIES,
    LEAD_TIMES
} from '../../data/marketplaceConstants';

/**
 * 🧙‍♂️ Wizard de Creación de Producto - Intuitivo y Paso a Paso
 * Soporta NFTs + Productos Físicos (Retail, Industrial, Bulk)
 */
const CreateProductWizard = ({ onComplete, onCancel }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [walletConnected, setWalletConnected] = useState(false);
    const [stripeConnected, setStripeConnected] = useState(false);

    // Verificar conexiones al cargar
    useEffect(() => {
        // Verificar wallet conectada (localStorage o provider)
        const checkWallet = async () => {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    setWalletConnected(accounts.length > 0);
                } catch (error) {
                    console.error('Error verificando wallet:', error);
                }
            }
        };

        // Verificar Stripe conectado (localStorage o API)
        const checkStripe = () => {
            const stripeStatus = localStorage.getItem('stripe_connected');
            setStripeConnected(stripeStatus === 'true');
        };

        checkWallet();
        checkStripe();

        // Listener para actualización automática desde otras pestañas/ventanas
        const handleStorageChange = (e) => {
            if (e.key === 'stripe_connected') {
                checkStripe();
                console.log('✅ Estado de Stripe actualizado automáticamente');
            }
        };

        // Listener para cambios de cuenta en wallet
        const handleAccountsChanged = (accounts) => {
            setWalletConnected(accounts.length > 0);
            console.log('✅ Estado de Wallet actualizado automáticamente');
        };

        // Interval para re-verificar cada 3 segundos (detecta cambios de otras ventanas)
        const interval = setInterval(() => {
            checkWallet();
            checkStripe();
        }, 3000);

        window.addEventListener('storage', handleStorageChange);
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorageChange);
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    const [productData, setProductData] = useState({
        // Paso 1: Tipo y Categoría
        category: '',
        saleType: '',

        // Paso 2: Información Básica
        name: '',
        description: '',
        images: [],

        // Paso 3: Precios y Stock
        price: '',
        currency: 'BEZ',
        stock: '',
        moq: '',
        bulkPricing: [],

        // Paso 4: Especificaciones Técnicas
        specifications: {
            weight: '',
            dimensions: '',
            material: '',
            color: '',
            brand: '',
            model: '',
            country: '',
            certifications: [],
        },

        // Paso 5: Logística
        shippingMethods: [],
        leadTime: '',
        productionCapacity: '',

        // Paso 6: Opciones de Pago
        paymentMethods: [],

        // NFT Específico
        royalties: 10,
        blockchain: 'ethereum',
        metadata: {}
    });

    const steps = [
        {
            number: 1,
            title: 'Tipo de Producto',
            icon: Package,
            description: 'Selecciona categoría y tipo de venta'
        },
        {
            number: 2,
            title: 'Información Básica',
            icon: FileText,
            description: 'Nombre, descripción e imágenes'
        },
        {
            number: 3,
            title: 'Precio y Stock',
            icon: Tag,
            description: 'Define precios y disponibilidad'
        },
        {
            number: 4,
            title: 'Especificaciones',
            icon: Sparkles,
            description: 'Detalles técnicos del producto'
        },
        {
            number: 5,
            title: 'Logística',
            icon: Truck,
            description: 'Métodos de envío y tiempos'
        },
        {
            number: 6,
            title: 'Revisión',
            icon: Check,
            description: 'Confirma y publica'
        }
    ];

    const updateField = (field, value) => {
        setProductData(prev => ({ ...prev, [field]: value }));
    };

    const updateSpecification = (field, value) => {
        setProductData(prev => ({
            ...prev,
            specifications: { ...prev.specifications, [field]: value }
        }));
    };

    const nextStep = () => {
        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async () => {
        try {
            // Preparar datos del producto con estado pendiente de revisión
            const productPayload = {
                ...productData,
                status: 'pending_review',
                createdAt: new Date().toISOString(),
                seller: 'current_user' // TODO: Reemplazar con wallet/user real
            };

            console.log('📦 Enviando producto a revisión admin:', productPayload);

            // Enviar al backend para revisión del admin
            const response = await fetch('http://localhost:3001/api/marketplace/products/submit-review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productPayload)
            });

            if (!response.ok) {
                throw new Error('Error al enviar producto para revisión');
            }

            const result = await response.json();
            console.log('✅ Producto enviado exitosamente:', result);

            // Notificar éxito al componente padre
            onComplete({
                ...productPayload,
                submittedForReview: true,
                message: 'Producto enviado para revisión del administrador'
            });

        } catch (error) {
            console.error('❌ Error al enviar producto:', error);

            let errorMessage = 'Error al enviar el producto para revisión.';

            if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
                errorMessage = '⚠️ No se puede conectar al servidor. Asegúrate de que el backend esté corriendo en http://localhost:3001';
            } else if (error.message?.includes('404')) {
                errorMessage = '⚠️ Endpoint no encontrado. Verifica la configuración del servidor.';
            }

            alert(errorMessage + '\n\nPor favor intenta de nuevo.');
        }
    };

    // Obtener tipos de venta según categoría seleccionada
    const availableSaleTypes = productData.category
        ? getSaleTypesForCategory(productData.category)
        : Object.values(SALE_TYPES);

    const selectedSaleType = SALE_TYPES[productData.saleType];
    const isNFT = productData.saleType?.startsWith('nft_');

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Crear Nuevo Producto
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Paso {currentStep} de {steps.length}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.number}>
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${currentStep >= step.number
                                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                            }`}
                                    >
                                        {currentStep > step.number ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            <step.icon className="w-5 h-5" />
                                        )}
                                    </div>
                                    <span className={`text-xs mt-2 text-center ${currentStep >= step.number ? 'text-purple-600 dark:text-purple-400 font-semibold' : 'text-gray-400'
                                        }`}>
                                        {step.title}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`h-1 flex-1 mx-2 rounded transition-all ${currentStep > step.number
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                                        : 'bg-gray-200 dark:bg-gray-700'
                                        }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* PASO 1: Tipo y Categoría */}
                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                            ¿Qué tipo de producto vas a vender?
                                        </h3>

                                        {/* Categorías */}
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                            Categoría
                                        </label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                            {MARKETPLACE_CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => updateField('category', cat.id)}
                                                    className={`p-4 rounded-xl border-2 transition-all text-left ${productData.category === cat.id
                                                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                                        }`}
                                                >
                                                    <div className="text-2xl mb-2">{cat.label.split(' ')[0]}</div>
                                                    <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                                        {cat.label.substring(cat.label.indexOf(' ') + 1)}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {cat.description}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Tipos de Venta */}
                                        {productData.category && (
                                            <>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                                    Tipo de Venta
                                                </label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {availableSaleTypes.map((type) => (
                                                        <button
                                                            key={type.id}
                                                            onClick={() => updateField('saleType', type.id)}
                                                            className={`p-4 rounded-xl border-2 transition-all text-left ${productData.saleType === type.id
                                                                ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-900/20'
                                                                : 'border-gray-200 dark:border-gray-700 hover:border-cyan-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <span className="text-2xl">{type.icon}</span>
                                                                <span className="font-semibold text-gray-900 dark:text-white">
                                                                    {type.label}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {type.description}
                                                            </p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* PASO 2: Información Básica */}
                            {currentStep === 2 && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            Nombre del Producto *
                                        </label>
                                        <input
                                            type="text"
                                            value={productData.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            placeholder="Ej: Panel Solar 500W Monocristalino"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            Descripción *
                                        </label>
                                        <textarea
                                            value={productData.description}
                                            onChange={(e) => updateField('description', e.target.value)}
                                            placeholder="Describe tu producto en detalle..."
                                            rows={6}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            Imágenes del Producto
                                        </label>
                                        <input
                                            type="file"
                                            id="product-images"
                                            multiple
                                            accept="image/png,image/jpeg,image/jpg"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files);
                                                if (files.length + productData.images.length > 5) {
                                                    alert('Máximo 5 imágenes permitidas');
                                                    return;
                                                }
                                                // Crear URLs temporales para preview
                                                const newImages = files.map(file => ({
                                                    file,
                                                    preview: URL.createObjectURL(file),
                                                    name: file.name
                                                }));
                                                updateField('images', [...productData.images, ...newImages]);
                                            }}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="product-images"
                                            className="block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-purple-400 transition-colors cursor-pointer"
                                        >
                                            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Arrastra imágenes aquí o haz click para subir
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                                PNG, JPG hasta 10MB (Máximo 5 imágenes)
                                            </p>
                                        </label>

                                        {/* Preview de imágenes */}
                                        {productData.images.length > 0 && (
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                                                {productData.images.map((img, idx) => (
                                                    <div key={idx} className="relative group">
                                                        <img
                                                            src={img.preview}
                                                            alt={img.name}
                                                            className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                URL.revokeObjectURL(img.preview);
                                                                updateField('images', productData.images.filter((_, i) => i !== idx));
                                                            }}
                                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* PASO 3: Precio y Stock */}
                            {currentStep === 3 && (
                                <div className="space-y-6">
                                    {/* Precio Base */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Precio {selectedSaleType ? `(por ${selectedSaleType.units[0]})` : ''} *
                                            </label>
                                            <input
                                                type="number"
                                                value={productData.price}
                                                onChange={(e) => updateField('price', e.target.value)}
                                                placeholder="0.00"
                                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Moneda
                                            </label>
                                            <select
                                                value={productData.currency}
                                                onChange={(e) => updateField('currency', e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                            >
                                                <option value="BEZ">BEZ</option>
                                                <option value="ETH">ETH</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Stock (no NFT) */}
                                    {!isNFT && (
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Stock Disponible
                                            </label>
                                            <input
                                                type="number"
                                                value={productData.stock}
                                                onChange={(e) => updateField('stock', e.target.value)}
                                                placeholder="Cantidad disponible"
                                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                            />
                                        </div>
                                    )}

                                    {/* MOQ si aplica */}
                                    {selectedSaleType?.requiresMOQ && (
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                MOQ (Cantidad Mínima de Pedido)
                                            </label>
                                            <input
                                                type="number"
                                                value={productData.moq}
                                                onChange={(e) => updateField('moq', e.target.value)}
                                                placeholder="Ej: 100"
                                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                            />
                                        </div>
                                    )}

                                    {/* Royalties para NFT */}
                                    {isNFT && (
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Regalías por Reventa (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={productData.royalties}
                                                onChange={(e) => updateField('royalties', e.target.value)}
                                                min="0"
                                                max="50"
                                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Porcentaje que recibirás en cada reventa futura (0-50%)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PASO 4: Especificaciones Técnicas */}
                            {currentStep === 4 && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                        Especificaciones del Producto
                                    </h3>

                                    {!isNFT && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                        Peso
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={productData.specifications.weight}
                                                        onChange={(e) => updateSpecification('weight', e.target.value)}
                                                        placeholder="Ej: 25 kg"
                                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                        Dimensiones
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={productData.specifications.dimensions}
                                                        onChange={(e) => updateSpecification('dimensions', e.target.value)}
                                                        placeholder="Ej: 120x80x50 cm"
                                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                        Material
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={productData.specifications.material}
                                                        onChange={(e) => updateSpecification('material', e.target.value)}
                                                        placeholder="Ej: Acero inoxidable 304"
                                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                        Marca
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={productData.specifications.brand}
                                                        onChange={(e) => updateSpecification('brand', e.target.value)}
                                                        placeholder="Ej: Samsung"
                                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    País de Fabricación
                                                </label>
                                                <select
                                                    value={productData.specifications.country}
                                                    onChange={(e) => updateSpecification('country', e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                >
                                                    <option value="" key="default">Seleccionar país</option>
                                                    {MANUFACTURING_COUNTRIES.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                                    Certificaciones (Opcional)
                                                </label>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {CERTIFICATIONS.map((cert) => (
                                                        <button
                                                            key={cert.id}
                                                            type="button"
                                                            onClick={() => {
                                                                const current = productData.specifications.certifications;
                                                                const updated = current.includes(cert.id)
                                                                    ? current.filter(c => c !== cert.id)
                                                                    : [...current, cert.id];
                                                                updateSpecification('certifications', updated);
                                                            }}
                                                            className={`p-3 rounded-xl border-2 text-left transition-all hover:scale-105 ${productData.specifications.certifications.includes(cert.id)
                                                                ? 'border-green-600 bg-green-50 dark:bg-green-900/30 shadow-lg'
                                                                : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                                                                }`}
                                                        >
                                                            <div className="flex items-start gap-2">
                                                                <span className="text-xl">{cert.icon}</span>
                                                                <div className="flex-1">
                                                                    <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                                                        {cert.name}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                        {cert.description}
                                                                    </div>
                                                                </div>
                                                                {productData.specifications.certifications.includes(cert.id) && (
                                                                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* NFT Metadata */}
                                    {isNFT && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    Blockchain
                                                </label>
                                                <select
                                                    value={productData.blockchain}
                                                    onChange={(e) => updateField('blockchain', e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                >
                                                    <option value="ethereum">Ethereum (ETH)</option>
                                                    <option value="polygon">Polygon (MATIC)</option>
                                                    <option value="bnb">BNB Chain</option>
                                                    <option value="arbitrum">Arbitrum</option>
                                                </select>
                                            </div>

                                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                                                <div className="flex items-start gap-3">
                                                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                                    <div>
                                                        <p className="font-semibold text-blue-900 dark:text-blue-100 text-sm">
                                                            NFT único e inmutable
                                                        </p>
                                                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                                            Tu obra será acuñada en la blockchain seleccionada. Los metadatos se almacenarán en IPFS de forma permanente.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PASO 5: Logística */}
                            {currentStep === 5 && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                        Métodos de Envío y Logística
                                    </h3>

                                    {!isNFT ? (
                                        <>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                                    Métodos de Envío Disponibles
                                                </label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {SHIPPING_METHODS.map((method) => (
                                                        <button
                                                            key={method.id}
                                                            onClick={() => {
                                                                const current = productData.shippingMethods;
                                                                const updated = current.includes(method.id)
                                                                    ? current.filter(m => m !== method.id)
                                                                    : [...current, method.id];
                                                                updateField('shippingMethods', updated);
                                                            }}
                                                            className={`p-4 rounded-xl border-2 text-left transition-all ${productData.shippingMethods.includes(method.id)
                                                                ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-900/20'
                                                                : 'border-gray-300 dark:border-gray-600 hover:border-cyan-400'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                                                                    {method.name}
                                                                </span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {method.estimatedTime}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {method.description}
                                                            </p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                        Tiempo de Entrega
                                                    </label>
                                                    <select
                                                        value={productData.leadTime}
                                                        onChange={(e) => updateField('leadTime', e.target.value)}
                                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                    >
                                                        <option value="">Seleccionar</option>
                                                        {LEAD_TIMES.map(lt => (
                                                            <option key={lt.id} value={lt.id}>{lt.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                        Capacidad de Producción (Opcional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={productData.productionCapacity}
                                                        onChange={(e) => updateField('productionCapacity', e.target.value)}
                                                        placeholder="Ej: 10,000 unidades/mes"
                                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                                    Métodos de Pago Aceptados
                                                </label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {PAYMENT_METHODS.filter(m => m.id === 'crypto' || m.id === 'card').map((method) => {
                                                        const isConnected = method.id === 'crypto' ? walletConnected : stripeConnected;
                                                        const isSelected = productData.paymentMethods.includes(method.id);

                                                        return (
                                                            <div key={method.id} className="space-y-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (!isConnected) return; // Solo permitir si está conectado
                                                                        const current = productData.paymentMethods;
                                                                        const updated = current.includes(method.id)
                                                                            ? current.filter(m => m !== method.id)
                                                                            : [...current, method.id];
                                                                        updateField('paymentMethods', updated);
                                                                    }}
                                                                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${isSelected
                                                                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 shadow-lg'
                                                                            : isConnected
                                                                                ? 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                                                                                : 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                                                                        }`}
                                                                    disabled={!isConnected}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        {/* Logo/Icono */}
                                                                        <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                                                                            {method.id === 'crypto' ? (
                                                                                <Wallet className="w-6 h-6 text-purple-600" />
                                                                            ) : (
                                                                                <CreditCard className="w-6 h-6 text-blue-600" />
                                                                            )}
                                                                        </div>

                                                                        <div className="flex-1">
                                                                            <div className="flex items-center justify-between mb-1">
                                                                                <span className="font-bold text-gray-900 dark:text-white">
                                                                                    {method.name}
                                                                                </span>
                                                                                {isSelected && (
                                                                                    <Check className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                                                )}
                                                                            </div>
                                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                                                {method.description}
                                                                            </p>
                                                                            <div className="flex items-center gap-2">
                                                                                {isConnected ? (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                                                                                        <Check className="w-3 h-3" />
                                                                                        Conectado
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                                                                                        <AlertCircle className="w-3 h-3" />
                                                                                        No conectado
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-xs text-gray-400">
                                                                                    {method.fee}% comisión
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </button>

                                                                {/* Botón para conectar */}
                                                                {!isConnected && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (method.id === 'crypto') {
                                                                                // Abrir modal de wallet o redirigir a perfil
                                                                                window.open('/profile/settings?tab=payment', '_blank');
                                                                            } else {
                                                                                // Redirigir a configuración de Stripe en perfil
                                                                                window.open('/profile/settings?tab=payment', '_blank');
                                                                            }
                                                                        }}
                                                                        className="w-full px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors flex items-center justify-center gap-2"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                        Conectar {method.name} en Perfil
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Mensaje informativo */}
                                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                                    <div className="flex items-start gap-2">
                                                        <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                                            Conecta tus métodos de pago en tu perfil para activar pagos automáticos. Las actualizaciones se reflejan inmediatamente.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-12">
                                            <Sparkles className="w-16 h-16 mx-auto text-purple-500 mb-4" />
                                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                                Los NFTs son activos digitales
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                                No requieren envío físico. La transferencia es instantánea en la blockchain.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PASO 6: Revisión Final */}
                            {currentStep === 6 && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                        Revisión Final
                                    </h3>

                                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
                                        <div className="flex items-start gap-4">
                                            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                                                <Package className="w-12 h-12 text-gray-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                                    {productData.name || 'Nombre del Producto'}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                                    {productData.description || 'Sin descripción'}
                                                </p>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">Categoría:</span>
                                                        <p className="font-semibold text-gray-900 dark:text-white">
                                                            {MARKETPLACE_CATEGORIES.find(c => c.id === productData.category)?.label || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">Tipo de Venta:</span>
                                                        <p className="font-semibold text-gray-900 dark:text-white">
                                                            {SALE_TYPES[productData.saleType]?.label || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">Precio:</span>
                                                        <p className="font-semibold text-gray-900 dark:text-white">
                                                            {productData.price ? `${productData.price} ${productData.currency}` : 'N/A'}
                                                        </p>
                                                    </div>
                                                    {!isNFT && (
                                                        <div>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">Stock:</span>
                                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                                {productData.stock || 'Sin límite'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Términos y Condiciones */}
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-yellow-900 dark:text-yellow-100 text-sm mb-2">
                                                    Antes de publicar
                                                </p>
                                                <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                                                    <li>✓ Verifica que toda la información sea correcta</li>
                                                    <li>✓ Las imágenes deben ser de tu propiedad o con licencia</li>
                                                    <li>✓ Los NFTs son transacciones irreversibles en blockchain</li>
                                                    <li>✓ Asegúrate de cumplir con las regulaciones de tu país</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                        <input
                                            type="checkbox"
                                            id="terms"
                                            className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <label htmlFor="terms" className="text-sm text-gray-700 dark:text-gray-300">
                                            Acepto los <span className="text-purple-600 dark:text-purple-400 font-semibold cursor-pointer">Términos y Condiciones</span> del marketplace
                                        </label>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className="px-6 py-3 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Anterior
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-6 py-3 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                        >
                            Cancelar
                        </button>

                        {currentStep === steps.length ? (
                            <button
                                onClick={handleSubmit}
                                className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 transition-all flex items-center gap-2 shadow-lg"
                            >
                                <Check className="w-5 h-5" />
                                Publicar Producto
                            </button>
                        ) : (
                            <button
                                onClick={nextStep}
                                disabled={!productData.category || !productData.saleType}
                                className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                Siguiente
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default CreateProductWizard;
