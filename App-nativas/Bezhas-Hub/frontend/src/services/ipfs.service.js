/**
 * IPFS Service for BeZhas RWA
 * Handles document uploads to IPFS using Pinata
 */

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY || '';
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

/**
 * Upload a file to IPFS via Pinata
 * @param {File} file - File object from input
 * @param {string} name - Optional custom name
 * @returns {Promise<{success: boolean, cid: string, url: string}>}
 */
export async function uploadToIPFS(file, name = '') {
    try {
        // Validar archivo
        if (!file) {
            throw new Error('No file provided');
        }

        // Si no hay API keys configuradas, usar modo mock
        if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
            console.warn('⚠️ Pinata not configured, using mock CID');
            return uploadToIPFSMock(file, name);
        }

        const formData = new FormData();
        formData.append('file', file);

        // Metadata
        const metadata = JSON.stringify({
            name: name || file.name,
            keyvalues: {
                uploadedBy: 'BeZhas',
                timestamp: new Date().toISOString(),
                type: 'RWA_Legal_Document'
            }
        });
        formData.append('pinataMetadata', metadata);

        // Options
        const options = JSON.stringify({
            cidVersion: 1
        });
        formData.append('pinataOptions', options);

        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_KEY
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upload failed');
        }

        const data = await response.json();

        return {
            success: true,
            cid: data.IpfsHash,
            url: `${PINATA_GATEWAY}${data.IpfsHash}`,
            size: file.size,
            name: file.name
        };

    } catch (error) {
        console.error('IPFS upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Upload multiple files to IPFS
 * @param {FileList|Array<File>} files - Array of files
 * @returns {Promise<Array<{cid: string, url: string, name: string}>>}
 */
export async function uploadMultipleToIPFS(files) {
    const uploadPromises = Array.from(files).map(file => uploadToIPFS(file));
    const results = await Promise.all(uploadPromises);
    return results.filter(r => r.success);
}

/**
 * Upload JSON metadata to IPFS
 * @param {Object} metadata - JSON object
 * @returns {Promise<{success: boolean, cid: string, url: string}>}
 */
export async function uploadJSONToIPFS(metadata) {
    try {
        if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
            console.warn('⚠️ Pinata not configured, using mock CID');
            return {
                success: true,
                cid: 'Qm' + Math.random().toString(36).substring(7),
                url: 'https://mock-ipfs.com/json'
            };
        }

        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_KEY
            },
            body: JSON.stringify({
                pinataContent: metadata,
                pinataMetadata: {
                    name: 'RWA_Metadata',
                    keyvalues: {
                        type: 'metadata',
                        timestamp: new Date().toISOString()
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error('JSON upload failed');
        }

        const data = await response.json();

        return {
            success: true,
            cid: data.IpfsHash,
            url: `${PINATA_GATEWAY}${data.IpfsHash}`
        };

    } catch (error) {
        console.error('JSON upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Mock function for development without Pinata
 */
function uploadToIPFSMock(file, name) {
    // Generar CID falso pero realista
    const mockCID = 'Qm' + Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

    console.log('📦 Mock IPFS Upload:', {
        file: file.name,
        size: file.size,
        cid: mockCID
    });

    return Promise.resolve({
        success: true,
        cid: mockCID,
        url: `https://gateway.pinata.cloud/ipfs/${mockCID}`,
        size: file.size,
        name: file.name,
        isMock: true
    });
}

/**
 * Get file from IPFS
 * @param {string} cid - IPFS CID
 * @returns {string} Full IPFS URL
 */
export function getIPFSUrl(cid) {
    if (!cid) return '';
    if (cid.startsWith('http')) return cid;
    return `${PINATA_GATEWAY}${cid}`;
}

/**
 * Validate file before upload
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateFile(file, options = {}) {
    const {
        maxSize = 100 * 1024 * 1024, // 100MB default
        allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    } = options;

    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File too large. Max size: ${(maxSize / 1024 / 1024).toFixed(0)}MB`
        };
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`
        };
    }

    return { valid: true };
}

export const ipfsService = {
    uploadToIPFS,
    uploadMultipleToIPFS,
    uploadJSONToIPFS,
    getIPFSUrl,
    validateFile
};

export default ipfsService;
