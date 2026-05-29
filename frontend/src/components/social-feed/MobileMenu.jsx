import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import {
    Home,
    PlusSquare,
    Bell,
    User,
    MessageSquare,
    UsersRound,
    ShoppingCart,
    Coins,
    Crown,
    Menu,
    X,
    Megaphone,
    Image,
    Video,
    Music,
    FileText,
    MapPin,
    Globe,
    Lock,
    Users,
    Shield,
    Loader2,
    Smile,
    Activity
} from 'lucide-react';
import { usePostCreation } from '../../hooks/usePostCreation';

/**
 * MobileMenu Component
 * Menú de navegación completo fijo para móvil con drawer expandible
 * Incluye modal completo de crear post con todas las funcionalidades
 */
const MobileMenu = ({ notificationsCount = 0 }) => {
    const navigate = useNavigate();
    const routeLocation = useLocation();
    const { address } = useAccount();
    const [showDrawer, setShowDrawer] = useState(false);
    const [showCreatePostModal, setShowCreatePostModal] = useState(false);

    // Estados del post
    const [postText, setPostText] = useState('');
    const [privacy, setPrivacy] = useState('public');
    const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [postLocation, setPostLocation] = useState('');
    const [showLocationInput, setShowLocationInput] = useState(false);
    const [validateBlockchain, setValidateBlockchain] = useState(false);

    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const audioInputRef = useRef(null);

    const { createPost, isPosting } = usePostCreation();

    // Usuario actual
    const currentUser = {
        username: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Usuario',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${address || 'default'}`,
        verified: true
    };

    // Items principales del menú fijo - Nuevo diseño solicitado
    const mainMenuItems = [
        {
            path: '/profile',
            icon: User,
            label: 'Perfil'
        },
        {
            path: '/marketplace',
            icon: ShoppingCart,
            label: 'Market'
        },
        {
            id: 'create',
            path: '/create',
            icon: PlusSquare,
            label: 'Crear',
            special: true // Botón especial en el centro
        },
        {
            path: '/staking',
            icon: Coins,
            label: 'Staking'
        },
        {
            path: '/be-vip',
            icon: Crown,
            label: 'VIP'
        }
    ];

    // Botón de menú hamburguesa separado
    const menuButton = {
        id: 'menu',
        icon: Menu,
        label: 'Menú',
        action: () => setShowDrawer(true)
    };

    // Items del drawer expandible (todas las funcionalidades del sidebar)
    const drawerSections = [
        {
            title: 'Principal',
            items: [
                { path: '/', icon: Home, label: 'Inicio' },
                { path: '/home', icon: Home, label: 'Feed Principal' },
                { path: '/chat', icon: MessageSquare, label: 'Chat IA', badge: 'IA' },
                { path: '/notifications', icon: Bell, label: 'Notificaciones', badge: notificationsCount > 0 ? notificationsCount : null }
            ]
        },
        {
            title: 'Perfil & Cuenta',
            items: [
                { path: '/profile', icon: User, label: 'Mi Perfil' },
                { path: '/settings', icon: Shield, label: 'Configuración' }
            ]
        },
        {
            title: 'Finanzas & Trading',
            items: [
                { path: '/be-vip', icon: Crown, label: 'Be-VIP', badge: 'PRO' },
                { path: '/staking', icon: Coins, label: 'DeFi Hub' },
                { path: '/marketplace', icon: ShoppingCart, label: 'NFT Marketplace' },
                { path: '/dao', icon: UsersRound, label: 'DAO Governance' }
            ]
        },
        {
            title: 'Comunidad & Más',
            items: [
                { path: '/ad-center', icon: Megaphone, label: 'Centro de Anuncios' },
                { path: '/create', icon: PlusSquare, label: 'Crear Contenido' }
            ]
        },
        {
            title: 'Plataforma BeZhas',
            items: [
                { path: '/logistics', icon: MapPin, label: 'Logística (Demo)' },
                { path: '/real-estate', icon: Globe, label: 'Bienes Raíces' },
                { path: '/oracle', icon: Activity, label: 'Oráculo de Datos' },
                { path: '/buy-tokens', icon: Coins, label: 'Comprar Tokens' },
                { path: '/developer-console', icon: FileText, label: 'Consola de Desarrollo' }
            ]
        }
    ];

    // Opciones de privacidad
    const privacyOptions = [
        { id: 'public', label: 'Público', icon: Globe, description: 'Cualquiera puede ver' },
        { id: 'friends', label: 'Amigos', icon: Users, description: 'Solo tus amigos' },
        { id: 'private', label: 'Privado', icon: Lock, description: 'Solo tú' }
    ];

    const handleNavigation = (path) => {
        if (path) {
            navigate(path);
            setShowDrawer(false);
        }
    };

    const handleCreatePost = () => {
        // Primero intentar scroll al área si estamos en home
        const createArea = document.getElementById('create-post-area');
        if (createArea && routeLocation.pathname === '/') {
            createArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const textarea = createArea.querySelector('textarea');
            if (textarea) textarea.focus();
        } else {
            // Si no hay área o no estamos en home, abrir modal
            setShowCreatePostModal(true);
        }
        setShowDrawer(false);
    };

    // Manejo de archivos
    const getFileType = (file) => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        if (file.type === 'application/pdf') return 'pdf';
        return 'document';
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        const maxSize = 50 * 1024 * 1024; // 50MB

        const validFiles = files.filter(file => {
            if (file.size > maxSize) {
                toast.error(`${file.name} excede 50MB`);
                return false;
            }
            return true;
        });

        const filesWithMetadata = validFiles.map(file => ({
            file,
            type: getFileType(file),
            name: file.name,
            size: file.size,
            preview: URL.createObjectURL(file)
        }));

        setSelectedFiles([...selectedFiles, ...filesWithMetadata]);
    };

    const removeFile = (index) => {
        if (selectedFiles[index]?.preview) {
            URL.revokeObjectURL(selectedFiles[index].preview);
        }
        setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    };

    const handlePost = async () => {
        if (!postText.trim() && selectedFiles.length === 0) {
            toast.error('Escribe algo o agrega archivos');
            return;
        }

        const postData = {
            content: postText,
            privacy,
            files: selectedFiles,
            location: postLocation || null,
        };

        const result = await createPost(postData, validateBlockchain);

        if (result) {
            toast.success('¡Post publicado!');
            // Reset
            setPostText('');
            setSelectedFiles([]);
            setPrivacy('public');
            setPostLocation('');
            setShowLocationInput(false);
            setValidateBlockchain(false);
            setShowCreatePostModal(false);

            // Navegar a home si no estamos ahí
            if (routeLocation.pathname !== '/') {
                navigate('/');
            }
        }
    };

    const closeModal = () => {
        setShowCreatePostModal(false);
        setPostText('');
        setSelectedFiles([]);
        setPrivacy('public');
        setPostLocation('');
        setShowLocationInput(false);
        setValidateBlockchain(false);
    };

    const isActivePath = (path) => {
        return routeLocation.pathname === path;
    };

    return (
        <>
            {/* Espaciador para evitar que el contenido quede detrás del menú */}
            <div className="h-16 md:hidden" />

            {/* Fixed Bottom Menu - Nuevo diseño con 5 botones + hamburguesa */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
                <div className="flex items-center justify-between h-16 px-1">
                    {/* Botón hamburguesa a la izquierda */}
                    <button
                        onClick={menuButton.action}
                        className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                        aria-label="Menú"
                    >
                        <Menu size={22} strokeWidth={2} />
                        <span className="text-[10px] font-medium">Menú</span>
                    </button>

                    {/* Items principales */}
                    {mainMenuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.path && isActivePath(item.path);

                        if (item.special) {
                            // Botón especial de crear (más grande, en el centro)
                            return (
                                <button
                                    key={item.id}
                                    onClick={handleCreatePost}
                                    className="relative -mt-6 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-2xl"
                                    aria-label={item.label}
                                >
                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg shadow-purple-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
                                        <Icon size={24} className="text-white" />
                                    </div>
                                </button>
                            );
                        }

                        return (
                            <button
                                key={item.path || item.id}
                                onClick={() => handleNavigation(item.path)}
                                className={`
                                    relative flex flex-col items-center gap-1 px-2 py-2 rounded-lg
                                    transition-all duration-200
                                    ${isActive
                                        ? 'text-purple-600 dark:text-purple-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400'
                                    }
                                `}
                                aria-label={item.label}
                            >
                                <div className="relative">
                                    <Icon
                                        size={20}
                                        className={isActive ? 'scale-110' : ''}
                                        strokeWidth={isActive ? 2.5 : 2}
                                    />
                                </div>
                                <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-purple-600 dark:bg-purple-400 rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Drawer Expandible */}
            {showDrawer && (
                <>
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] md:hidden animate-fadeIn"
                        onClick={() => setShowDrawer(false)}
                    />

                    {/* Drawer Panel */}
                    <div className="fixed bottom-16 left-0 right-0 max-h-[70vh] bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl z-[70] md:hidden animate-slideUp overflow-hidden">
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Menú</h3>
                                <p className="text-xs text-purple-100">Todas las funciones de BeZhas</p>
                            </div>
                            <button
                                onClick={() => setShowDrawer(false)}
                                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                                aria-label="Cerrar menú"
                            >
                                <X size={20} className="text-white" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto max-h-[calc(70vh-80px)] px-4 py-4">
                            {drawerSections.map((section, idx) => (
                                <div key={idx} className="mb-6">
                                    {/* Section Title */}
                                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-2">
                                        {section.title}
                                    </h4>

                                    {/* Section Items */}
                                    <div className="space-y-1">
                                        {section.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = isActivePath(item.path);

                                            return (
                                                <button
                                                    key={item.path}
                                                    onClick={() => handleNavigation(item.path)}
                                                    className={`
                                                        w-full flex items-center gap-3 px-4 py-3 rounded-xl
                                                        transition-all duration-200
                                                        ${isActive
                                                            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                        }
                                                    `}
                                                >
                                                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                                    <span className={`flex-1 text-left text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                                        {item.label}
                                                    </span>
                                                    {item.badge && (
                                                        <span className="px-2 py-0.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold rounded-full">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Footer Info */}
                            <div className="mt-6 mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                                    🚀 <span className="font-semibold text-purple-600 dark:text-purple-400">BeZhas</span> - Plataforma Web3 Social
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modal de Crear Post */}
            {showCreatePostModal && (
                <>
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] animate-fadeIn"
                        onClick={closeModal}
                    />

                    {/* Modal Panel */}
                    <div className="fixed inset-x-4 top-20 bottom-20 max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-[90] animate-slideUp overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-pink-600">
                            <h3 className="text-lg font-bold text-white">Crear Publicación</h3>
                            <button
                                onClick={closeModal}
                                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                            >
                                <X size={20} className="text-white" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* User Info */}
                            <div className="flex items-center gap-3 mb-4">
                                <img
                                    src={currentUser.avatar}
                                    alt={currentUser.username}
                                    className="w-10 h-10 rounded-full ring-2 ring-purple-500/20"
                                />
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900 dark:text-white">{currentUser.username}</p>
                                    <button
                                        onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                                        className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                                    >
                                        {React.createElement(privacyOptions.find(opt => opt.id === privacy).icon, { size: 12 })}
                                        <span>{privacyOptions.find(opt => opt.id === privacy).label}</span>
                                    </button>

                                    {/* Privacy Menu Dropdown */}
                                    {showPrivacyMenu && (
                                        <div className="absolute mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-2 z-10">
                                            {privacyOptions.map(option => (
                                                <button
                                                    key={option.id}
                                                    onClick={() => {
                                                        setPrivacy(option.id);
                                                        setShowPrivacyMenu(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-left"
                                                >
                                                    {React.createElement(option.icon, { size: 16 })}
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Textarea */}
                            <textarea
                                value={postText}
                                onChange={(e) => setPostText(e.target.value)}
                                placeholder="¿Qué estás pensando?"
                                className="w-full min-h-[120px] p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white placeholder-gray-500"
                            />

                            {/* Location Input */}
                            {showLocationInput && (
                                <div className="mt-3 flex items-center gap-2">
                                    <MapPin size={18} className="text-purple-600" />
                                    <input
                                        type="text"
                                        value={postLocation}
                                        onChange={(e) => setPostLocation(e.target.value)}
                                        placeholder="Agregar ubicación..."
                                        className="flex-1 p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                    />
                                    <button
                                        onClick={() => {
                                            setShowLocationInput(false);
                                            setPostLocation('');
                                        }}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}

                            {/* Files Preview */}
                            {selectedFiles.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    {selectedFiles.map((fileData, index) => (
                                        <div key={index} className="relative group rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                                            {fileData.type === 'image' ? (
                                                <img src={fileData.preview} alt={fileData.name} className="w-full h-32 object-cover" />
                                            ) : (
                                                <div className="w-full h-32 flex flex-col items-center justify-center p-2">
                                                    {fileData.type === 'video' ? <Video size={32} /> :
                                                        fileData.type === 'audio' ? <Music size={32} /> : <FileText size={32} />}
                                                    <p className="text-xs mt-2 truncate w-full text-center">{fileData.name}</p>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removeFile(index)}
                                                className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <X size={14} className="text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Blockchain Validation */}
                            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={validateBlockchain}
                                        onChange={(e) => setValidateBlockchain(e.target.checked)}
                                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                    />
                                    <Shield size={16} className="text-purple-600 dark:text-purple-400" />
                                    <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                        Validar en Blockchain
                                    </span>
                                </label>
                                {validateBlockchain && (
                                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1 ml-6">
                                        Costo: 10 BEZ tokens (autenticidad verificable)
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mb-3">
                                {/* Hidden file inputs */}
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <input
                                    ref={videoInputRef}
                                    type="file"
                                    accept="video/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <input
                                    ref={audioInputRef}
                                    type="file"
                                    accept="audio/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.txt"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                <button
                                    onClick={() => imageInputRef.current?.click()}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Imagen"
                                >
                                    <Image size={20} className="text-green-600" />
                                </button>
                                <button
                                    onClick={() => videoInputRef.current?.click()}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Video"
                                >
                                    <Video size={20} className="text-red-600" />
                                </button>
                                <button
                                    onClick={() => audioInputRef.current?.click()}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Audio"
                                >
                                    <Music size={20} className="text-purple-600" />
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Documento"
                                >
                                    <FileText size={20} className="text-blue-600" />
                                </button>
                                <button
                                    onClick={() => setShowLocationInput(!showLocationInput)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Ubicación"
                                >
                                    <MapPin size={20} className="text-orange-600" />
                                </button>
                                <button
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors ml-auto"
                                    title="Emoji"
                                >
                                    <Smile size={20} className="text-yellow-600" />
                                </button>
                            </div>

                            {/* Post Button */}
                            <button
                                onClick={handlePost}
                                disabled={(!postText.trim() && selectedFiles.length === 0) || isPosting}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isPosting ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Publicando...
                                    </>
                                ) : (
                                    'Publicar'
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Animaciones CSS */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>
        </>
    );
};

export default MobileMenu;
