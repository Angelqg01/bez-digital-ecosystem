import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
    Image,
    FileText,
    MapPin,
    Smile,
    Globe,
    Lock,
    Users,
    X,
    Video,
    Music,
    File,
    FileVideo,
    Shield,
    Loader2,
    Check
} from 'lucide-react';
import { usePostCreation } from '../../hooks/usePostCreation';

/**
 * CreatePostArea Component
 * Área para crear nuevas publicaciones con soporte para:
 * - Imágenes (jpg, png, gif, webp)
 * - Videos (mp4, webm, mov)
 * - Audio (mp3, wav, ogg)
 * - PDFs y documentos
 * - Links de videos (YouTube, Vimeo, etc.)
 * - Validación blockchain con tokens BEZ
 * 
 * @param {Object} user - Usuario actual
 * @param {Function} onPost - Callback al publicar
 */
const CreatePostArea = ({ user, onPost }) => {
    const [postText, setPostText] = useState('');
    const [privacy, setPrivacy] = useState('public');
    const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [location, setLocation] = useState('');
    const [showLocationInput, setShowLocationInput] = useState(false);
    const [validateBlockchain, setValidateBlockchain] = useState(false);

    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const audioInputRef = useRef(null);

    const { createPost, isPosting, isValidating, getValidationCost } = usePostCreation();

    const privacyOptions = [
        { id: 'public', label: 'Público', icon: Globe, description: 'Cualquiera puede ver' },
        { id: 'friends', label: 'Amigos', icon: Users, description: 'Solo tus amigos' },
        { id: 'private', label: 'Privado', icon: Lock, description: 'Solo tú' }
    ];

    // Tipos de archivos soportados
    const fileTypes = {
        image: {
            accept: 'image/*',
            icon: Image,
            color: 'green',
            label: 'Imagen'
        },
        video: {
            accept: 'video/*',
            icon: FileVideo,
            color: 'red',
            label: 'Video'
        },
        audio: {
            accept: 'audio/*',
            icon: Music,
            color: 'purple',
            label: 'Audio'
        },
        document: {
            accept: '.pdf,.doc,.docx,.txt,.xlsx,.xls',
            icon: FileText,
            color: 'blue',
            label: 'Documento'
        }
    };

    /**
     * Obtiene el tipo de archivo basado en su MIME type o extensión
     */
    const getFileType = (file) => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return 'pdf';
        return 'document';
    };

    /**
     * Formatea el tamaño del archivo
     */
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    /**
     * Maneja la publicación del post
     */
    const handlePost = async () => {
        if (!postText.trim() && selectedFiles.length === 0) {
            return;
        }

        const postData = {
            content: postText,
            privacy,
            files: selectedFiles,
            location: location || null,
        };

        // Usar el hook para crear el post
        const result = await createPost(postData, validateBlockchain);

        if (result) {
            // Callback al componente padre si existe
            onPost && onPost(result);

            // Reset form
            setPostText('');
            setSelectedFiles([]);
            setPrivacy('public');
            setLocation('');
            setShowLocationInput(false);
            setValidateBlockchain(false);
        }
    };

    /**
     * Maneja la selección de archivos con validación
     */
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);

        // Validar tamaño de archivos (max 50MB por archivo)
        const maxSize = 50 * 1024 * 1024; // 50MB
        const validFiles = files.filter(file => {
            if (file.size > maxSize) {
                toast.error(`${file.name} excede el tamaño máximo de 50MB`);
                return false;
            }
            return true;
        });

        // Agregar metadatos a los archivos
        const filesWithMetadata = validFiles.map(file => ({
            file,
            type: getFileType(file),
            name: file.name,
            size: file.size,
            preview: URL.createObjectURL(file)
        }));

        setSelectedFiles([...selectedFiles, ...filesWithMetadata]);
    };

    /**
     * Remueve un archivo de la lista
     */
    const removeFile = (index) => {
        // Liberar la URL del objeto
        if (selectedFiles[index]?.preview) {
            URL.revokeObjectURL(selectedFiles[index].preview);
        }
        setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    };

    const currentPrivacy = privacyOptions.find(opt => opt.id === privacy);
    const PrivacyIcon = currentPrivacy.icon;

    const isPostDisabled = (!postText.trim() && selectedFiles.length === 0) || isPosting || isValidating;

    /**
     * Renderiza la preview de un archivo según su tipo
     */
    const renderFilePreview = (fileData, index) => {
        const { type, preview, name, size } = fileData;

        const commonClasses = "relative group rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700";
        const removeButton = (
            <button
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10 shadow-lg"
            >
                <X size={16} className="text-white" />
            </button>
        );

        switch (type) {
            case 'image':
                return (
                    <div key={index} className={`${commonClasses} aspect-square`}>
                        <img
                            src={preview}
                            alt={name}
                            className="w-full h-full object-cover"
                        />
                        {removeButton}
                    </div>
                );

            case 'video':
                return (
                    <div key={index} className={`${commonClasses} aspect-video`}>
                        <video
                            src={preview}
                            className="w-full h-full object-cover"
                            controls
                        />
                        {removeButton}
                    </div>
                );

            case 'audio':
                return (
                    <div key={index} className={`${commonClasses} p-4`}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Music size={20} className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(size)}
                                </p>
                            </div>
                        </div>
                        <audio src={preview} controls className="w-full" />
                        {removeButton}
                    </div>
                );

            case 'pdf':
                return (
                    <div key={index} className={`${commonClasses} p-4`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/20 rounded-lg">
                                <FileText size={20} className="text-red-600 dark:text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    PDF • {formatFileSize(size)}
                                </p>
                            </div>
                        </div>
                        {removeButton}
                    </div>
                );

            default:
                return (
                    <div key={index} className={`${commonClasses} p-4`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <File size={20} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(size)}
                                </p>
                            </div>
                        </div>
                        {removeButton}
                    </div>
                );
        }
    };

    return (
        <div
            id="create-post-area"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-700"
        >
            {/* Header con Avatar */}
            <div className="flex gap-3 mb-4">
                <img
                    src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                    alt={user?.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/20"
                />

                {/* Textarea */}
                <div className="flex-1">
                    <textarea
                        value={postText}
                        onChange={(e) => setPostText(e.target.value)}
                        placeholder="¿Qué estás pensando?"
                        className="w-full resize-none border-none outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                        rows={3}
                    />
                </div>
            </div>

            {/* Preview de archivos seleccionados */}
            {selectedFiles.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {selectedFiles.length} archivo(s) seleccionado(s)
                        </p>
                        <button
                            onClick={() => setSelectedFiles([])}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                            Eliminar todos
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedFiles.map((fileData, index) => renderFilePreview(fileData, index))}
                    </div>
                </div>
            )}

            {/* Input de ubicación */}
            {showLocationInput && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <MapPin size={18} className="text-red-600 dark:text-red-400" />
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Añade una ubicación..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                        />
                        <button
                            onClick={() => {
                                setShowLocationInput(false);
                                setLocation('');
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                            <X size={16} className="text-gray-500" />
                        </button>
                    </div>
                </div>
            )}

            {/* Opción de validación blockchain */}
            {selectedFiles.length > 0 || postText.trim() && (
                <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={validateBlockchain}
                            onChange={(e) => setValidateBlockchain(e.target.checked)}
                            className="mt-1 w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-purple-600 dark:text-purple-400" />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Validar en Blockchain
                                </span>
                                <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                                    {getValidationCost()} BEZ
                                </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Los tokens BEZ serán quemados para registrar tu post permanentemente en la blockchain.
                                Esto garantiza autenticidad e inmutabilidad.
                            </p>
                        </div>
                    </label>
                </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-gray-700 my-4" />

            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
                {/* Left Actions */}
                <div className="flex items-center gap-1 flex-wrap">
                    {/* Image Upload */}
                    <label className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer group relative">
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Image
                            size={20}
                            className="text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform"
                        />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Imagen
                        </span>
                    </label>

                    {/* Video Upload */}
                    <label className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer group relative">
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <FileVideo
                            size={20}
                            className="text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform"
                        />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Video
                        </span>
                    </label>

                    {/* Audio Upload */}
                    <label className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer group relative">
                        <input
                            ref={audioInputRef}
                            type="file"
                            accept="audio/*"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Music
                            size={20}
                            className="text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform"
                        />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Audio
                        </span>
                    </label>

                    {/* File Upload (PDF, Docs) */}
                    <label className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer group relative">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <FileText
                            size={20}
                            className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"
                        />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Documento
                        </span>
                    </label>

                    {/* Location */}
                    <button
                        onClick={() => setShowLocationInput(!showLocationInput)}
                        className={`p-2.5 rounded-lg transition-colors group relative ${showLocationInput
                            ? 'bg-red-100 dark:bg-red-900/20'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                    >
                        <MapPin
                            size={20}
                            className="text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform"
                        />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Ubicación
                        </span>
                    </button>

                    {/* Emoji */}
                    <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group relative">
                        <Smile
                            size={20}
                            className="text-yellow-600 dark:text-yellow-400 group-hover:scale-110 transition-transform"
                        />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Emoji
                        </span>
                    </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    {/* Privacy Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            <PrivacyIcon size={16} />
                            <span className="hidden sm:inline">{currentPrivacy.label}</span>
                        </button>

                        {/* Privacy Dropdown */}
                        {showPrivacyMenu && (
                            <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-10">
                                {privacyOptions.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => {
                                                setPrivacy(option.id);
                                                setShowPrivacyMenu(false);
                                            }}
                                            className={`
                        w-full flex items-start gap-3 px-4 py-3 text-left
                        transition-colors
                        ${privacy === option.id
                                                    ? 'bg-purple-50 dark:bg-purple-900/20'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }
                        ${option.id === privacyOptions[0].id ? 'rounded-t-xl' : ''}
                        ${option.id === privacyOptions[privacyOptions.length - 1].id ? 'rounded-b-xl' : ''}
                      `}
                                        >
                                            <Icon
                                                size={18}
                                                className={privacy === option.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500'}
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-sm text-gray-900 dark:text-white">
                                                    {option.label}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {option.description}
                                                </p>
                                            </div>
                                            {privacy === option.id && (
                                                <div className="w-2 h-2 bg-purple-600 rounded-full mt-1" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Post Button */}
                    <button
                        onClick={handlePost}
                        disabled={isPostDisabled}
                        className={`
              px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
              ${!isPostDisabled
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            }
            `}
                    >
                        {isPosting || isValidating ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                {isValidating ? 'Validando...' : 'Publicando...'}
                            </>
                        ) : validateBlockchain ? (
                            <>
                                <Shield size={16} />
                                Publicar y Validar
                            </>
                        ) : (
                            'Publicar'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreatePostArea;
