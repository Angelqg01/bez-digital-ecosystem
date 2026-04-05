import React, { useState, useEffect } from 'react';
import { FaImage, FaCoins, FaChartPie, FaBolt, FaBox, FaCalendarAlt, FaCommentAlt, FaUpload, FaHistory, FaEye, FaCheckCircle, FaInfoCircle, FaWallet, FaFile, FaFileAlt, FaFilePdf, FaFileWord, FaFileContract, FaCertificate, FaMusic, FaVideo, FaPhotoVideo } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { useWeb3 } from '../context/Web3Context';
import { useNavigate } from 'react-router-dom';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';

// BezhasNFT.sol en Polygon Mainnet (se actualiza tras deploy)
const BEZHAS_NFT_ADDRESS = import.meta.env.VITE_NFT_ADDRESS || null;
const BEZHAS_NFT_ABI = [
    {
        name: 'safeMint', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'to', type: 'address' }, { name: 'uri', type: 'string' }],
        outputs: []
    }
];


const CreateNFTPage = () => {
    const { address, isConnected } = useWeb3();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('standard');
    const [previewImage, setPreviewImage] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [recentNFTs, setRecentNFTs] = useState([]);
    const [showPreview, setShowPreview] = useState(false);

    // Load recent NFTs from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('recentNFTs');
        if (stored) {
            setRecentNFTs(JSON.parse(stored));
        }
    }, []);

    // Save NFT to history
    const saveToHistory = (nftData) => {
        const newNFT = {
            ...nftData,
            timestamp: Date.now(),
            creator: address
        };
        const updated = [newNFT, ...recentNFTs].slice(0, 5);
        setRecentNFTs(updated);
        localStorage.setItem('recentNFTs', JSON.stringify(updated));
    };

    const tabs = [
        { id: 'standard', label: 'NFT Estándar', icon: FaImage, color: 'purple', description: 'NFT único ERC-721' },
        { id: 'fractional', label: 'NFT Fraccionado', icon: FaChartPie, color: 'blue', description: 'Propiedad compartida ERC-1155' },
        { id: 'lazy', label: 'Lazy Minting', icon: FaBolt, color: 'yellow', description: 'Sin gas, paga el comprador' },
        { id: 'bundle', label: 'Bundle', icon: FaBox, color: 'green', description: 'Paquete con descuento' },
        { id: 'rental', label: 'Alquiler', icon: FaCalendarAlt, color: 'indigo', description: 'Renta temporal' },
        { id: 'offer', label: 'Con Ofertas', icon: FaCommentAlt, color: 'pink', description: 'Negociación P2P' }
    ];

    const activeTabData = tabs.find(t => t.id === activeTab);

    // Handle image upload/preview
    const handleImageChange = (url) => {
        setPreviewImage(url);
        // Simulate upload progress
        if (url) {
            setUploadProgress(0);
            const interval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 10;
                });
            }, 100);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header with Stats */}
                <div className="mb-8">
                    <div className="text-center mb-6">
                        <h1 className="text-5xl font-bold text-white mb-4 flex items-center justify-center gap-4">
                            <FaImage className="text-purple-400 animate-pulse" />
                            Crear NFT Avanzado
                        </h1>
                        <p className="text-xl text-gray-300 mb-4">
                            Selecciona el tipo de NFT que deseas crear
                        </p>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-6">
                            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                                <FaImage className="text-purple-400 text-2xl mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">{recentNFTs.length}</p>
                                <p className="text-xs text-gray-400">NFTs Creados</p>
                            </div>
                            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                                <FaWallet className="text-green-400 text-2xl mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">{address ? '✓' : '✗'}</p>
                                <p className="text-xs text-gray-400">Wallet</p>
                            </div>
                            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                                <FaBolt className="text-yellow-400 text-2xl mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">6</p>
                                <p className="text-xs text-gray-400">Tipos NFT</p>
                            </div>
                            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                                <FaCheckCircle className="text-blue-400 text-2xl mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">Web3</p>
                                <p className="text-xs text-gray-400">Blockchain</p>
                            </div>
                        </div>
                    </div>

                    {/* Wallet Warning */}
                    {!address && (
                        <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 max-w-2xl mx-auto flex items-center gap-3 animate-pulse">
                            <FaWallet className="text-yellow-300 text-3xl flex-shrink-0" />
                            <div>
                                <p className="text-yellow-300 font-bold">⚠️ Wallet no conectada</p>
                                <p className="text-yellow-400 text-sm">Por favor conecta tu wallet para crear NFTs</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tabs Navigation with Tooltips */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    group relative p-6 rounded-xl transition-all duration-300 transform hover:scale-105
                                    ${isActive
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-2xl shadow-purple-500/50 scale-105'
                                        : 'bg-gray-800/50 hover:bg-gray-800/70'
                                    }
                                `}
                                title={tab.description}
                            >
                                {/* Badge for active */}
                                {isActive && (
                                    <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                                        <FaCheckCircle className="text-white text-xs" />
                                    </div>
                                )}

                                <Icon className={`text-3xl mx-auto mb-2 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : `text-${tab.color}-400`}`} />
                                <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                    {tab.label}
                                </p>

                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {tab.description}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Active Tab Info Banner */}
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
                    <FaInfoCircle className="text-purple-400 text-2xl flex-shrink-0" />
                    <div>
                        <p className="text-white font-bold">{activeTabData.label}</p>
                        <p className="text-gray-300 text-sm">{activeTabData.description}</p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-700">
                    {activeTab === 'standard' && <StandardNFTForm onImageChange={handleImageChange} onSave={saveToHistory} />}
                    {activeTab === 'fractional' && <FractionalNFTForm onImageChange={handleImageChange} onSave={saveToHistory} />}
                    {activeTab === 'lazy' && <LazyMintingForm onImageChange={handleImageChange} onSave={saveToHistory} />}
                    {activeTab === 'bundle' && <BundleNFTForm onSave={saveToHistory} />}
                    {activeTab === 'rental' && <RentalNFTForm onSave={saveToHistory} />}
                    {activeTab === 'offer' && <OfferNFTForm onSave={saveToHistory} />}
                </div>

                {/* Recent NFTs History */}
                {recentNFTs.length > 0 && (
                    <div className="mt-8 bg-gray-800/30 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                <FaHistory className="text-blue-400" />
                                NFTs Recientes
                            </h3>
                            <button
                                onClick={() => navigate('/marketplace')}
                                className="text-blue-400 hover:text-blue-300 text-sm font-bold flex items-center gap-2"
                            >
                                Ver Todos <FaEye />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {recentNFTs.map((nft, index) => (
                                <div key={index} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700 hover:border-purple-500 transition-all">
                                    <div className="aspect-square bg-gray-800 rounded-lg mb-2 overflow-hidden">
                                        {nft.image && (
                                            <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <p className="text-white font-bold text-sm truncate">{nft.name}</p>
                                    <p className="text-gray-400 text-xs">{new Date(nft.timestamp).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <InfoCard
                        icon={FaChartPie}
                        title="Fraccionalización"
                        description="Divide tu NFT en múltiples tokens ERC-1155 para permitir propiedad compartida"
                        color="blue"
                    />
                    <InfoCard
                        icon={FaBolt}
                        title="Lazy Minting"
                        description="Crea NFTs sin pagar gas. El minteo ocurre cuando alguien compra tu NFT"
                        color="yellow"
                    />
                    <InfoCard
                        icon={FaBox}
                        title="Bundles"
                        description="Agrupa múltiples NFTs en un paquete con descuento especial"
                        color="green"
                    />
                </div>

                {/* Quick Actions */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => navigate('/marketplace')}
                        className="bg-gray-800/50 hover:bg-gray-800/70 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        <FaImage /> Ver Marketplace
                    </button>
                    <button
                        onClick={() => navigate('/profile')}
                        className="bg-gray-800/50 hover:bg-gray-800/70 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        <FaWallet /> Mi Colección
                    </button>
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="bg-gray-800/50 hover:bg-gray-800/70 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        <FaEye /> {showPreview ? 'Ocultar' : 'Preview'}
                    </button>
                    <button
                        onClick={() => {
                            const tutorial = `
🎨 Tutorial de Creación de NFTs:

1. **NFT Estándar**: Para arte único y coleccionables
2. **Fraccionado**: Para compartir propiedad
3. **Lazy Minting**: Para ahorrar gas
4. **Bundle**: Para ofertas especiales
5. **Alquiler**: Para ingresos pasivos
6. **Ofertas**: Para negociación flexible
                            `;
                            toast(tutorial, { duration: 10000, icon: '📚' });
                        }}
                        className="bg-gray-800/50 hover:bg-gray-800/70 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        <FaInfoCircle /> Tutorial
                    </button>
                </div>
            </div>
        </div>
    );
};

// Standard NFT Form
const StandardNFTForm = ({ onImageChange, onSave }) => {
    const { address } = useWeb3();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        image: '',
        price: '',
        royalty: '5',
        category: 'art',
        supply: '1',
        assetType: 'image', // 'image', 'video', 'audio', or 'document'
        mediaFile: null,
        mediaType: ''
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const formDataRef = React.useRef(formData);
    React.useEffect(() => { formDataRef.current = formData; }, [formData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!minter) return toast.error('Conecta tu wallet primero');
        if (!formData.image && !formData.mediaFile) return toast.error('Sube un archivo o indica una URL de imagen');

        const tokenURI = formData.image || `ipfs://pending-${Date.now()}`;

        if (BEZHAS_NFT_ADDRESS) {
            // ── Mint on-chain real ──────────────────────────────────────────
            toast.loading('Confirmando mint en Polygon...', { id: 'mint' });
            mintNFT({
                address: BEZHAS_NFT_ADDRESS,
                abi: BEZHAS_NFT_ABI,
                functionName: 'safeMint',
                args: [minter, tokenURI],
                chainId: 137,
            });
        } else {
            // ── Fallback: guardar en backend hasta que haya contrato ────────
            toast.loading('Registrando NFT...', { id: 'mint' });
            try {
                const API = import.meta.env.VITE_API_URL || '';
                await fetch(`${API}/api/nft/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ ...formData, creator: minter, type: 'standard', tokenURI }),
                });
                toast.success('✅ NFT registrado (contrato pendiente de deploy)', { id: 'mint' });
                onSave?.({ ...formData, type: 'standard' });
                setFormData(prev => ({ ...prev, name: '', description: '', image: '', price: '' }));
            } catch (err) {
                toast.error('Error al registrar NFT', { id: 'mint' });
            }
        }
    };


    const handleImageChange = (e) => {
        const url = e.target.value;
        setFormData({ ...formData, image: url });
        if (onImageChange) onImageChange(url);
    };

    // Handle media file upload (images, videos, audio, documents)
    const handleMediaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Determine file category
        const fileType = file.type;
        let category = '';
        let maxSize = 0;
        let allowedTypes = [];

        if (fileType.startsWith('image/')) {
            category = 'image';
            maxSize = 10 * 1024 * 1024; // 10MB
            allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        } else if (fileType.startsWith('video/')) {
            category = 'video';
            maxSize = 100 * 1024 * 1024; // 100MB
            allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
        } else if (fileType.startsWith('audio/')) {
            category = 'audio';
            maxSize = 50 * 1024 * 1024; // 50MB
            allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac'];
        } else {
            category = 'document';
            maxSize = 10 * 1024 * 1024; // 10MB
            allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/plain',
                'application/json'
            ];
        }

        // Validate file type
        if (!allowedTypes.includes(fileType)) {
            toast.error(`Tipo de archivo no soportado. Use formatos válidos de ${category}`);
            return;
        }

        // Check file size
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        if (file.size > maxSize) {
            toast.error(`El archivo es demasiado grande. Máximo ${maxSize / (1024 * 1024)}MB para ${category}`);
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        // Progress simulation interval
        const interval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 90) {
                    clearInterval(interval);
                    return 90;
                }
                return prev + 10;
            });
        }, 300);

        try {
            // Create FormData for file upload
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);

            // Get auth token from localStorage (if using JWT auth)
            const token = localStorage.getItem('token');

            // Upload to backend IPFS endpoint
            const response = await fetch('http://localhost:3001/api/upload/ipfs', {
                method: 'POST',
                headers: token ? {
                    'Authorization': `Bearer ${token}`
                } : {},
                body: formDataUpload
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al subir el archivo');
            }

            const data = await response.json();

            clearInterval(interval);
            setUploadProgress(100);

            // Update form with IPFS URL
            setFormData({
                ...formData,
                mediaFile: file,
                mediaType: file.type,
                image: data.url, // ipfs:// URL
                assetType: category
            });

            // Show success message with info about mock/real upload
            const categoryEmoji = { image: '🖼️', video: '🎬', audio: '🎵', document: '📄' }[category];
            if (data.mock) {
                toast.success(`${categoryEmoji} ${category.toUpperCase()} "${file.name}" cargado (${sizeMB}MB)\n⚠️ Modo desarrollo`, {
                    duration: 5000,
                    icon: '🔧'
                });
            } else {
                toast.success(`✅ ${category.toUpperCase()} "${file.name}" subido a IPFS (${sizeMB}MB)\n🔗 Hash: ${data.ipfsHash.substring(0, 12)}...`, {
                    duration: 5000,
                    icon: categoryEmoji
                });
            }

            if (onImageChange) onImageChange(data.url);

        } catch (error) {
            clearInterval(interval);
            console.error('Error uploading media:', error);
            toast.error(`❌ Error: ${error.message}`);
            setUploadProgress(0);
        } finally {
            setUploading(false);
            setTimeout(() => setUploadProgress(0), 2000);
        }
    };

    const getMediaIcon = (type) => {
        if (!type) return <FaFile className="text-gray-400" />;
        // Video
        if (type.startsWith('video/')) return <FaVideo className="text-purple-500" />;
        // Audio
        if (type.startsWith('audio/')) return <FaMusic className="text-green-500" />;
        // Images
        if (type.startsWith('image/')) return <FaImage className="text-blue-500" />;
        // Documents
        if (type.includes('pdf')) return <FaFilePdf className="text-red-500" />;
        if (type.includes('word')) return <FaFileWord className="text-blue-600" />;
        if (type.includes('sheet') || type.includes('excel')) return <FaFileAlt className="text-green-600" />;
        return <FaFile className="text-gray-400" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const getBorderColor = (assetType) => {
        switch (assetType) {
            case 'video': return 'purple';
            case 'audio': return 'green';
            case 'document': return 'red';
            default: return 'gray';
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FaImage className="text-purple-400" />
                NFT Estándar (ERC-721)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-gray-300 font-bold mb-2">Nombre del NFT</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Mi NFT Épico"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-300 font-bold mb-2">Precio (ETH)</label>
                    <input
                        type="number"
                        step="0.001"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.1"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">Descripción</label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe tu NFT..."
                    rows="4"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none resize-none"
                    required
                />
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-3 flex items-center gap-2">
                    <FaUpload /> Tipo de Activo Multimedia
                </label>

                {/* Asset Type Selector */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, assetType: 'image', mediaFile: null, mediaType: '' })}
                        className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${formData.assetType === 'image'
                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/50'
                            : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <FaImage /> Imagen
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, assetType: 'video', image: '' })}
                        className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${formData.assetType === 'video'
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/50'
                            : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <FaVideo /> Video
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, assetType: 'audio', image: '' })}
                        className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${formData.assetType === 'audio'
                            ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-500/50'
                            : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <FaMusic /> Audio
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, assetType: 'document', image: '' })}
                        className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${formData.assetType === 'document'
                            ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/50'
                            : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <FaFileContract /> Documento
                    </button>
                </div>

                {/* Image URL Input */}
                {formData.assetType === 'image' && (
                    <div>
                        <label className="block text-gray-300 text-sm mb-2">URL de Imagen</label>
                        <input
                            type="url"
                            value={formData.image}
                            onChange={handleImageChange}
                            placeholder="https://ejemplo.com/imagen.jpg o ipfs://..."
                            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                            required
                        />
                        {formData.image && (
                            <div className="mt-3 flex items-start gap-3">
                                <img
                                    src={formData.image}
                                    alt="Preview"
                                    className="w-32 h-32 object-cover rounded-lg border border-gray-600"
                                    onError={(e) => e.target.style.display = 'none'}
                                />
                                <div className="flex-1 text-sm text-gray-400">
                                    <FaEye className="inline mr-2" />
                                    Vista previa de imagen
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/*Media Upload Input - Universal para todos los tipos */}
                {formData.assetType !== 'image' && (
                    <div>
                        <label className="block text-gray-300 text-sm mb-2">
                            {formData.assetType === 'video' && 'Subir Video (MP4, WebM, MOV - Máx 100MB)'}
                            {formData.assetType === 'audio' && 'Subir Audio (MP3, WAV, OGG, FLAC - Máx 50MB)'}
                            {formData.assetType === 'document' && 'Subir Documento (PDF, Word, Excel, TXT, JSON - Máx 10MB)'}
                        </label>
                        <div className="relative">
                            <input
                                type="file"
                                onChange={handleMediaUpload}
                                accept={
                                    formData.assetType === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov' :
                                        formData.assetType === 'audio' ? 'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/flac,.mp3,.wav,.ogg,.flac' :
                                            '.pdf,.doc,.docx,.xls,.xlsx,.txt,.json'
                                }
                                className="hidden"
                                id="media-upload"
                                disabled={uploading}
                            />
                            <label
                                htmlFor="media-upload"
                                className={`flex items-center justify-center gap-3 w-full px-4 py-8 rounded-lg border-2 border-dashed cursor-pointer transition-all ${uploading
                                    ? 'bg-gray-900/30 border-gray-700 cursor-not-allowed'
                                    : `bg-gray-900/50 border-gray-700 hover:border-${getBorderColor(formData.assetType)}-500 hover:bg-gray-900/70`
                                    }`}
                            >
                                {uploading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                                        <span className="text-gray-400">Subiendo... {uploadProgress}%</span>
                                    </>
                                ) : formData.mediaFile ? (
                                    <>
                                        {getMediaIcon(formData.mediaType)}
                                        <div className="text-left">
                                            <div className="text-white font-medium">{formData.mediaFile.name}</div>
                                            <div className="text-gray-400 text-sm">
                                                {formatFileSize(formData.mediaFile.size)}
                                            </div>
                                        </div>
                                        <FaCheckCircle className="text-green-500 ml-auto" />
                                    </>
                                ) : (
                                    <>
                                        {formData.assetType === 'video' && <FaVideo className="text-purple-400 text-2xl" />}
                                        {formData.assetType === 'audio' && <FaMusic className="text-green-400 text-2xl" />}
                                        {formData.assetType === 'document' && <FaUpload className="text-red-400 text-2xl" />}
                                        <div className="text-center">
                                            <div className="text-white">Haz clic o arrastra {formData.assetType === 'video' ? 'un video' : formData.assetType === 'audio' ? 'un audio' : 'un documento'}</div>
                                            <div className="text-gray-400 text-sm mt-1">
                                                Máximo {formData.assetType === 'video' ? '100MB' : formData.assetType === 'audio' ? '50MB' : '10MB'}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Upload Progress Bar */}
                        {uploading && uploadProgress > 0 && (
                            <div className="mt-3">
                                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ${formData.assetType === 'video' ? 'bg-gradient-to-r from-purple-600 to-pink-600' :
                                            formData.assetType === 'audio' ? 'bg-gradient-to-r from-green-600 to-emerald-600' :
                                                'bg-gradient-to-r from-red-600 to-orange-600'
                                            }`}
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Media Info */}
                        {formData.mediaFile && !uploading && (
                            <div className="mt-3 p-4 bg-gray-900/70 rounded-lg border border-gray-700">
                                <div className="flex items-start gap-3">
                                    <div className="text-3xl">
                                        {getMediaIcon(formData.mediaType)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-white font-medium mb-1">{formData.mediaFile.name}</div>
                                        <div className="text-gray-400 text-sm space-y-1">
                                            <div>� Tamaño: {formatFileSize(formData.mediaFile.size)}</div>
                                            <div>🔗 IPFS: {formData.image.substring(0, 30)}...</div>
                                            <div className="flex items-center gap-2 text-green-400">
                                                <FaCheckCircle />
                                                <span>Listo para crear NFT</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={`mt-3 p-3 rounded-lg border ${formData.assetType === 'video' ? 'bg-purple-900/20 border-purple-700/30' :
                            formData.assetType === 'audio' ? 'bg-green-900/20 border-green-700/30' :
                                'bg-blue-900/20 border-blue-700/30'
                            }`}>
                            <div className={`flex items-start gap-2 text-sm ${formData.assetType === 'video' ? 'text-purple-400' :
                                formData.assetType === 'audio' ? 'text-green-400' :
                                    'text-blue-400'
                                }`}>
                                <FaInfoCircle className="mt-0.5 flex-shrink-0" />
                                <div>
                                    {formData.assetType === 'video' && (
                                        <><strong>Videos NFT:</strong> Películas, animaciones, videoclips, contenido audiovisual único.</>
                                    )}
                                    {formData.assetType === 'audio' && (
                                        <><strong>Audio NFT:</strong> Música, podcasts, efectos de sonido, grabaciones exclusivas.</>
                                    )}
                                    {formData.assetType === 'document' && (
                                        <><strong>Documentos NFT:</strong> Contratos legales, patentes, certificados, licencias oficiales.</>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-gray-300 font-bold mb-2">Categoría</label>
                    <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                    >
                        <option value="art">Arte</option>
                        <option value="music">Música</option>
                        <option value="gaming">Gaming</option>
                        <option value="collectibles">Coleccionables</option>
                        <option value="photography">Fotografía</option>
                        <option value="sports">Deportes</option>
                    </select>
                </div>

                <div>
                    <label className="block text-gray-300 font-bold mb-2">Supply</label>
                    <input
                        type="number"
                        min="1"
                        value={formData.supply}
                        onChange={(e) => setFormData({ ...formData, supply: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                    />
                </div>
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">Royalty (%)</label>
                <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.royalty}
                    onChange={(e) => setFormData({ ...formData, royalty: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                />
                <p className="text-sm text-gray-400 mt-1">Porcentaje que recibirás en cada reventa (máx. 10%)</p>
            </div>

            {/* Advanced Options Toggle */}
            <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-purple-400 hover:text-purple-300 text-sm font-bold flex items-center gap-2"
            >
                <FaInfoCircle /> {showAdvanced ? 'Ocultar' : 'Mostrar'} Opciones Avanzadas
            </button>

            {showAdvanced && (
                <div className="space-y-4 p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                    <div>
                        <label className="flex items-center gap-2 text-gray-300">
                            <input type="checkbox" className="w-4 h-4 rounded" />
                            <span>Hacer NFT transferible inmediatamente</span>
                        </label>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-gray-300">
                            <input type="checkbox" className="w-4 h-4 rounded" />
                            <span>Permitir ofertas</span>
                        </label>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-gray-300">
                            <input type="checkbox" className="w-4 h-4 rounded" />
                            <span>Activar lazy minting (ahorra gas)</span>
                        </label>
                    </div>
                    <div>
                        <label className="block text-gray-300 font-bold mb-2">Colección (opcional)</label>
                        <input
                            type="text"
                            placeholder="Nombre de la colección"
                            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                </div>
            )}

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <FaCheckCircle className="text-green-400" /> Resumen
                </h4>
                <div className="space-y-1 text-sm">
                    <p className="text-gray-400">Nombre: <span className="text-white font-bold">{formData.name || 'N/A'}</span></p>
                    <p className="text-gray-400">Tipo: <span className="text-white font-bold flex items-center gap-2">
                        {formData.assetType === 'video' ? (
                            <>
                                <FaVideo className="text-purple-400" />
                                Video
                            </>
                        ) : formData.assetType === 'audio' ? (
                            <>
                                <FaMusic className="text-green-400" />
                                Audio
                            </>
                        ) : formData.assetType === 'document' ? (
                            <>
                                <FaFileContract className="text-red-400" />
                                Documento
                            </>
                        ) : (
                            <>
                                <FaImage className="text-blue-400" />
                                Imagen
                            </>
                        )}
                    </span></p>
                    {formData.assetType !== 'image' && formData.mediaFile && (
                        <p className="text-gray-400">Archivo: <span className="text-white font-bold">
                            {formData.mediaFile.name} ({formatFileSize(formData.mediaFile.size)})
                        </span></p>
                    )}
                    <p className="text-gray-400">Precio: <span className="text-white font-bold">{formData.price || '0'} ETH</span></p>
                    <p className="text-gray-400">Royalty: <span className="text-white font-bold">{formData.royalty}%</span></p>
                    <p className="text-gray-400">Categoría: <span className="text-white font-bold">{formData.category}</span></p>
                    <p className="text-gray-400">Supply: <span className="text-white font-bold">{formData.supply}</span></p>
                </div>
            </div>

            <button
                type="submit"
                disabled={!address || uploading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
            >
                {formData.assetType === 'video' ? <FaVideo /> :
                    formData.assetType === 'audio' ? <FaMusic /> :
                        formData.assetType === 'document' ? <FaFileContract /> :
                            <FaImage />}
                {!address ? 'Conecta tu Wallet' :
                    uploading ? 'Subiendo...' :
                        formData.assetType === 'video' ? 'Crear NFT de Video' :
                            formData.assetType === 'audio' ? 'Crear NFT de Audio' :
                                formData.assetType === 'document' ? 'Crear NFT de Documento' :
                                    'Crear NFT Estándar'}
            </button>
        </form>
    );
};

// Fractional NFT Form
const FractionalNFTForm = ({ onImageChange, onSave }) => {
    const { address } = useWeb3();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        image: '',
        totalSupply: '1000',
        pricePerFraction: '0.001'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!address) return toast.error('Conecta tu wallet primero');

        toast.loading('Creando F-NFT...', { id: 'mint' });
        setTimeout(() => {
            toast.success('¡F-NFT fraccionado creado! 🎉', { id: 'mint' });
        }, 2000);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FaChartPie className="text-blue-400" />
                NFT Fraccionado (F-NFT)
            </h3>

            <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4 mb-6">
                <p className="text-blue-300 text-sm">
                    ℹ️ Los F-NFTs permiten dividir un NFT en múltiples tokens ERC-1155, facilitando la propiedad compartida
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-gray-300 font-bold mb-2">Nombre</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Mi F-NFT"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-blue-500 focus:outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-300 font-bold mb-2">Supply Total</label>
                    <input
                        type="number"
                        value={formData.totalSupply}
                        onChange={(e) => setFormData({ ...formData, totalSupply: e.target.value })}
                        placeholder="1000"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-blue-500 focus:outline-none"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">Precio por Fracción (ETH)</label>
                <input
                    type="number"
                    step="0.0001"
                    value={formData.pricePerFraction}
                    onChange={(e) => setFormData({ ...formData, pricePerFraction: e.target.value })}
                    placeholder="0.001"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-blue-500 focus:outline-none"
                    required
                />
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">URL de Imagen</label>
                <input
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-blue-500 focus:outline-none"
                    required
                />
            </div>

            <div className="bg-gray-900/50 rounded-lg p-4">
                <h4 className="font-bold text-white mb-2">Resumen</h4>
                <div className="space-y-1 text-sm">
                    <p className="text-gray-400">Total Supply: <span className="text-white font-bold">{formData.totalSupply} fracciones</span></p>
                    <p className="text-gray-400">Precio por fracción: <span className="text-white font-bold">{formData.pricePerFraction} ETH</span></p>
                    <p className="text-gray-400">Valor total: <span className="text-white font-bold">{(parseFloat(formData.totalSupply) * parseFloat(formData.pricePerFraction || 0)).toFixed(4)} ETH</span></p>
                </div>
            </div>

            <button
                type="submit"
                disabled={!address}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
                <FaChartPie />
                Fraccionar NFT
            </button>
        </form>
    );
};

// Lazy Minting Form
const LazyMintingForm = () => {
    const { address } = useWeb3();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        image: '',
        price: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!address) return toast.error('Conecta tu wallet primero');

        toast.loading('Creando voucher...', { id: 'mint' });
        setTimeout(() => {
            toast.success('¡Voucher creado sin gas! ⚡', { id: 'mint' });
        }, 2000);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FaBolt className="text-yellow-400" />
                Lazy Minting (Sin Gas)
            </h3>

            <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 mb-6">
                <p className="text-yellow-300 text-sm">
                    ⚡ ¡Sin costos de gas! El NFT se mintea solo cuando alguien lo compra
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-gray-300 font-bold mb-2">Nombre</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Mi Lazy NFT"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-yellow-500 focus:outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-300 font-bold mb-2">Precio (ETH)</label>
                    <input
                        type="number"
                        step="0.001"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.1"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-yellow-500 focus:outline-none"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">Descripción</label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe tu NFT..."
                    rows="3"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-yellow-500 focus:outline-none resize-none"
                    required
                />
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">URL de Imagen</label>
                <input
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-yellow-500 focus:outline-none"
                    required
                />
            </div>

            <button
                type="submit"
                disabled={!address}
                className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
                <FaBolt />
                Crear Voucher (0 Gas)
            </button>
        </form>
    );
};

// Bundle NFT Form
const BundleNFTForm = () => {
    const { address } = useWeb3();
    const [nfts, setNfts] = useState(['']);

    const addNFT = () => setNfts([...nfts, '']);
    const removeNFT = (index) => setNfts(nfts.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!address) return toast.error('Conecta tu wallet primero');

        toast.loading('Creando bundle...', { id: 'mint' });
        setTimeout(() => {
            toast.success('¡Bundle creado! 📦', { id: 'mint' });
        }, 2000);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FaBox className="text-green-400" />
                Bundle de NFTs
            </h3>

            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-6">
                <p className="text-green-300 text-sm">
                    📦 Agrupa múltiples NFTs y véndelos con descuento
                </p>
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">NFTs en el Bundle</label>
                {nfts.map((nft, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={nft}
                            onChange={(e) => {
                                const newNfts = [...nfts];
                                newNfts[index] = e.target.value;
                                setNfts(newNfts);
                            }}
                            placeholder="Token ID del NFT"
                            className="flex-1 px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-green-500 focus:outline-none"
                        />
                        {nfts.length > 1 && (
                            <button
                                type="button"
                                onClick={() => removeNFT(index)}
                                className="px-4 bg-red-600 hover:bg-red-700 rounded-lg text-white"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addNFT}
                    className="mt-2 text-green-400 hover:text-green-300 text-sm font-bold"
                >
                    + Agregar NFT
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-gray-300 font-bold mb-2">Precio Bundle (ETH)</label>
                    <input
                        type="number"
                        step="0.001"
                        placeholder="0.5"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-green-500 focus:outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-300 font-bold mb-2">Descuento (%)</label>
                    <input
                        type="number"
                        min="0"
                        max="90"
                        placeholder="20"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-green-500 focus:outline-none"
                        required
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={!address}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
                <FaBox />
                Crear Bundle
            </button>
        </form>
    );
};

// Rental NFT Form
const RentalNFTForm = () => {
    const { address } = useWeb3();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!address) return toast.error('Conecta tu wallet primero');

        toast.loading('Listando NFT para alquiler...', { id: 'mint' });
        setTimeout(() => {
            toast.success('¡NFT disponible para alquiler! 📅', { id: 'mint' });
        }, 2000);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FaCalendarAlt className="text-indigo-400" />
                NFT para Alquiler
            </h3>

            <div className="bg-indigo-500/20 border border-indigo-500 rounded-lg p-4 mb-6">
                <p className="text-indigo-300 text-sm">
                    📅 Permite a otros usuarios alquilar tu NFT por un período de tiempo
                </p>
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">Token ID del NFT</label>
                <input
                    type="text"
                    placeholder="123"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-indigo-500 focus:outline-none"
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-gray-300 font-bold mb-2">Precio/Día (ETH)</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder="0.01"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-indigo-500 focus:outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-300 font-bold mb-2">Mín. Días</label>
                    <input
                        type="number"
                        min="1"
                        placeholder="1"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-indigo-500 focus:outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-300 font-bold mb-2">Máx. Días</label>
                    <input
                        type="number"
                        min="1"
                        placeholder="30"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-indigo-500 focus:outline-none"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">Depósito de Garantía (ETH)</label>
                <input
                    type="number"
                    step="0.001"
                    placeholder="0.1"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-indigo-500 focus:outline-none"
                    required
                />
            </div>

            <button
                type="submit"
                disabled={!address}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
                <FaCalendarAlt />
                Listar para Alquiler
            </button>
        </form>
    );
};

// Offer NFT Form
const OfferNFTForm = () => {
    const { address } = useWeb3();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!address) return toast.error('Conecta tu wallet primero');

        toast.loading('Habilitando ofertas...', { id: 'mint' });
        setTimeout(() => {
            toast.success('¡NFT con ofertas habilitado! 💬', { id: 'mint' });
        }, 2000);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FaCommentAlt className="text-pink-400" />
                NFT con Sistema de Ofertas
            </h3>

            <div className="bg-pink-500/20 border border-pink-500 rounded-lg p-4 mb-6">
                <p className="text-pink-300 text-sm">
                    💬 Permite que los usuarios hagan ofertas y negocia el precio
                </p>
            </div>

            <div>
                <label className="block text-gray-300 font-bold mb-2">Token ID del NFT</label>
                <input
                    type="text"
                    placeholder="123"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-pink-500 focus:outline-none"
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-gray-300 font-bold mb-2">Precio Inicial (ETH)</label>
                    <input
                        type="number"
                        step="0.001"
                        placeholder="1.0"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-pink-500 focus:outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-300 font-bold mb-2">Precio Mínimo (ETH)</label>
                    <input
                        type="number"
                        step="0.001"
                        placeholder="0.8"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-pink-500 focus:outline-none"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="flex items-center gap-2 text-gray-300">
                    <input type="checkbox" className="w-5 h-5 rounded" />
                    <span>Permitir contra-ofertas automáticas</span>
                </label>
            </div>

            <div>
                <label className="flex items-center gap-2 text-gray-300">
                    <input type="checkbox" className="w-5 h-5 rounded" />
                    <span>Notificarme de nuevas ofertas</span>
                </label>
            </div>

            <button
                type="submit"
                disabled={!address}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
                <FaCommentAlt />
                Habilitar Ofertas
            </button>
        </form>
    );
};

// Info Card Component
const InfoCard = ({ icon: Icon, title, description, color }) => {
    return (
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all">
            <Icon className={`text-4xl text-${color}-400 mb-3`} />
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    );
};

export default CreateNFTPage;
