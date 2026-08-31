/**
 * SecuritySettings Component
 * 
 * Complete security configuration panel including:
 * - Two-Factor Authentication (TOTP)
 * - Passkeys / WebAuthn
 * - Session management
 * - Security activity log
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    Smartphone,
    Key,
    Fingerprint,
    QrCode,
    Copy,
    Eye,
    EyeOff,
    Trash2,
    Edit2,
    Plus,
    Check,
    X,
    AlertTriangle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Lock,
    Unlock,
    CheckCircle2,
    XCircle,
    Info,
    Settings2,
} from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import securityService from '../../services/security.service';

// ============================================
// TOTP Setup Modal
// ============================================

const TOTPSetupModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState('init'); // init, scan, verify, backup, complete
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [verificationCode, setVerificationCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showCodes, setShowCodes] = useState(false);
    const [copiedCodes, setCopiedCodes] = useState(false);

    const startSetup = async () => {
        setIsLoading(true);
        try {
            const result = await securityService.setupTOTP();
            setQrCodeUrl(result.qrCodeUrl);
            setBackupCodes(result.backupCodes);
            setStep('scan');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const verifySetup = async () => {
        if (verificationCode.length !== 6) {
            toast.error('El código debe tener 6 dígitos');
            return;
        }

        setIsLoading(true);
        try {
            await securityService.verifyTOTPSetup(verificationCode);
            setStep('backup');
            toast.success('¡Código verificado correctamente!');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const copyBackupCodes = () => {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        setCopiedCodes(true);
        toast.success('Códigos copiados al portapapeles');
        setTimeout(() => setCopiedCodes(false), 3000);
    };

    const completeSetup = () => {
        setStep('complete');
        setTimeout(() => {
            onSuccess();
            onClose();
        }, 2000);
    };

    useEffect(() => {
        if (isOpen && step === 'init') {
            startSetup();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/10">
                            <Smartphone className="w-6 h-6 text-blue-500" />
                        </div>
                        <h3 className="text-xl font-bold text-dark-text dark:text-light-text">
                            Configurar 2FA
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-dark-background dark:hover:bg-light-background transition-colors"
                    >
                        <X className="w-5 h-5 text-dark-text-muted dark:text-light-text-muted" />
                    </button>
                </div>

                {/* Steps indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {['scan', 'verify', 'backup', 'complete'].map((s, i) => (
                        <div
                            key={s}
                            className={`w-3 h-3 rounded-full transition-colors ${['scan', 'verify', 'backup', 'complete'].indexOf(step) >= i
                                ? 'bg-blue-500'
                                : 'bg-dark-text-muted/20 dark:bg-light-text-muted/20'
                                }`}
                        />
                    ))}
                </div>

                {/* Content based on step */}
                {isLoading && step === 'init' && (
                    <div className="flex flex-col items-center py-8">
                        <Spinner size="lg" />
                        <p className="mt-4 text-dark-text-muted dark:text-light-text-muted">
                            Generando código QR...
                        </p>
                    </div>
                )}

                {step === 'scan' && (
                    <div className="space-y-4">
                        <p className="text-sm text-dark-text-muted dark:text-light-text-muted text-center">
                            Escanea el código QR con tu app de autenticación (Google Authenticator, Authy, etc.)
                        </p>
                        <div className="flex justify-center p-4 bg-white rounded-xl">
                            {qrCodeUrl && (
                                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                            )}
                        </div>
                        <button
                            onClick={() => setStep('verify')}
                            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {step === 'verify' && (
                    <div className="space-y-4">
                        <p className="text-sm text-dark-text-muted dark:text-light-text-muted text-center">
                            Introduce el código de 6 dígitos de tu app de autenticación
                        </p>
                        <input
                            type="text"
                            maxLength={6}
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className="w-full text-center text-3xl font-mono py-4 bg-dark-background dark:bg-light-background rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                        />
                        <button
                            onClick={verifySetup}
                            disabled={isLoading || verificationCode.length !== 6}
                            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? <Spinner size="sm" /> : 'Verificar'}
                        </button>
                    </div>
                )}

                {step === 'backup' && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 rounded-xl">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-yellow-200">
                                Guarda estos códigos de respaldo en un lugar seguro. Los necesitarás si pierdes acceso a tu app de autenticación.
                            </p>
                        </div>

                        <div className="relative">
                            <div className={`p-4 bg-dark-background dark:bg-light-background rounded-xl grid grid-cols-2 gap-2 ${!showCodes ? 'blur-sm select-none' : ''}`}>
                                {backupCodes.map((code, i) => (
                                    <code key={i} className="text-center text-sm font-mono text-dark-text dark:text-light-text">
                                        {code}
                                    </code>
                                ))}
                            </div>
                            {!showCodes && (
                                <button
                                    onClick={() => setShowCodes(true)}
                                    className="absolute inset-0 flex items-center justify-center gap-2 text-dark-text-muted dark:text-light-text-muted hover:text-dark-text dark:hover:text-light-text transition-colors"
                                >
                                    <Eye className="w-5 h-5" />
                                    Mostrar códigos
                                </button>
                            )}
                        </div>

                        <button
                            onClick={copyBackupCodes}
                            className="w-full py-3 px-4 border border-dark-text-muted/20 dark:border-light-text-muted/20 rounded-xl flex items-center justify-center gap-2 hover:bg-dark-background dark:hover:bg-light-background transition-colors"
                        >
                            {copiedCodes ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                            {copiedCodes ? 'Copiado' : 'Copiar códigos'}
                        </button>

                        <button
                            onClick={completeSetup}
                            className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
                        >
                            He guardado mis códigos
                        </button>
                    </div>
                )}

                {step === 'complete' && (
                    <div className="flex flex-col items-center py-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4"
                        >
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                        </motion.div>
                        <h4 className="text-lg font-bold text-dark-text dark:text-light-text">
                            ¡2FA Activado!
                        </h4>
                        <p className="text-sm text-dark-text-muted dark:text-light-text-muted text-center mt-2">
                            Tu cuenta ahora está protegida con autenticación de dos factores.
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// ============================================
// Disable 2FA Modal
// ============================================

const DisableTOTPModal = ({ isOpen, onClose, onSuccess }) => {
    const [verificationCode, setVerificationCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleDisable = async () => {
        if (verificationCode.length !== 6) {
            toast.error('El código debe tener 6 dígitos');
            return;
        }

        setIsLoading(true);
        try {
            await securityService.disableTOTP(verificationCode);
            toast.success('2FA desactivado correctamente');
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-full bg-red-500/10">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-dark-text dark:text-light-text">
                        Desactivar 2FA
                    </h3>
                </div>

                <p className="text-sm text-dark-text-muted dark:text-light-text-muted mb-4">
                    Esto eliminará la protección adicional de tu cuenta. Introduce el código de tu app de autenticación para confirmar.
                </p>

                <input
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center text-3xl font-mono py-4 bg-dark-background dark:bg-light-background rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest mb-4"
                />

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 border border-dark-text-muted/20 dark:border-light-text-muted/20 rounded-xl hover:bg-dark-background dark:hover:bg-light-background transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDisable}
                        disabled={isLoading || verificationCode.length !== 6}
                        className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Spinner size="sm" /> : 'Desactivar'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ============================================
// Passkey Registration Modal
// ============================================

const PasskeyRegistrationModal = ({ isOpen, onClose, onSuccess }) => {
    const [deviceName, setDeviceName] = useState('');
    const [step, setStep] = useState('name'); // name, registering, complete
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        if (!deviceName.trim()) {
            toast.error('Introduce un nombre para este dispositivo');
            return;
        }

        setStep('registering');
        setIsLoading(true);

        try {
            await securityService.registerPasskey(deviceName);
            setStep('complete');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } catch (error) {
            toast.error(error.message);
            setStep('name');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setStep('name');
            setDeviceName('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-purple-500/10">
                            <Fingerprint className="w-6 h-6 text-purple-500" />
                        </div>
                        <h3 className="text-xl font-bold text-dark-text dark:text-light-text">
                            Registrar Passkey
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-dark-background dark:hover:bg-light-background transition-colors"
                    >
                        <X className="w-5 h-5 text-dark-text-muted dark:text-light-text-muted" />
                    </button>
                </div>

                {step === 'name' && (
                    <div className="space-y-4">
                        <p className="text-sm text-dark-text-muted dark:text-light-text-muted">
                            Usa huella digital, Face ID o una llave de seguridad para iniciar sesión sin contraseña.
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-dark-text-muted dark:text-light-text-muted mb-2">
                                Nombre del dispositivo
                            </label>
                            <input
                                type="text"
                                value={deviceName}
                                onChange={(e) => setDeviceName(e.target.value)}
                                placeholder="Ej: MacBook Pro, iPhone 15, YubiKey..."
                                className="w-full py-3 px-4 bg-dark-background dark:bg-light-background rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        <button
                            onClick={handleRegister}
                            disabled={!deviceName.trim()}
                            className="w-full py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                        >
                            Registrar Passkey
                        </button>
                    </div>
                )}

                {step === 'registering' && (
                    <div className="flex flex-col items-center py-8">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4"
                        >
                            <Fingerprint className="w-10 h-10 text-purple-500" />
                        </motion.div>
                        <p className="text-dark-text dark:text-light-text font-medium">
                            Esperando autenticación...
                        </p>
                        <p className="text-sm text-dark-text-muted dark:text-light-text-muted text-center mt-2">
                            Usa tu huella digital, Face ID o llave de seguridad cuando se te solicite.
                        </p>
                    </div>
                )}

                {step === 'complete' && (
                    <div className="flex flex-col items-center py-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4"
                        >
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                        </motion.div>
                        <h4 className="text-lg font-bold text-dark-text dark:text-light-text">
                            ¡Passkey Registrada!
                        </h4>
                        <p className="text-sm text-dark-text-muted dark:text-light-text-muted text-center mt-2">
                            Ahora puedes usar "{deviceName}" para iniciar sesión.
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// ============================================
// Passkey Item Component
// ============================================

const PasskeyItem = ({ credential, onRemove, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(credential.deviceName);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        if (!newName.trim()) {
            toast.error('El nombre no puede estar vacío');
            return;
        }

        setIsLoading(true);
        try {
            await securityService.updatePasskeyName(credential.id, newName);
            onRename(credential.id, newName);
            setIsEditing(false);
            toast.success('Nombre actualizado');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta passkey?')) return;

        setIsLoading(true);
        try {
            await securityService.removePasskey(credential.id);
            onRemove(credential.id);
            toast.success('Passkey eliminada');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-between p-4 bg-dark-background dark:bg-light-background rounded-xl">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-500/10">
                    <Key className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-transparent border-b border-purple-500 focus:outline-none text-dark-text dark:text-light-text"
                            autoFocus
                        />
                    ) : (
                        <p className="font-medium text-dark-text dark:text-light-text">
                            {credential.deviceName}
                        </p>
                    )}
                    <p className="text-xs text-dark-text-muted dark:text-light-text-muted">
                        Creada: {new Date(credential.createdAt).toLocaleDateString()}
                        {credential.lastUsedAt && ` • Último uso: ${new Date(credential.lastUsedAt).toLocaleDateString()}`}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {isEditing ? (
                    <>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="p-2 rounded-full hover:bg-green-500/10 text-green-500 transition-colors"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setNewName(credential.deviceName);
                            }}
                            className="p-2 rounded-full hover:bg-red-500/10 text-red-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 rounded-full hover:bg-dark-surface dark:hover:bg-light-surface text-dark-text-muted dark:text-light-text-muted transition-colors"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRemove}
                            disabled={isLoading}
                            className="p-2 rounded-full hover:bg-red-500/10 text-red-500 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

// ============================================
// Main SecuritySettings Component
// ============================================

const SecuritySettings = () => {
    const [securityStatus, setSecurityStatus] = useState(null);
    const [config, setConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [showTOTPSetup, setShowTOTPSetup] = useState(false);
    const [showTOTPDisable, setShowTOTPDisable] = useState(false);
    const [showPasskeyRegister, setShowPasskeyRegister] = useState(false);
    const [expandedSection, setExpandedSection] = useState('2fa');
    const [webAuthnSupported, setWebAuthnSupported] = useState(false);
    const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false);

    const loadSecurityStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const [statusResult, configResult] = await Promise.all([
                securityService.get2FAStatus(),
                securityService.get2FAConfig(),
            ]);
            setSecurityStatus(statusResult);
            setConfig(configResult.config);
            setIsOffline(statusResult?.offline || configResult?.offline || false);
        } catch (error) {
            console.error('Error loading security status:', error);
            setIsOffline(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const checkWebAuthnSupport = async () => {
        setWebAuthnSupported(securityService.isWebAuthnSupported());
        const platformAvailable = await securityService.isPlatformAuthenticatorAvailable();
        setPlatformAuthAvailable(platformAvailable);
    };

    useEffect(() => {
        loadSecurityStatus();
        checkWebAuthnSupport();
    }, [loadSecurityStatus]);

    const handleRetryConnection = async () => {
        setIsLoading(true);
        const available = await securityService.checkBackendAvailability();
        if (available) {
            await loadSecurityStatus();
        } else {
            setIsLoading(false);
            toast.error('El servidor de seguridad no está disponible');
        }
    };

    const handlePasskeyRename = (id, newName) => {
        if (!securityStatus) return;
        setSecurityStatus(prev => ({
            ...prev,
            methods: {
                ...prev.methods,
                webauthn: {
                    ...prev.methods.webauthn,
                    credentials: prev.methods.webauthn.credentials.map(c =>
                        c.id === id ? { ...c, deviceName: newName } : c
                    ),
                },
            },
        }));
    };

    const handlePasskeyRemove = (id) => {
        if (!securityStatus) return;
        const newCreds = securityStatus.methods.webauthn.credentials.filter(c => c.id !== id);
        setSecurityStatus(prev => ({
            ...prev,
            methods: {
                ...prev.methods,
                webauthn: {
                    ...prev.methods.webauthn,
                    enabled: newCreds.length > 0,
                    credentialsCount: newCreds.length,
                    credentials: newCreds,
                },
            },
        }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
            </div>
        );
    }

    // Offline state - show friendly message
    if (isOffline) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-dark-text dark:text-light-text mb-2 flex items-center gap-3">
                        <Shield className="w-7 h-7 text-blue-500" />
                        Seguridad de la Cuenta
                    </h2>
                </div>
                <div className="p-8 rounded-2xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-dark-text dark:text-light-text mb-2">
                        Servidor de Seguridad No Disponible
                    </h3>
                    <p className="text-dark-text-muted dark:text-light-text-muted mb-4 max-w-md mx-auto">
                        No se puede conectar al servidor de autenticación. Las opciones de 2FA y Passkeys estarán disponibles cuando el servidor esté en línea.
                    </p>
                    <button
                        onClick={handleRetryConnection}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Reintentar Conexión
                    </button>
                    <p className="text-xs text-dark-text-muted dark:text-light-text-muted mt-4">
                        Asegúrate de que el backend esté ejecutándose en el puerto 4000
                    </p>
                </div>
            </div>
        );
    }

    const totpEnabled = securityStatus?.methods?.totp?.enabled;
    const webauthnEnabled = securityStatus?.methods?.webauthn?.enabled;
    const passkeys = securityStatus?.methods?.webauthn?.credentials || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-dark-text dark:text-light-text mb-2 flex items-center gap-3">
                    <Shield className="w-7 h-7 text-blue-500" />
                    Seguridad de la Cuenta
                </h2>
                <p className="text-dark-text-muted dark:text-light-text-muted">
                    Protege tu cuenta con autenticación de dos factores y passkeys biométricas.
                </p>
            </div>

            {/* Security Score */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-dark-text dark:text-light-text mb-1">
                            Nivel de Seguridad
                        </h3>
                        <p className="text-sm text-dark-text-muted dark:text-light-text-muted">
                            {totpEnabled && webauthnEnabled
                                ? 'Máxima protección activada'
                                : totpEnabled || webauthnEnabled
                                    ? 'Protección básica activada'
                                    : 'Cuenta sin protección adicional'}
                        </p>
                    </div>
                    <div className={`text-4xl font-bold ${totpEnabled && webauthnEnabled
                        ? 'text-green-500'
                        : totpEnabled || webauthnEnabled
                            ? 'text-yellow-500'
                            : 'text-red-500'
                        }`}>
                        {totpEnabled && webauthnEnabled ? '100%' : totpEnabled || webauthnEnabled ? '50%' : '0%'}
                    </div>
                </div>
                <div className="mt-4 h-2 bg-dark-background dark:bg-light-background rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${totpEnabled && webauthnEnabled
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : totpEnabled || webauthnEnabled
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                                : 'bg-red-500'
                            }`}
                        style={{ width: totpEnabled && webauthnEnabled ? '100%' : totpEnabled || webauthnEnabled ? '50%' : '5%' }}
                    />
                </div>
            </div>

            {/* 2FA Section */}
            <div className="bg-dark-surface dark:bg-light-surface rounded-2xl overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === '2fa' ? null : '2fa')}
                    className="w-full flex items-center justify-between p-6 hover:bg-dark-background/50 dark:hover:bg-light-background/50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${totpEnabled ? 'bg-green-500/10' : 'bg-dark-background dark:bg-light-background'}`}>
                            <Smartphone className={`w-6 h-6 ${totpEnabled ? 'text-green-500' : 'text-dark-text-muted dark:text-light-text-muted'}`} />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-dark-text dark:text-light-text flex items-center gap-2">
                                Autenticador TOTP
                                {totpEnabled && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </h3>
                            <p className="text-sm text-dark-text-muted dark:text-light-text-muted">
                                Google Authenticator, Authy u otra app TOTP
                            </p>
                        </div>
                    </div>
                    {expandedSection === '2fa' ? (
                        <ChevronUp className="w-5 h-5 text-dark-text-muted dark:text-light-text-muted" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-dark-text-muted dark:text-light-text-muted" />
                    )}
                </button>

                <AnimatePresence>
                    {expandedSection === '2fa' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-6 pb-6 space-y-4">
                                <div className="p-4 bg-dark-background dark:bg-light-background rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-dark-text-muted dark:text-light-text-muted">
                                            Añade una capa extra de seguridad. Necesitarás un código de tu app de autenticación además de tu contraseña para iniciar sesión.
                                        </p>
                                    </div>
                                </div>

                                {totpEnabled ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                                            <div className="flex items-center gap-3">
                                                <Lock className="w-5 h-5 text-green-500" />
                                                <div>
                                                    <p className="font-medium text-green-500">2FA Activado</p>
                                                    <p className="text-xs text-dark-text-muted dark:text-light-text-muted">
                                                        Desde: {securityStatus?.methods?.totp?.enabledAt
                                                            ? new Date(securityStatus.methods.totp.enabledAt).toLocaleDateString()
                                                            : 'Desconocido'}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-dark-text-muted dark:text-light-text-muted">
                                                {securityStatus?.methods?.totp?.backupCodesRemaining || 0} códigos de respaldo
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => setShowTOTPDisable(true)}
                                            className="w-full py-3 px-4 border border-red-500/50 text-red-500 font-semibold rounded-xl hover:bg-red-500/10 transition-colors"
                                        >
                                            Desactivar 2FA
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowTOTPSetup(true)}
                                        disabled={!config?.totp?.enabled}
                                        className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Activar Autenticador TOTP
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Passkeys Section */}
            <div className="bg-dark-surface dark:bg-light-surface rounded-2xl overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'passkeys' ? null : 'passkeys')}
                    className="w-full flex items-center justify-between p-6 hover:bg-dark-background/50 dark:hover:bg-light-background/50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${webauthnEnabled ? 'bg-purple-500/10' : 'bg-dark-background dark:bg-light-background'}`}>
                            <Fingerprint className={`w-6 h-6 ${webauthnEnabled ? 'text-purple-500' : 'text-dark-text-muted dark:text-light-text-muted'}`} />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-dark-text dark:text-light-text flex items-center gap-2">
                                Passkeys / WebAuthn
                                {webauthnEnabled && <CheckCircle2 className="w-4 h-4 text-purple-500" />}
                            </h3>
                            <p className="text-sm text-dark-text-muted dark:text-light-text-muted">
                                Huella digital, Face ID o llave de seguridad
                            </p>
                        </div>
                    </div>
                    {expandedSection === 'passkeys' ? (
                        <ChevronUp className="w-5 h-5 text-dark-text-muted dark:text-light-text-muted" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-dark-text-muted dark:text-light-text-muted" />
                    )}
                </button>

                <AnimatePresence>
                    {expandedSection === 'passkeys' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-6 pb-6 space-y-4">
                                {!webAuthnSupported && (
                                    <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                                        <div className="flex items-start gap-3">
                                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-400">
                                                Tu navegador no soporta WebAuthn. Usa un navegador moderno como Chrome, Firefox, Safari o Edge.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {webAuthnSupported && (
                                    <>
                                        <div className="p-4 bg-dark-background dark:bg-light-background rounded-xl">
                                            <div className="flex items-start gap-3">
                                                <Info className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                                                <div className="text-sm text-dark-text-muted dark:text-light-text-muted">
                                                    <p>Las passkeys te permiten iniciar sesión de forma más segura y rápida usando:</p>
                                                    <ul className="mt-2 space-y-1 list-disc list-inside">
                                                        <li>Huella digital (Touch ID, Windows Hello)</li>
                                                        <li>Reconocimiento facial (Face ID)</li>
                                                        <li>Llaves de seguridad (YubiKey, Titan)</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Registered Passkeys */}
                                        {passkeys.length > 0 && (
                                            <div className="space-y-3">
                                                <h4 className="text-sm font-medium text-dark-text-muted dark:text-light-text-muted">
                                                    Passkeys Registradas ({passkeys.length})
                                                </h4>
                                                {passkeys.map((credential) => (
                                                    <PasskeyItem
                                                        key={credential.id}
                                                        credential={credential}
                                                        onRemove={handlePasskeyRemove}
                                                        onRename={handlePasskeyRename}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setShowPasskeyRegister(true)}
                                            disabled={!config?.webauthn?.enabled}
                                            className="w-full py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-5 h-5" />
                                            Añadir Nueva Passkey
                                        </button>

                                        {!config?.webauthn?.enabled && (
                                            <p className="text-xs text-dark-text-muted dark:text-light-text-muted text-center">
                                                WebAuthn no está habilitado en el servidor
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Preferred Method */}
            {(totpEnabled || webauthnEnabled) && (
                <div className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6">
                    <h3 className="font-semibold text-dark-text dark:text-light-text mb-4 flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-dark-text-muted dark:text-light-text-muted" />
                        Método Preferido
                    </h3>
                    <div className="space-y-2">
                        {totpEnabled && (
                            <label className="flex items-center gap-3 p-4 bg-dark-background dark:bg-light-background rounded-xl cursor-pointer hover:bg-dark-background/80 dark:hover:bg-light-background/80 transition-colors">
                                <input
                                    type="radio"
                                    name="preferredMethod"
                                    checked={securityStatus?.preferredMethod === 'totp'}
                                    onChange={() => securityService.setPreferredMethod('totp').then(loadSecurityStatus)}
                                    className="w-4 h-4 text-blue-500"
                                />
                                <Smartphone className="w-5 h-5 text-blue-500" />
                                <span className="text-dark-text dark:text-light-text">Autenticador TOTP</span>
                            </label>
                        )}
                        {webauthnEnabled && (
                            <label className="flex items-center gap-3 p-4 bg-dark-background dark:bg-light-background rounded-xl cursor-pointer hover:bg-dark-background/80 dark:hover:bg-light-background/80 transition-colors">
                                <input
                                    type="radio"
                                    name="preferredMethod"
                                    checked={securityStatus?.preferredMethod === 'webauthn'}
                                    onChange={() => securityService.setPreferredMethod('webauthn').then(loadSecurityStatus)}
                                    className="w-4 h-4 text-purple-500"
                                />
                                <Fingerprint className="w-5 h-5 text-purple-500" />
                                <span className="text-dark-text dark:text-light-text">Passkeys</span>
                            </label>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <TOTPSetupModal
                isOpen={showTOTPSetup}
                onClose={() => setShowTOTPSetup(false)}
                onSuccess={loadSecurityStatus}
            />
            <DisableTOTPModal
                isOpen={showTOTPDisable}
                onClose={() => setShowTOTPDisable(false)}
                onSuccess={loadSecurityStatus}
            />
            <PasskeyRegistrationModal
                isOpen={showPasskeyRegister}
                onClose={() => setShowPasskeyRegister(false)}
                onSuccess={loadSecurityStatus}
            />
        </div>
    );
};

export default SecuritySettings;
