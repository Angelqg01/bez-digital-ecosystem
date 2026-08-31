// hooks/useQualityOracle.js
// Hook para interactuar con el contrato QualityOracle V2
// Soporta validación multi-sector: PRODUCT, SERVICE, NFT, RWA, LOGISTICS, SDK, POST, REVIEW, TRANSACTION

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';

// ABI simplificado del QualityOracle
const QUALITY_ORACLE_ABI = [
    // Enums
    "function EntityType() view returns (uint8)",
    "function ValidationStatus() view returns (uint8)",

    // View functions
    "function getValidation(bytes32 entityId) view returns (tuple(bytes32 entityId, uint8 entityType, address creator, uint256 qualityScore, uint8 status, address validator, uint256 timestamp, uint256 disputeDeadline, string metadataURI))",
    "function validators(address) view returns (tuple(bool isActive, uint256 totalValidations, uint256 successfulValidations, uint256 stakedAmount, uint256 reputation))",
    "function entityThresholds(uint8) view returns (uint256)",
    "function MIN_STAKE() view returns (uint256)",
    "function DISPUTE_PERIOD() view returns (uint256)",
    "function validationCount() view returns (uint256)",
    "function activeValidatorsCount() view returns (uint256)",
    "function getValidatorStats(address validator) view returns (uint256 total, uint256 successful, uint256 reputation)",

    // Write functions
    "function submitForValidation(bytes32 entityId, uint8 entityType, string metadataURI) external",
    "function validate(bytes32 entityId, uint256 qualityScore, string feedback) external",
    "function disputeValidation(bytes32 entityId, string reason) external",
    "function resolveDispute(bytes32 entityId, bool upholdValidation, uint256 newScore) external",
    "function registerValidator() external payable",
    "function unregisterValidator() external",
    "function addValidatorStake() external payable",

    // Events
    "event ValidationSubmitted(bytes32 indexed entityId, uint8 entityType, address indexed creator)",
    "event ValidationCompleted(bytes32 indexed entityId, uint256 qualityScore, uint8 status, address indexed validator)",
    "event DisputeRaised(bytes32 indexed entityId, address indexed disputer, string reason)",
    "event DisputeResolved(bytes32 indexed entityId, bool upheld, uint256 finalScore)",
    "event ValidatorRegistered(address indexed validator, uint256 stakedAmount)",
    "event ValidatorUnregistered(address indexed validator)"
];

// Dirección del contrato (actualizar después del despliegue)
const QUALITY_ORACLE_ADDRESS = import.meta.env.VITE_QUALITY_ORACLE_ADDRESS || '0x0000000000000000000000000000000000000000';

// Tipos de entidad
export const EntityType = {
    PRODUCT: 0,
    SERVICE: 1,
    NFT: 2,
    RWA: 3,
    LOGISTICS: 4,
    SDK_INTERACTION: 5,
    POST: 6,
    REVIEW: 7,
    TRANSACTION: 8
};

// Estados de validación
export const ValidationStatus = {
    PENDING: 0,
    IN_REVIEW: 1,
    APPROVED: 2,
    REJECTED: 3,
    DISPUTED: 4,
    RESOLVED: 5
};

// Labels para UI
export const EntityTypeLabels = {
    [EntityType.PRODUCT]: 'Producto',
    [EntityType.SERVICE]: 'Servicio',
    [EntityType.NFT]: 'NFT',
    [EntityType.RWA]: 'Real World Asset',
    [EntityType.LOGISTICS]: 'Logística',
    [EntityType.SDK_INTERACTION]: 'SDK Interaction',
    [EntityType.POST]: 'Publicación',
    [EntityType.REVIEW]: 'Reseña',
    [EntityType.TRANSACTION]: 'Transacción'
};

export const ValidationStatusLabels = {
    [ValidationStatus.PENDING]: 'Pendiente',
    [ValidationStatus.IN_REVIEW]: 'En Revisión',
    [ValidationStatus.APPROVED]: 'Aprobado',
    [ValidationStatus.REJECTED]: 'Rechazado',
    [ValidationStatus.DISPUTED]: 'Disputado',
    [ValidationStatus.RESOLVED]: 'Resuelto'
};

