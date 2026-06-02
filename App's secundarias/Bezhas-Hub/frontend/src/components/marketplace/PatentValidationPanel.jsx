import React, { useState } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import {
    FaShieldAlt,
    FaCertificate,
    FaFileContract,
    FaCheckCircle,
    FaLock,
    FaSearch,
    FaDownload,
    FaUpload,
    FaCopy,
    FaExternalLinkAlt
} from 'react-icons/fa';
import { Spinner } from '../ui/Spinner';
import { useWeb3 } from '../../context/Web3Context';
import { useBezCoin } from '../../context/BezCoinContext';

/**
 * Sistema de Validación de Contratos, Patentes y Productos
 * - Certificación blockchain de documentos legales
 * - Registro de patentes y propiedad intelectual
 * - Validación de autenticidad de productos
 * - Timestamp inmutable en blockchain
 */
export default function PatentValidationPanel() {
    const { address, signer } = useWeb3();
    const { balance, verifyAndProceed } = useBezCoin();

    const [activeTab, setActiveTab] = useState('register'); // register, verify, my-certificates
    const [isLoading, setIsLoading] = useState(false);

    // Form states
    const [documentType, setDocumentType] = useState('patent');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fileHash, setFileHash] = useState('');
    const [metadata, setMetadata] = useState('');

    // Verification
    const [searchHash, setSearchHash] = useState('');
    const [verificationResult, setVerificationResult] = useState(null);

    // Mock certificates
    const [certificates, setCertificates] = useState([
        {
            id: 1,
            type: 'patent',
            title: 'Sistema de IA para Análisis de Sentimientos',
            description: 'Algoritmo propietario de machine learning',
            hash: '0x1234567890abcdef...',
            owner: address || '0xYourAddress...',
            validatedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
            validationCost: '10',
            status: 'validated',
            ipfsUrl: 'ipfs://QmXyz123...'
        },
        {
            id: 2,
            type: 'contract',
            title: 'Acuerdo de Licencia de Software',
            description: 'Contrato de licencia exclusiva de uso',
            hash: '0xabcdef1234567890...',
            owner: address || '0xYourAddress...',
            validatedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
            validationCost: '5',
            status: 'validated',
            ipfsUrl: 'ipfs://QmAbc456...'
        }
    ]);

    const documentTypes = [
        { value: 'patent', label: 'Patente', icon: FaCertificate, color: 'purple' },
        { value: 'contract', label: 'Contrato Legal', icon: FaFileContract, color: 'blue' },
        { value: 'product', label: 'Producto/Marca', icon: FaShieldAlt, color: 'green' },
        { value: 'intellectual', label: 'Propiedad Intelectual', icon: FaLock, color: 'orange' }
    ];

    const calculateFileHash = async (file) => {
        // Simulación de hash SHA-256
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            // En producción, usar crypto.subtle.digest('SHA-256', ...)
            const mockHash = '0x' + btoa(content).substring(0, 40).replace(/[^a-f0-9]/gi, '0');
            setFileHash(mockHash);
            toast.success('Hash calculado correctamente');
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        toast.loading('Calculando hash del archivo...', { id: 'hash' });
        await calculateFileHash(file);
        toast.success('Archivo procesado', { id: 'hash' });
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (!address) {
            toast.error('Conecta tu wallet para registrar documentos');
            return;
        }

        if (!title || !fileHash) {
            toast.error('Completa todos los campos requeridos');
            return;
        }

        const validationCost = documentType === 'patent' ? '15' : '10';

        await verifyAndProceed(
            validationCost,
            `Registrar ${documentTypes.find(t => t.value === documentType)?.label}`,
            async () => {
                setIsLoading(true);
                try {
                    // TODO: Integrar con ContentValidator.sol
                    // const contentHash = ethers.keccak256(ethers.toUtf8Bytes(fileHash));
                    // const tx = await contentValidatorContract.validateWithBezCoin(
                    //     contentHash,
                    //     `ipfs://${fileHash}`,
                    //     documentType
                    // );
                    // await tx.wait();

                    // Simular registro
                    const newCert = {
                        id: certificates.length + 1,
                        type: documentType,
                        title,
                        description,
                        hash: fileHash,
                        owner: address,
                        validatedAt: new Date().toISOString(),
                        validationCost,
                        status: 'validated',
                        ipfsUrl: `ipfs://${fileHash}`
                    };

                    setCertificates([newCert, ...certificates]);
                    toast.success('¡Documento registrado exitosamente en blockchain! 🎉', { duration: 5000 });

                    // Reset form
                    setTitle('');
                    setDescription('');
                    setFileHash('');
                    setMetadata('');
                    setActiveTab('my-certificates');
                } catch (error) {
                    console.error('Error registering document:', error);
                    toast.error('Error al registrar el documento');
                } finally {
                    setIsLoading(false);
                }
            }
        );
    };

    const handleVerify = async () => {
        if (!searchHash) {
            toast.error('Ingresa un hash para verificar');
            return;
        }

        setIsLoading(true);
        toast.loading('Verificando en blockchain...', { id: 'verify' });

        // Simular búsqueda
        setTimeout(() => {
            const found = certificates.find(c => c.hash.toLowerCase() === searchHash.toLowerCase());

            if (found) {
                setVerificationResult({
                    found: true,
                    certificate: found
                });
                toast.success('¡Documento verificado! Autenticidad confirmada', { id: 'verify' });
            } else {
                setVerificationResult({
                    found: false
                });
                toast.error('Documento no encontrado en blockchain', { id: 'verify' });
            }
            setIsLoading(false);
        }, 1500);
    };

    const CertificateCard = ({ cert }) => {
        const typeInfo = documentTypes.find(t => t.value === cert.type);
        const Icon = typeInfo?.icon || FaCertificate;

        return (
            <div className={`bg-gradient-to-br from-${typeInfo?.color}-50 to-${typeInfo?.color}-100 dark:from-${typeInfo?.color}-900/20 dark:to-${typeInfo?.color}-800/20 rounded-xl p-6 border-2 border-${typeInfo?.color}-200 dark:border-${typeInfo?.color}-700 hover:shadow-xl transition-all`}>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 bg-${typeInfo?.color}-600 text-white rounded-lg`}>
                            <Icon size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                                {cert.title}
                            </h4>
                            <span className={`text-xs font-semibold px-2 py-1 bg-${typeInfo?.color}-200 dark:bg-${typeInfo?.color}-800 text-${typeInfo?.color}-800 dark:text-${typeInfo?.color}-200 rounded-full`}>
                                {typeInfo?.label}
                            </span>
                        </div>
                    </div>
                    <FaCheckCircle className="text-green-500" size={24} />
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 line-clamp-2">
                    {cert.description}
                </p>

                <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Hash:</span>
                        <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                            {cert.hash.substring(0, 20)}...
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(cert.hash);
                                toast.success('Hash copiado');
                            }}
                            className="text-blue-600 hover:text-blue-700"
                        >
                            <FaCopy />
                        </button>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                        Registrado: {new Date(cert.validatedAt).toLocaleDateString()}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                        <FaDownload />
                        Certificado
                    </button>
                    <button className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                        <FaExternalLinkAlt />
                    </button>
                </div>
            </div>
        );
    };

    const tabs = [
        { id: 'register', label: 'Registrar', icon: FaUpload },
        { id: 'verify', label: 'Verificar', icon: FaSearch },
        { id: 'my-certificates', label: 'Mis Certificados', icon: FaCertificate, count: certificates.length }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <FaShieldAlt size={32} />
                            Validación de Contratos y Patentes
                        </h2>
                        <p className="text-blue-100">
                            Certifica documentos legales, patentes y productos en blockchain
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
                            <div className="text-sm text-blue-100">Certificados</div>
                            <div className="text-3xl font-bold">{certificates.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                    <FaLock className="text-blue-600 text-2xl mt-1" />
                    <div>
                        <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-1">
                            Certificación Inmutable
                        </h4>
                        <p className="text-sm text-blue-800 dark:text-blue-400">
                            Los documentos registrados obtienen un timestamp inmutable en blockchain.
                            Perfecto para proteger propiedad intelectual, contratos legales y autenticidad de productos.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${activeTab === tab.id
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                    }`}
                            >
                                <Icon />
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            {activeTab === 'register' && (
                <form onSubmit={handleRegister} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                    <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                        Registrar Documento
                    </h3>

                    {/* Document Type */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                            Tipo de Documento
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {documentTypes.map((type) => {
                                const Icon = type.icon;
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setDocumentType(type.value)}
                                        className={`p-4 rounded-lg border-2 transition-all ${documentType === type.value
                                                ? `border-${type.color}-600 bg-${type.color}-50 dark:bg-${type.color}-900/20`
                                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                            }`}
                                    >
                                        <Icon className={`mx-auto mb-2 ${documentType === type.value ? `text-${type.color}-600` : 'text-gray-500'}`} size={24} />
                                        <div className="text-xs font-semibold text-center">
                                            {type.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                            Título del Documento *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej: Sistema de IA para Análisis de Sentimientos"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                            Descripción
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe los detalles del documento..."
                            rows="4"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    {/* File Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                            Documento (PDF, DOCX, etc.) *
                        </label>
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            accept=".pdf,.doc,.docx,.txt"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-semibold hover:file:bg-blue-700"
                        />
                        {fileHash && (
                            <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="flex items-center gap-2 text-sm">
                                    <FaCheckCircle className="text-green-600" />
                                    <span className="text-gray-700 dark:text-gray-300">Hash:</span>
                                    <code className="text-xs font-mono">{fileHash}</code>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            Costo: <strong>{documentType === 'patent' ? '15' : '10'} BEZ</strong>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !fileHash}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-lg disabled:opacity-50 transition-all shadow-lg"
                        >
                            {isLoading ? (
                                <>
                                    <Spinner size="sm" />
                                    Registrando...
                                </>
                            ) : (
                                <>
                                    <FaCertificate />
                                    Registrar en Blockchain
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}

            {activeTab === 'verify' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                    <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                        Verificar Autenticidad
                    </h3>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                            Hash del Documento
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={searchHash}
                                onChange={(e) => setSearchHash(e.target.value)}
                                placeholder="0x1234567890abcdef..."
                                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                            />
                            <button
                                onClick={handleVerify}
                                disabled={isLoading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg disabled:opacity-50 transition-all"
                            >
                                {isLoading ? <Spinner size="sm" /> : <FaSearch />}
                                Verificar
                            </button>
                        </div>
                    </div>

                    {/* Verification Result */}
                    {verificationResult && (
                        <div className={`p-6 rounded-xl border-2 ${verificationResult.found
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                            }`}>
                            {verificationResult.found ? (
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <FaCheckCircle className="text-green-600 text-3xl" />
                                        <h4 className="text-xl font-bold text-green-900 dark:text-green-300">
                                            Documento Verificado ✓
                                        </h4>
                                    </div>
                                    <CertificateCard cert={verificationResult.certificate} />
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="text-red-600 text-3xl">⚠️</div>
                                    <div>
                                        <h4 className="text-xl font-bold text-red-900 dark:text-red-300 mb-1">
                                            Documento No Encontrado
                                        </h4>
                                        <p className="text-sm text-red-800 dark:text-red-400">
                                            Este hash no está registrado en la blockchain. El documento puede no ser auténtico.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'my-certificates' && (
                <div>
                    {certificates.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
                            <FaCertificate className="mx-auto text-gray-400 text-6xl mb-4" />
                            <p className="text-gray-500 text-xl mb-2">No tienes certificados</p>
                            <p className="text-gray-400 mb-6">Registra tu primer documento para empezar</p>
                            <button
                                onClick={() => setActiveTab('register')}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg"
                            >
                                Registrar Documento
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {certificates.map((cert) => (
                                <CertificateCard key={cert.id} cert={cert} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
