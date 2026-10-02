/**
 * Real Estate Module - BeZhas Universal SDK
 * Tokenización y gestión de propiedades inmobiliarias
 */

class RealEstateModule {
    constructor(config) {
        this.config = config;
        this.baseURL = config.baseURL || 'https://api.bezhas.com';
        this.apiKey = config.apiKey;
    }

    /**
     * Tokenizar una propiedad inmobiliaria
     * @param {Object} propertyData - Datos de la propiedad
     * @returns {Promise<Object>} Datos del NFT creado
     */
    async tokenizeProperty(propertyData) {
        const response = await fetch(`${this.baseURL}/v1/realestate/tokenize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                address: propertyData.address,
                valuation: propertyData.valuation,
                fractions: propertyData.fractions || 1000,
                metadata: {
                    type: propertyData.type, // 'residential', 'commercial', 'land'
                    sqMeters: propertyData.sqMeters,
                    bedrooms: propertyData.bedrooms,
                    bathrooms: propertyData.bathrooms,
                    images: propertyData.images,
                    documents: propertyData.documents // Title deed, appraisal, etc.
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Tokenization failed: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Fraccionar propiedad existente (crear shares)
     * @param {string} propertyId - ID del NFT de propiedad
     * @param {number} totalShares - Número total de fracciones
     * @returns {Promise<Object>} Información de las fracciones
     */
    async fractionateProperty(propertyId, totalShares) {
        const response = await fetch(`${this.baseURL}/v1/realestate/${propertyId}/fractionate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({ totalShares })
        });

        if (!response.ok) {
            throw new Error(`Fractionate failed: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Gestionar propiedad (actualizar datos)
     * @param {string} propertyId - ID de la propiedad
     * @param {Object} updates - Datos a actualizar
     * @returns {Promise<Object>}
     */
    async manageProperty(propertyId, updates) {
        const response = await fetch(`${this.baseURL}/v1/realestate/${propertyId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify(updates)
        });

        return response.json();
    }

    /**
     * Recolectar renta automática
     * @param {string} propertyId - ID de la propiedad
     * @param {Object} rentData - Datos de la renta
     * @returns {Promise<Object>}
     */
    async collectRent(propertyId, rentData) {
        const response = await fetch(`${this.baseURL}/v1/realestate/${propertyId}/rent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                amount: rentData.amount,
                currency: rentData.currency || 'USDC',
                period: rentData.period, // 'monthly', 'quarterly'
                recipients: rentData.recipients // Array de holders
            })
        });

        return response.json();
    }

    /**
     * Obtener propiedades del usuario
     * @param {string} ownerAddress - Dirección de la wallet
     * @returns {Promise<Array>}
     */
    async getUserProperties(ownerAddress) {
        const response = await fetch(
            `${this.baseURL}/v1/realestate/properties?owner=${ownerAddress}`,
            {
                headers: { 'X-API-Key': this.apiKey }
            }
        );

        return response.json();
    }

    /**
     * Obtener historial de rentas
     * @param {string} propertyId - ID de la propiedad
     * @returns {Promise<Array>}
     */
    async getRentHistory(propertyId) {
        const response = await fetch(
            `${this.baseURL}/v1/realestate/${propertyId}/rent-history`,
            {
                headers: { 'X-API-Key': this.apiKey }
            }
        );

        return response.json();
    }
}

module.exports = RealEstateModule;
