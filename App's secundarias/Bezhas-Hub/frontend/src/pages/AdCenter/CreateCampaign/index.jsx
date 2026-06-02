import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Step1Objective from './Step1Objective';
import Step2Creative from './Step2Creative';
import Step3Payment from './Step3Payment';
import Step4Success from './Step4Success';

const CreateCampaignWizard = () => {
    const navigate = useNavigate();
    const { step } = useParams();
    const currentStep = parseInt(step) || 1;

    const [formData, setFormData] = useState({
        objective: '',
        name: '',
        creative: {
            title: '',
            description: '',
            imageUrl: '',
            destinationUrl: '',
            callToAction: 'learn-more'
        },
        targeting: {
            keywords: [],
            locations: [],
            demographics: {},
            deviceTypes: [],
            platforms: []
        },
        budget: {
            dailyBudget: 5,
            totalBudget: 10,
            bidAmount: 0.10,
            bidStrategy: 'manual',
            currency: 'EUR'
        },
        schedule: {
            startDate: new Date().toISOString(),
            endDate: null
        }
    });

    // Cargar draft desde localStorage al montar
    useEffect(() => {
        const savedDraft = localStorage.getItem('adCampaignDraft');
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                setFormData(parsed);
            } catch (error) {
                console.error('Error loading draft:', error);
            }
        }
    }, []);

    // Guardar draft en localStorage cuando cambie formData
    useEffect(() => {
        if (formData.objective) {
            localStorage.setItem('adCampaignDraft', JSON.stringify(formData));
        }
    }, [formData]);

    const handleNext = () => {
        if (currentStep < 4) {
            navigate(`/ad-center/create-campaign/${currentStep + 1}`);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            navigate(`/ad-center/create-campaign/${currentStep - 1}`);
        } else {
            navigate('/ad-center');
        }
    };

    const steps = [
        { number: 1, title: 'Objetivo' },
        { number: 2, title: 'Creatividad' },
        { number: 3, title: 'Lanzamiento' }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <button
                        onClick={() => navigate('/ad-center')}
                        className="text-gray-400 hover:text-white transition-colors mb-4 flex items-center space-x-2"
                    >
                        <span>←</span>
                        <span>Volver al Dashboard</span>
                    </button>

                    <h1 className="text-3xl font-bold text-white mb-2">
                        Crear Nueva Campaña
                    </h1>
                    <p className="text-gray-400">
                        Sigue los pasos para crear tu campaña publicitaria
                    </p>
                </motion.div>

                {/* Progress Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8"
                >
                    <div className="flex items-center justify-between mb-4">
                        {steps.map((s, index) => (
                            <div key={s.number} className="flex items-center flex-1">
                                {/* Step Circle */}
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${currentStep > s.number
                                            ? 'bg-green-600 text-white'
                                            : currentStep === s.number
                                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white ring-4 ring-purple-400 ring-opacity-50'
                                                : 'bg-gray-700 text-gray-400'
                                            }`}
                                    >
                                        {currentStep > s.number ? '✓' : s.number}
                                    </div>
                                    <span
                                        className={`mt-2 text-sm font-medium ${currentStep >= s.number ? 'text-white' : 'text-gray-500'
                                            }`}
                                    >
                                        {s.title}
                                    </span>
                                </div>

                                {/* Connector Line */}
                                {index < steps.length - 1 && (
                                    <div className="flex-1 mx-4">
                                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: '0%' }}
                                                animate={{
                                                    width: currentStep > s.number ? '100%' : '0%'
                                                }}
                                                transition={{ duration: 0.5 }}
                                                className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Progress Percentage */}
                    <div className="mt-4">
                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                            <span>Progreso</span>
                            <span>{Math.round((currentStep / 3) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: '0%' }}
                                animate={{ width: `${(currentStep / 3) * 100}%` }}
                                transition={{ duration: 0.5 }}
                                className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Step Content */}
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-8"
                >
                    {currentStep === 1 && (
                        <Step1Objective
                            formData={formData}
                            setFormData={setFormData}
                            onNext={handleNext}
                        />
                    )}

                    {currentStep === 2 && (
                        <Step2Creative
                            formData={formData}
                            setFormData={setFormData}
                            onNext={handleNext}
                            onBack={handleBack}
                        />
                    )}

                    {currentStep === 3 && (
                        <Step3Payment
                            formData={formData}
                            onBack={handleBack}
                            onNext={handleNext}
                        />
                    )}

                    {currentStep === 4 && (
                        <Step4Success />
                    )}
                </motion.div>

                {/* Help Text */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 text-center text-sm text-gray-500"
                >
                    ¿Necesitas ayuda? Consulta nuestra{' '}
                    <a href="/help/ad-center" className="text-purple-400 hover:text-purple-300 underline">
                        guía de creación de anuncios
                    </a>
                </motion.div>
            </div>
        </div>
    );
};

export default CreateCampaignWizard;
