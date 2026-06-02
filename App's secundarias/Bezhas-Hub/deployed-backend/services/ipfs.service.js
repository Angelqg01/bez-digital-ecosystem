const axios = require('axios');
const FormData = require('form-data');

/**
 * Servicio de IPFS usando Pinata
 * Permite subir archivos a IPFS de forma descentralizada
 */

const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

/**
 * Sube un archivo a IPFS usando Pinata
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} filename - Nombre del archivo
 * @param {object} metadata - Metadata adicional (opcional)
 * @returns {Promise<object>} - URL IPFS y hash
 */
async function uploadToIPFS(buffer, filename, metadata = {}) {
    try {
        // Validar configuración
        if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
            console.warn('⚠️  Pinata API keys no configuradas. Usando mock.');
            return uploadToIPFSMock(buffer, filename);
        }

        // Crear FormData
        const formData = new FormData();
        formData.append('file', buffer, {
            filename: filename,
            contentType: 'application/octet-stream'
        });

        // Agregar metadata opcional
        const pinataMetadata = {
            name: filename,
            keyvalues: {
                uploadedBy: 'BeZhas',
                timestamp: new Date().toISOString(),
                ...metadata
            }
        };

        formData.append('pinataMetadata', JSON.stringify(pinataMetadata));

        // Opciones de pinning
        const pinataOptions = {
            cidVersion: 1 // Usar CIDv1 para mejor compatibilidad
        };
        formData.append('pinataOptions', JSON.stringify(pinataOptions));

        // Realizar solicitud a Pinata
        const response = await axios.post(PINATA_API_URL, formData, {
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_KEY,
                ...formData.getHeaders()
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        const ipfsHash = response.data.IpfsHash;

        return {
            success: true,
            ipfsHash: ipfsHash,
            ipfsUrl: `ipfs://${ipfsHash}`,
            gatewayUrl: `${PINATA_GATEWAY}${ipfsHash}`,
            size: buffer.length,
            timestamp: response.data.Timestamp
        };

    } catch (error) {
        console.error('Error al subir a Pinata IPFS:', error.response?.data || error.message);

        // Si falla la subida real, usar mock en desarrollo
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️  Cayendo a IPFS mock por error en Pinata');
            return uploadToIPFSMock(buffer, filename);
        }

        throw new Error('Error al subir archivo a IPFS: ' + (error.response?.data?.error || error.message));
    }
}

/**
 * Mock de subida a IPFS para desarrollo/testing
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<object>} - URL IPFS mock
 */
async function uploadToIPFSMock(buffer, filename) {
    console.log('📦 Usando IPFS Mock (desarrollo)');

    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generar hash mock realista
    const mockHash = 'Qm' + Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

    return {
        success: true,
        ipfsHash: mockHash,
        ipfsUrl: `ipfs://${mockHash}`,
        gatewayUrl: `https://ipfs.io/ipfs/${mockHash}`,
        size: buffer.length,
        timestamp: new Date().toISOString(),
        mock: true
    };
}

/**
 * Obtiene información de un archivo en IPFS
 * @param {string} hash - Hash IPFS del archivo
 * @returns {Promise<object>} - Información del archivo
 */
async function getIPFSFileInfo(hash) {
    try {
        if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
            throw new Error('Pinata API keys no configuradas');
        }

        const response = await axios.get(
            `https://api.pinata.cloud/data/pinList?hashContains=${hash}`,
            {
                headers: {
                    'pinata_api_key': PINATA_API_KEY,
                    'pinata_secret_api_key': PINATA_SECRET_KEY
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error obteniendo info de IPFS:', error.message);
        throw error;
    }
}

/**
 * Desancla (unpin) un archivo de IPFS
 * @param {string} hash - Hash IPFS del archivo
 * @returns {Promise<boolean>} - true si se desancló correctamente
 */
async function unpinFromIPFS(hash) {
    try {
        if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
            console.warn('Pinata API keys no configuradas');
            return false;
        }

        await axios.delete(
            `https://api.pinata.cloud/pinning/unpin/${hash}`,
            {
                headers: {
                    'pinata_api_key': PINATA_API_KEY,
                    'pinata_secret_api_key': PINATA_SECRET_KEY
                }
            }
        );

        return true;
    } catch (error) {
        console.error('Error al desanclar de IPFS:', error.message);
        return false;
    }
}

/**
 * Verifica si las credenciales de Pinata están configuradas
 * @returns {boolean}
 */
function isPinataConfigured() {
    return !!(PINATA_API_KEY && PINATA_SECRET_KEY);
}

module.exports = {
    uploadToIPFS,
    uploadToIPFSMock,
    getIPFSFileInfo,
    unpinFromIPFS,
    isPinataConfigured
};
