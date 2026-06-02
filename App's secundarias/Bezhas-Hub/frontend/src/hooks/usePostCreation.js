import { useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { PostAddress, PostABI, BezhasTokenAddress, BezhasTokenABI } from '../contract-config';

/**
 * Hook personalizado para la creación de posts con validación blockchain
 * Maneja la lógica de publicación, validación con tokens BEZ, y almacenamiento
 */
export const usePostCreation = () => {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const [isPosting, setIsPosting] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    // Costo en tokens BEZ para validar en blockchain
    const VALIDATION_COST = ethers.parseEther('10'); // 10 BEZ tokens

    /**
     * Sube archivos al servidor y retorna las URLs
     * @param {File[]} files - Archivos a subir
     * @returns {Promise<Object[]>} Array de objetos con info de archivos subidos
     */
    const uploadFiles = async (files) => {
        if (!files || files.length === 0) return [];

        const formData = new FormData();
        files.forEach((file) => {
            formData.append('files', file);
        });

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Error al subir archivos');
            }

            const data = await response.json();
            return data.files || [];
        } catch (error) {
            console.error('Error uploading files:', error);
            throw error;
        }
    };

    /**
     * Valida el post en la blockchain quemando tokens BEZ
     * @param {string} postId - ID del post a validar
     * @param {string} contentHash - Hash del contenido del post
     * @returns {Promise<Object>} Datos de la transacción
     */
    const validateOnBlockchain = async (postId, contentHash) => {
        if (!isConnected || !walletClient) {
            throw new Error('Wallet no conectada');
        }

        setIsValidating(true);

        try {
            const provider = new ethers.BrowserProvider(walletClient);
            const signer = await provider.getSigner();

            // Contratos
            const tokenContract = new ethers.Contract(BezhasTokenAddress, BezhasTokenABI, signer);
            const postContract = new ethers.Contract(PostAddress, PostABI, signer);

            // 1. Verificar balance de tokens
            const balance = await tokenContract.balanceOf(address);
            if (balance < VALIDATION_COST) {
                throw new Error(`Necesitas al menos ${ethers.formatEther(VALIDATION_COST)} BEZ para validar en blockchain`);
            }

            // 2. Quemar tokens BEZ (transferir a dirección 0x0)
            const burnTx = await tokenContract.transfer(
                '0x0000000000000000000000000000000000000000',
                VALIDATION_COST
            );

            toast.loading('Quemando tokens BEZ...', { id: 'burn-tokens' });
            await burnTx.wait();
            toast.success('10 BEZ tokens quemados exitosamente', { id: 'burn-tokens' });

            // 3. Crear post en blockchain con el hash del contenido
            const createPostTx = await postContract.createPost(contentHash);

            toast.loading('Validando en blockchain...', { id: 'blockchain-validation' });
            const receipt = await createPostTx.wait();
            toast.success('Post validado en blockchain', { id: 'blockchain-validation' });

            return {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                burnTxHash: burnTx.hash,
                validated: true,
            };
        } catch (error) {
            console.error('Error validando en blockchain:', error);
            toast.error(error.message || 'Error al validar en blockchain');
            throw error;
        } finally {
            setIsValidating(false);
        }
    };

    /**
     * Crea un hash del contenido del post
     * @param {Object} postData - Datos del post
     * @returns {string} Hash del contenido
     */
    const createContentHash = (postData) => {
        const content = JSON.stringify({
            text: postData.content,
            files: postData.files.map(f => f.name),
            timestamp: Date.now(),
            author: address,
        });
        return ethers.keccak256(ethers.toUtf8Bytes(content));
    };

    /**
     * Publica un post (con o sin validación blockchain)
     * @param {Object} postData - Datos del post
     * @param {boolean} validateBlockchain - Si se debe validar en blockchain
     * @returns {Promise<Object>} Post creado
     */
    const createPost = useCallback(async (postData, validateBlockchain = false) => {
        if (!isConnected) {
            toast.error('Conecta tu wallet para publicar');
            return null;
        }

        setIsPosting(true);

        try {
            // 1. Subir archivos si existen
            let uploadedFiles = [];
            if (postData.files && postData.files.length > 0) {
                toast.loading('Subiendo archivos...', { id: 'upload-files' });
                uploadedFiles = await uploadFiles(postData.files);
                toast.success(`${uploadedFiles.length} archivo(s) subido(s)`, { id: 'upload-files' });
            }

            // 2. Preparar datos del post
            const postToSave = {
                content: postData.content,
                privacy: postData.privacy || 'public',
                location: postData.location || null,
                media: uploadedFiles,
                author: address,
                timestamp: Date.now(),
                validated: false,
                blockchainData: null,
            };

            // 3. Validar en blockchain si se solicita
            if (validateBlockchain) {
                const contentHash = createContentHash(postData);
                const blockchainData = await validateOnBlockchain(postToSave.id, contentHash);
                postToSave.validated = true;
                postToSave.blockchainData = blockchainData;
            }

            // 4. Guardar en backend
            const response = await fetch('http://localhost:3001/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postToSave),
            });

            if (!response.ok) {
                throw new Error('Error al guardar el post');
            }

            const savedPost = await response.json();

            toast.success(
                validateBlockchain
                    ? '¡Post publicado y validado en blockchain!'
                    : '¡Post publicado exitosamente!'
            );

            return savedPost;
        } catch (error) {
            console.error('Error creating post:', error);
            toast.error(error.message || 'Error al publicar el post');
            return null;
        } finally {
            setIsPosting(false);
        }
    }, [isConnected, address, walletClient]);

    /**
     * Obtiene el costo de validación en tokens BEZ
     * @returns {string} Costo formateado
     */
    const getValidationCost = () => {
        return ethers.formatEther(VALIDATION_COST);
    };

    return {
        createPost,
        validateOnBlockchain,
        isPosting,
        isValidating,
        getValidationCost,
        VALIDATION_COST,
    };
};

export default usePostCreation;
