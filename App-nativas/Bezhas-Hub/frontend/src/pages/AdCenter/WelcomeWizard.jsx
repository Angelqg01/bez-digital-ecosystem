import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowLeft, FaArrowRight, FaCheckCircle, FaRocket } from 'react-icons/fa';
import { advertiserProfileService } from '../../services/adCenter.service';
import toast from 'react-hot-toast';

const WelcomeWizard = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        businessType: '',
        projectName: '',
        country: '',
        website: '',
        businessGoals: []
    });

    const businessTypes = [
        { value: 'nft-project', label: 'Proyecto NFT', icon: '🎨', description: 'Colecciones, marketplaces NFT' },
        { value: 'content-creator', label: 'Creador de Contenido', icon: '📹', description: 'Videos, streams, podcasts' },
        { value: 'defi-dapp', label: 'dApp / Protocolo DeFi', icon: '💎', description: 'Apps descentralizadas, DeFi' },
        { value: 'web3-service', label: 'Servicio Web3', icon: '🌐', description: 'Wallets, herramientas Web3' },
        { value: 'store', label: 'Tienda / Ecommerce', icon: '🛍️', description: 'Productos, servicios online' },
        { value: 'other', label: 'Otro', icon: '📦', description: 'Otro tipo de negocio' }
    ];

    const businessGoalsList = [
        { value: 'sell-nfts', label: 'Vender NFTs', icon: '🖼️' },
        { value: 'drive-traffic', label: 'Impulsar Tráfico', icon: '🚀' },
        { value: 'get-followers', label: 'Conseguir Seguidores', icon: '👥' },
        { value: 'brand-awareness', label: 'Awareness de Marca', icon: '📢' },
        { value: 'token-promotion', label: 'Promoción de Token', icon: '💰' },
        { value: 'community-growth', label: 'Crecimiento de Comunidad', icon: '🌱' },
        { value: 'app-installs', label: 'Instalaciones de App', icon: '📱' },
        { value: 'video-views', label: 'Visualizaciones de Video', icon: '▶️' }
    ];

    const handleBusinessTypeSelect = (type) => {
        setFormData({ ...formData, businessType: type });
    };

    const toggleGoal = (goal) => {
        const goals = formData.businessGoals.includes(goal)
            ? formData.businessGoals.filter(g => g !== goal)
            : [...formData.businessGoals, goal];
        setFormData({ ...formData, businessGoals: goals });
    };

    const handleSubmit = async () => {
        if (!formData.projectName.trim()) {
            toast.error('Por favor ingresa el nombre de tu proyecto');
            return;
        }

        setLoading(true);
        try {
            const response = await advertiserProfileService.createOrUpdateProfile(formData);

            if (response.success) {
                toast.success('¡Perfil creado exitosamente! 🎉');
                navigate('/ad-center');
            } else {
                toast.error(response.error || 'Error al crear perfil');
            }
        } catch (error) {
            console.error('Error creating profile:', error);
            toast.error('Error al crear perfil. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const canProceed = () => {
        if (currentStep === 1) return formData.businessType !== '';
        if (currentStep === 2) return formData.projectName.trim() !== '';
        if (currentStep === 3) return formData.businessGoals.length > 0;
        return true;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-4xl font-bold text-white mb-2">
                        Bienvenido al Ad Center de BeZhas
                    </h1>
                    <p className="text-gray-300">
                        Crea campañas publicitarias que lleguen a la comunidad Web3
                    </p>
                </motion.div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className="flex items-center flex-1">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${currentStep >= step
                                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                            : 'bg-gray-700 text-gray-400'
                                        }`}
                                >
                                    {currentStep > step ? <FaCheckCircle /> : step}
                                </div>
                                {step < 3 && (
                                    <div
                                        className={`h-1 flex-1 mx-2 transition-all ${currentStep > step ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-700'
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-sm text-gray-300">
                        <span>Tipo de Negocio</span>
                        <span>Detalles</span>
                        <span>Objetivos</span>
                    </div>
                </div>

                {/* Card Container */}
                <motion.div
                    className="bg-gray-800 rounded-2xl shadow-2xl p-8"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <AnimatePresence mode="wait">
                        {/* Step 1: Business Type */}
                        {currentStep === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2 className="text-2xl font-bold text-white mb-4">
                                    Describe tu negocio
                                </h2>
                                <p className="text-gray-300 mb-6">
                                    Selecciona el tipo que mejor describe tu proyecto
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {businessTypes.map((type) => (
                                        <button
                                            key={type.value}
                                            onClick={() => handleBusinessTypeSelect(type.value)}
                                            className={`p-6 rounded-xl text-left transition-all transform hover:scale-105 ${formData.businessType === type.value
                                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 ring-4 ring-purple-400'
                                                    : 'bg-gray-700 hover:bg-gray-600'
                                                }`}
                                        >
                                            <div className="text-4xl mb-3">{type.icon}</div>
                                            <h3 className="text-xl font-bold text-white mb-2">{type.label}</h3>
                                            <p className="text-sm text-gray-300">{type.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Project Details */}
                        {currentStep === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2 className="text-2xl font-bold text-white mb-4">
                                    Háblanos sobre tu proyecto
                                </h2>
                                <p className="text-gray-300 mb-6">
                                    Esta información nos ayuda a optimizar tus campañas
                                </p>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Nombre del Proyecto/Marca *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.projectName}
                                            onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                                            placeholder="ej: Mi Proyecto NFT"
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            País/Región
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.country}
                                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                            placeholder="ej: España"
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Sitio Web
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.website}
                                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                            placeholder="https://miproyecto.com"
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Business Goals */}
                        {currentStep === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2 className="text-2xl font-bold text-white mb-4">
                                    Algunos detalles más
                                </h2>
                                <p className="text-gray-300 mb-6">
                                    ¿Cuáles son tus objetivos empresariales? (Selecciona al menos uno)
                                </p>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {businessGoalsList.map((goal) => (
                                        <button
                                            key={goal.value}
                                            onClick={() => toggleGoal(goal.value)}
                                            className={`p-4 rounded-xl text-center transition-all transform hover:scale-105 ${formData.businessGoals.includes(goal.value)
                                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 ring-2 ring-purple-400'
                                                    : 'bg-gray-700 hover:bg-gray-600'
                                                }`}
                                        >
                                            <div className="text-3xl mb-2">{goal.icon}</div>
                                            <p className="text-sm text-white font-medium">{goal.label}</p>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                                    <p className="text-sm text-gray-300">
                                        <strong className="text-white">Seleccionados:</strong>{' '}
                                        {formData.businessGoals.length > 0
                                            ? formData.businessGoals
                                                .map((g) => businessGoalsList.find((goal) => goal.value === g)?.label)
                                                .join(', ')
                                            : 'Ninguno'}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-8 pt-6 border-t border-gray-700">
                        <button
                            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                            disabled={currentStep === 1}
                            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${currentStep === 1
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-700 text-white hover:bg-gray-600'
                                }`}
                        >
                            <FaArrowLeft />
                            <span>Atrás</span>
                        </button>

                        {currentStep < 3 ? (
                            <button
                                onClick={() => setCurrentStep(currentStep + 1)}
                                disabled={!canProceed()}
                                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${canProceed()
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                <span>Siguiente</span>
                                <FaArrowRight />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!canProceed() || loading}
                                className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-all ${canProceed() && !loading
                                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                        <span>Creando...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaRocket />
                                        <span>Comenzar</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default WelcomeWizard;
