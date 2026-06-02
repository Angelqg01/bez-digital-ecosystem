import React, { useState } from 'react';
import { Shield, Check, ExternalLink, Copy, CheckCircle } from 'lucide-react';

/**
 * Badge de Certificación Blockchain
 * Muestra un indicador visual para contenido validado
 */
export default function BlockchainBadge({
    validation,
    size = 'md',
    showDetails = true
}) {
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!validation || !validation.isValidated) return null;

    const sizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-6 h-6',
        lg: 'w-8 h-8'
    };

    const badgeSizes = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-3 py-1.5',
        lg: 'text-base px-4 py-2'
    };

    /**
     * Copia el hash al portapapeles
     */
    const copyHash = () => {
        navigator.clipboard.writeText(validation.contentHash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    /**
     * Formatea la fecha
     */
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    /**
     * Obtiene el explorador de blockchain según la red
     */
    const getExplorerUrl = () => {
        const network = process.env.REACT_APP_CHAIN_ID === '137' ? 'polygon' : 'amoy';
        const baseUrl = network === 'polygon'
            ? 'https://polygonscan.com'
            : 'https://www.oklink.com/amoy';

        return `${baseUrl}/tx/${validation.transactionHash}`;
    };

    return (
        <>
            {/* Badge Inline */}
            <button
                onClick={() => showDetails && setShowModal(true)}
                className={`
          inline-flex items-center gap-2 
          bg-gradient-to-r from-blue-500/20 to-purple-500/20 
          border border-blue-500/50 
          rounded-full 
          ${badgeSizes[size]}
          hover:from-blue-500/30 hover:to-purple-500/30
          transition-all duration-300
          ${showDetails ? 'cursor-pointer' : 'cursor-default'}
        `}
                title="Contenido certificado en blockchain"
            >
                <Shield className={`${sizeClasses[size]} text-blue-400`} />
                <span className="font-semibold text-blue-300">Certificado</span>
                {size !== 'sm' && (
                    <Check className={`${sizeClasses[size]} text-green-400`} />
                )}
            </button>

            {/* Modal de Detalles */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Certificación Blockchain</h3>
                                    <p className="text-sm text-gray-400">Validación inmutable on-chain</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {/* Verification Status */}
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="w-8 h-8 text-green-400" />
                                    <div>
                                        <p className="font-semibold text-green-300">Contenido Verificado</p>
                                        <p className="text-sm text-gray-400">
                                            Este contenido ha sido certificado en Polygon blockchain
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="space-y-3">
                                {/* Content Hash */}
                                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-gray-400 uppercase">Hash del Contenido</p>
                                        <button
                                            onClick={copyHash}
                                            className="text-blue-400 hover:text-blue-300 transition-colors"
                                            title="Copiar hash"
                                        >
                                            {copied ? (
                                                <CheckCircle className="w-4 h-4" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-sm text-white font-mono break-all">
                                        {validation.contentHash}
                                    </p>
                                </div>

                                {/* Validation Date */}
                                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                                        Fecha de Certificación
                                    </p>
                                    <p className="text-sm text-white">
                                        {formatDate(validation.timestamp)}
                                    </p>
                                </div>

                                {/* Validation Method */}
                                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                                        Método de Pago
                                    </p>
                                    <p className="text-sm text-white capitalize">
                                        {validation.validationMethod === 'crypto' ? 'Criptomoneda' : 'Tarjeta Bancaria'}
                                    </p>
                                </div>

                                {/* Transaction Hash (if available) */}
                                {validation.transactionHash && (
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                                            Transacción Blockchain
                                        </p>
                                        <a
                                            href={getExplorerUrl()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
                                        >
                                            Ver en PolygonScan
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Info Box */}
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                                <p className="text-xs text-blue-300">
                                    <strong>¿Qué significa esto?</strong><br />
                                    Este contenido ha sido registrado de forma permanente en la blockchain de Polygon.
                                    Nadie puede alterar, eliminar o falsificar este registro. El hash único garantiza
                                    que el contenido no ha sido modificado desde su certificación.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-700 flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors font-semibold"
                            >
                                Cerrar
                            </button>
                            {validation.transactionHash && (
                                <a
                                    href={getExplorerUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-xl transition-all duration-300 font-semibold text-center flex items-center justify-center gap-2"
                                >
                                    Ver en Blockchain
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
