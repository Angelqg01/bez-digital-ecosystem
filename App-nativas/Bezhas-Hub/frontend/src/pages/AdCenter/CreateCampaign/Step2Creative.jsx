import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaImage, FaUpload, FaTimes, FaGlobe, FaMapMarkerAlt, FaUsers, FaCalendar, FaEuroSign } from 'react-icons/fa';
import { campaignsService } from '../../../services/adCenter.service';
import toast from 'react-hot-toast';

const Step2Creative = ({ formData, setFormData, onNext, onBack }) => {
    const [uploadingImage, setUploadingImage] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleImageUpload = async (file) => {
        if (!file) return;

        // Validar tamaño (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('La imagen no puede ser mayor a 5MB');
            return;
        }

        // Validar tipo
        if (!file.type.startsWith('image/')) {
            toast.error('Solo se permiten archivos de imagen');
            return;
        }

        setUploadingImage(true);
        try {
            const response = await campaignsService.uploadCreative(file);
            if (response.success) {
                setFormData({
                    ...formData,
                    creative: {
                        ...formData.creative,
                        imageUrl: response.imageUrl
                    }
                });
                toast.success('Imagen subida exitosamente');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error('Error al subir imagen');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    }, []);

    const updateCreative = (field, value) => {
        setFormData({
            ...formData,
            creative: {
                ...formData.creative,
                [field]: value
            }
        });
    };

    const updateTargeting = (field, value) => {
        setFormData({
            ...formData,
            targeting: {
                ...formData.targeting,
                [field]: value
            }
        });
    };

    const updateBudget = (field, value) => {
        setFormData({
            ...formData,
            budget: {
                ...formData.budget,
                [field]: parseFloat(value) || 0
            }
        });
    };

    const updateSchedule = (field, value) => {
        setFormData({
            ...formData,
            schedule: {
                ...formData.schedule,
                [field]: value
            }
        });
    };

    const canProceed = () => {
        return (
            formData.creative?.imageUrl &&
            formData.creative?.title?.trim() &&
            formData.creative?.description?.trim() &&
            formData.creative?.destinationUrl?.trim() &&
            formData.budget?.dailyBudget >= 5 &&
            formData.budget?.totalBudget >= 10 &&
            formData.budget?.bidAmount >= 0.01 &&
            formData.schedule?.startDate
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Creative Builder */}
            <div>
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-6"
                >
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Creatividad del Anuncio
                    </h2>
                    <p className="text-gray-400">
                        Diseña tu anuncio y configura la segmentación
                    </p>
                </motion.div>

                {/* Image Upload */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Imagen del Anuncio *
                    </label>

                    {formData.creative?.imageUrl ? (
                        <div className="relative">
                            <img
                                src={formData.creative.imageUrl}
                                alt="Preview"
                                className="w-full h-64 object-cover rounded-lg"
                            />
                            <button
                                onClick={() => updateCreative('imageUrl', '')}
                                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    ) : (
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${dragActive
                                    ? 'border-purple-500 bg-purple-500 bg-opacity-10'
                                    : 'border-gray-600 hover:border-gray-500'
                                }`}
                        >
                            <FaImage className="text-6xl text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 mb-4">
                                Arrastra una imagen aquí o haz clic para seleccionar
                            </p>
                            <label className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg cursor-pointer hover:bg-purple-700 transition-all">
                                <FaUpload />
                                <span>{uploadingImage ? 'Subiendo...' : 'Seleccionar Imagen'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])}
                                    className="hidden"
                                    disabled={uploadingImage}
                                />
                            </label>
                            <p className="text-xs text-gray-500 mt-2">
                                JPG, PNG, GIF o WEBP. Máximo 5MB.
                            </p>
                        </div>
                    )}
                </div>

                {/* Title */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Título del Anuncio * <span className="text-gray-500">({formData.creative?.title?.length || 0}/100)</span>
                    </label>
                    <input
                        type="text"
                        value={formData.creative?.title || ''}
                        onChange={(e) => updateCreative('title', e.target.value)}
                        maxLength={100}
                        placeholder="ej: Descubre la Nueva Colección NFT"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                {/* Description */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Descripción * <span className="text-gray-500">({formData.creative?.description?.length || 0}/300)</span>
                    </label>
                    <textarea
                        value={formData.creative?.description || ''}
                        onChange={(e) => updateCreative('description', e.target.value)}
                        maxLength={300}
                        rows={4}
                        placeholder="Describe tu producto, servicio o proyecto..."
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                </div>

                {/* Destination URL */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        URL de Destino *
                    </label>
                    <div className="relative">
                        <FaGlobe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                        <input
                            type="url"
                            value={formData.creative?.destinationUrl || ''}
                            onChange={(e) => updateCreative('destinationUrl', e.target.value)}
                            placeholder="https://tuproyecto.com"
                            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Call to Action */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Llamada a la Acción
                    </label>
                    <select
                        value={formData.creative?.callToAction || 'learn-more'}
                        onChange={(e) => updateCreative('callToAction', e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="learn-more">Aprender Más</option>
                        <option value="shop-now">Comprar Ahora</option>
                        <option value="sign-up">Registrarse</option>
                        <option value="download">Descargar</option>
                        <option value="get-started">Comenzar</option>
                        <option value="join-now">Únete Ahora</option>
                    </select>
                </div>
            </div>

            {/* Right Column: Targeting & Budget */}
            <div>
                {/* Ad Preview */}
                <div className="mb-6 sticky top-6">
                    <h3 className="text-lg font-bold text-white mb-3">
                        Vista Previa
                    </h3>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                        {formData.creative?.imageUrl && (
                            <img
                                src={formData.creative.imageUrl}
                                alt="Preview"
                                className="w-full h-48 object-cover"
                            />
                        )}
                        <div className="p-4">
                            <h4 className="text-white font-bold mb-2">
                                {formData.creative?.title || 'Título del anuncio'}
                            </h4>
                            <p className="text-gray-400 text-sm mb-3">
                                {formData.creative?.description || 'Descripción del anuncio...'}
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    {formData.creative?.destinationUrl || 'tuproyecto.com'}
                                </span>
                                <button className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg">
                                    {formData.creative?.callToAction?.replace('-', ' ').toUpperCase() || 'VER MÁS'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Targeting */}
                    <div className="mt-6 space-y-4">
                        <div>
                            <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                                <FaMapMarkerAlt />
                                <span>Palabras Clave (opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.targeting?.keywords?.join(', ') || ''}
                                onChange={(e) => updateTargeting('keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                                placeholder="NFT, crypto, blockchain"
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        {/* Budget */}
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                            <h4 className="text-white font-bold mb-3 flex items-center space-x-2">
                                <FaEuroSign />
                                <span>Presupuesto *</span>
                            </h4>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">
                                        Presupuesto Diario (mínimo €5)
                                    </label>
                                    <input
                                        type="number"
                                        min="5"
                                        step="1"
                                        value={formData.budget?.dailyBudget || ''}
                                        onChange={(e) => updateBudget('dailyBudget', e.target.value)}
                                        placeholder="5.00"
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">
                                        Presupuesto Total (mínimo €10)
                                    </label>
                                    <input
                                        type="number"
                                        min="10"
                                        step="1"
                                        value={formData.budget?.totalBudget || ''}
                                        onChange={(e) => updateBudget('totalBudget', e.target.value)}
                                        placeholder="10.00"
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">
                                        Puja por {formData.objective === 'clicks' ? 'Clic' : 'Impresión'} (mínimo €0.01)
                                    </label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={formData.budget?.bidAmount || ''}
                                        onChange={(e) => updateBudget('bidAmount', e.target.value)}
                                        placeholder="0.10"
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                            <h4 className="text-white font-bold mb-3 flex items-center space-x-2">
                                <FaCalendar />
                                <span>Programación *</span>
                            </h4>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">
                                        Fecha de Inicio
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.schedule?.startDate ? new Date(formData.schedule.startDate).toISOString().split('T')[0] : ''}
                                        onChange={(e) => updateSchedule('startDate', new Date(e.target.value).toISOString())}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">
                                        Fecha de Fin (opcional)
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.schedule?.endDate ? new Date(formData.schedule.endDate).toISOString().split('T')[0] : ''}
                                        onChange={(e) => updateSchedule('endDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                        min={formData.schedule?.startDate ? new Date(formData.schedule.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="col-span-full flex justify-between mt-8">
                <button
                    onClick={onBack}
                    className="px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all"
                >
                    ← Atrás
                </button>

                <button
                    onClick={onNext}
                    disabled={!canProceed()}
                    className={`px-8 py-3 rounded-lg font-medium transition-all ${canProceed()
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    Siguiente: Pago y Lanzamiento →
                </button>
            </div>
        </div>
    );
};

export default Step2Creative;