export const useQualityOracle = () => {
    const { address, isConnected } = useAccount();
    const [loading, setLoading] = useState(false);
    const [validatorInfo, setValidatorInfo] = useState(null);
    const [oracleStats, setOracleStats] = useState({
        totalValidations: 0,
        activeValidators: 0,
        minStake: '0'
    });

    // Generar entityId único
    const generateEntityId = useCallback((entityType, creatorAddress, timestamp = Date.now()) => {
        const packed = ethers.solidityPackedKeccak256(
            ['uint8', 'address', 'uint256'],
            [entityType, creatorAddress, timestamp]
        );
        return packed;
    }, []);

    // Obtener información de validación
    const getValidation = useCallback(async (entityId) => {
        if (!window.ethereum) return null;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(QUALITY_ORACLE_ADDRESS, QUALITY_ORACLE_ABI, provider);
            const validation = await contract.getValidation(entityId);
            return {
                entityId: validation.entityId,
                entityType: validation.entityType,
                creator: validation.creator,
                qualityScore: validation.qualityScore.toString(),
                status: validation.status,
                validator: validation.validator,
                timestamp: validation.timestamp.toString(),
                disputeDeadline: validation.disputeDeadline.toString(),
                metadataURI: validation.metadataURI
            };
        } catch (error) {
            console.error('Error getting validation:', error);
            return null;
        }
    }, []);

    // Enviar entidad para validación
    const submitForValidation = useCallback(async (entityType, metadataURI) => {
        if (!isConnected || !window.ethereum) {
            toast.error('Conecta tu wallet primero');
            return null;
        }

        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(QUALITY_ORACLE_ADDRESS, QUALITY_ORACLE_ABI, signer);

            const entityId = generateEntityId(entityType, address);

            const tx = await contract.submitForValidation(entityId, entityType, metadataURI);
            toast.loading('Enviando para validación...', { id: 'submit-validation' });

            const receipt = await tx.wait();
            toast.success('Enviado para validación correctamente', { id: 'submit-validation' });

            return {
                entityId,
                txHash: receipt.hash,
                entityType,
                status: ValidationStatus.PENDING
            };
        } catch (error) {
            console.error('Error submitting for validation:', error);
            toast.error(`Error: ${error.reason || error.message}`, { id: 'submit-validation' });
            return null;
        } finally {
            setLoading(false);
        }
    }, [isConnected, address, generateEntityId]);

    // Validar entidad (solo validadores)
    const validate = useCallback(async (entityId, qualityScore, feedback = '') => {
        if (!isConnected || !window.ethereum) {
            toast.error('Conecta tu wallet primero');
            return false;
        }

        if (qualityScore < 0 || qualityScore > 100) {
            toast.error('El score debe estar entre 0 y 100');
            return false;
        }

        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(QUALITY_ORACLE_ADDRESS, QUALITY_ORACLE_ABI, signer);

            const tx = await contract.validate(entityId, qualityScore, feedback);
            toast.loading('Procesando validación...', { id: 'validate' });

            await tx.wait();
            toast.success('Validación completada', { id: 'validate' });

            return true;
        } catch (error) {
            console.error('Error validating:', error);
            toast.error(`Error: ${error.reason || error.message}`, { id: 'validate' });
            return false;
        } finally {
            setLoading(false);
        }
    }, [isConnected]);

    // Disputar validación
    const disputeValidation = useCallback(async (entityId, reason) => {
        if (!isConnected || !window.ethereum) {
            toast.error('Conecta tu wallet primero');
            return false;
        }

        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(QUALITY_ORACLE_ADDRESS, QUALITY_ORACLE_ABI, signer);

            const tx = await contract.disputeValidation(entityId, reason);
            toast.loading('Enviando disputa...', { id: 'dispute' });

            await tx.wait();
            toast.success('Disputa enviada correctamente', { id: 'dispute' });

            return true;
        } catch (error) {
            console.error('Error disputing:', error);
            toast.error(`Error: ${error.reason || error.message}`, { id: 'dispute' });
            return false;
        } finally {
            setLoading(false);
        }
    }, [isConnected]);

    // Registrarse como validador
    const registerAsValidator = useCallback(async (stakeAmount) => {
        if (!isConnected || !window.ethereum) {
            toast.error('Conecta tu wallet primero');
            return false;
        }

        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(QUALITY_ORACLE_ADDRESS, QUALITY_ORACLE_ABI, signer);

            // El stake se envía en BEZ tokens, no en MATIC
            // Primero necesitamos aprobar el contrato para gastar nuestros tokens
            const bezCoinAddress = import.meta.env.VITE_BEZ_COIN_ADDRESS;
            const bezCoin = new ethers.Contract(
                bezCoinAddress,
                ['function approve(address spender, uint256 amount) returns (bool)'],
                signer
            );

            const stakeWei = ethers.parseEther(stakeAmount.toString());

            // Aprobar
            toast.loading('Aprobando tokens...', { id: 'approve-stake' });
            const approveTx = await bezCoin.approve(QUALITY_ORACLE_ADDRESS, stakeWei);
            await approveTx.wait();
            toast.success('Tokens aprobados', { id: 'approve-stake' });

            // Registrar
            toast.loading('Registrando como validador...', { id: 'register-validator' });
            const tx = await contract.registerValidator();
            await tx.wait();
            toast.success('¡Registrado como validador!', { id: 'register-validator' });

            return true;
        } catch (error) {
            console.error('Error registering as validator:', error);
            toast.error(`Error: ${error.reason || error.message}`, { id: 'register-validator' });
            return false;
        } finally {
            setLoading(false);
        }
    }, [isConnected]);

    // Cargar información del validador
    const loadValidatorInfo = useCallback(async () => {
        if (!isConnected || !window.ethereum || !address) return;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(QUALITY_ORACLE_ADDRESS, QUALITY_ORACLE_ABI, provider);

            const info = await contract.validators(address);
            setValidatorInfo({
                isActive: info.isActive,
                totalValidations: info.totalValidations.toString(),
                successfulValidations: info.successfulValidations.toString(),
                stakedAmount: ethers.formatEther(info.stakedAmount),
                reputation: info.reputation.toString()
            });
        } catch (error) {
            console.error('Error loading validator info:', error);
        }
    }, [isConnected, address]);

    // Cargar estadísticas del oráculo
    const loadOracleStats = useCallback(async () => {
        if (!window.ethereum) return;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(QUALITY_ORACLE_ADDRESS, QUALITY_ORACLE_ABI, provider);

            const [validationCount, activeValidators, minStake] = await Promise.all([
                contract.validationCount(),
                contract.activeValidatorsCount(),
                contract.MIN_STAKE()
            ]);

            setOracleStats({
                totalValidations: validationCount.toString(),
                activeValidators: activeValidators.toString(),
                minStake: ethers.formatEther(minStake)
            });
        } catch (error) {
            console.error('Error loading oracle stats:', error);
        }
    }, []);

    // Obtener umbral por tipo de entidad
    const getEntityThreshold = useCallback(async (entityType) => {
        if (!window.ethereum) return 0;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(QUALITY_ORACLE_ADDRESS, QUALITY_ORACLE_ABI, provider);
            const threshold = await contract.entityThresholds(entityType);
            return Number(threshold);
        } catch (error) {
            console.error('Error getting threshold:', error);
            return 0;
        }
    }, []);

    // Efecto para cargar datos iniciales
    useEffect(() => {
        if (isConnected) {
            loadValidatorInfo();
            loadOracleStats();
        }
    }, [isConnected, loadValidatorInfo, loadOracleStats]);

    return {
        // Estado
        loading,
        validatorInfo,
        oracleStats,
        isConnected,

        // Utilidades
        generateEntityId,
        EntityType,
        ValidationStatus,
        EntityTypeLabels,
        ValidationStatusLabels,

        // Acciones
        getValidation,
        submitForValidation,
        validate,
        disputeValidation,
        registerAsValidator,
        getEntityThreshold,

        // Refresh
        refreshValidatorInfo: loadValidatorInfo,
        refreshOracleStats: loadOracleStats
    };
};

export default useQualityOracle;
