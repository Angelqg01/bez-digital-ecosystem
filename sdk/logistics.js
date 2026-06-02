/**
 * ============================================================================
 * BEZHAS SDK - LOGISTICS MODULE
 * ============================================================================
 * 
 * Módulo para gestión de cadena de suministro y logística
 * Integra con Maersk, FedEx, DHL y otros carriers
 */

const axios = require('axios');

class LogisticsManager {
    /**
     * @param {Object} config - Configuración del SDK
     * @param {string} config.apiUrl - URL del backend API
     * @param {string} config.apiKey - API Key para autenticación
     */
    constructor(config) {
        this.apiUrl = config.apiUrl || 'http://localhost:3001';
        this.apiKey = config.apiKey;
        this.axios = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'X-API-Key': this.apiKey })
            }
        });
    }

    /**
     * Crea un nuevo envío
     * @param {Object} shipmentData - Datos del envío
     * @param {string} shipmentData.carrier - Carrier (maersk, fedex, dhl, etc.)
     * @param {Object} shipmentData.origin - Origen del envío
     * @param {Object} shipmentData.destination - Destino del envío
     * @param {Array} shipmentData.items - Items del envío
     * @returns {Promise<Object>} Información del envío creado
     */
    async createShipment(shipmentData) {
        try {
            const response = await this.axios.post('/api/logistics/shipments', shipmentData);

            return {
                success: true,
                shipmentId: response.data.shipmentId,
                trackingNumber: response.data.trackingNumber,
                carrier: shipmentData.carrier,
                estimatedDelivery: response.data.estimatedDelivery
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Rastrea un envío
     * @param {string} shipmentId - ID del envío o tracking number
     * @returns {Promise<Object>} Estado del envío
     */
    async trackShipment(shipmentId) {
        try {
            const response = await this.axios.get(`/api/logistics/shipments/${shipmentId}/track`);

            return {
                success: true,
                shipmentId,
                status: response.data.status,
                currentLocation: response.data.currentLocation,
                history: response.data.history,
                estimatedDelivery: response.data.estimatedDelivery,
                carrier: response.data.carrier
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Actualiza el estado de un envío
     * @param {string} shipmentId - ID del envío
     * @param {string} status - Nuevo estado
     * @param {Object} metadata - Metadata adicional
     * @returns {Promise<Object>} Resultado de la actualización
     */
    async updateShipmentStatus(shipmentId, status, metadata = {}) {
        try {
            const response = await this.axios.patch(`/api/logistics/shipments/${shipmentId}/status`, {
                status,
                metadata
            });

            return {
                success: true,
                shipmentId,
                status: response.data.status,
                updatedAt: response.data.updatedAt
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Obtiene el historial completo de un envío
     * @param {string} shipmentId - ID del envío
     * @returns {Promise<Object>} Historial del envío
     */
    async getShipmentHistory(shipmentId) {
        try {
            const response = await this.axios.get(`/api/logistics/shipments/${shipmentId}/history`);

            return {
                success: true,
                shipmentId,
                history: response.data.history,
                events: response.data.events
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Integra con un carrier específico
     * @param {string} carrierName - Nombre del carrier (maersk, fedex, dhl)
     * @param {Object} credentials - Credenciales del carrier
     * @returns {Promise<Object>} Resultado de la integración
     */
    async integrateCarrier(carrierName, credentials) {
        try {
            const response = await this.axios.post('/api/logistics/carriers/integrate', {
                carrier: carrierName,
                credentials
            });

            return {
                success: true,
                carrier: carrierName,
                integrated: response.data.integrated,
                message: response.data.message
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Obtiene tarifas de envío
     * @param {Object} quoteData - Datos para cotización
     * @param {Object} quoteData.origin - Origen
     * @param {Object} quoteData.destination - Destino
     * @param {Object} quoteData.package - Información del paquete
     * @returns {Promise<Object>} Cotización de envío
     */
    async getShippingQuote(quoteData) {
        try {
            const response = await this.axios.post('/api/logistics/quote', quoteData);

            return {
                success: true,
                quotes: response.data.quotes,
                cheapest: response.data.cheapest,
                fastest: response.data.fastest
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Lista todos los envíos del usuario
     * @param {Object} filters - Filtros opcionales
     * @returns {Promise<Object>} Lista de envíos
     */
    async listShipments(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await this.axios.get(`/api/logistics/shipments?${queryParams}`);

            return {
                success: true,
                shipments: response.data.shipments,
                total: response.data.total,
                page: response.data.page
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Genera etiqueta de envío
     * @param {string} shipmentId - ID del envío
     * @param {string} format - Formato de la etiqueta (pdf, png, zpl)
     * @returns {Promise<Object>} URL de la etiqueta
     */
    async generateLabel(shipmentId, format = 'pdf') {
        try {
            const response = await this.axios.post(`/api/logistics/shipments/${shipmentId}/label`, {
                format
            });

            return {
                success: true,
                shipmentId,
                labelUrl: response.data.labelUrl,
                format
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Cancela un envío
     * @param {string} shipmentId - ID del envío
     * @returns {Promise<Object>} Resultado de la cancelación
     */
    async cancelShipment(shipmentId) {
        try {
            const response = await this.axios.delete(`/api/logistics/shipments/${shipmentId}`);

            return {
                success: true,
                shipmentId,
                cancelled: true,
                message: response.data.message
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

module.exports = LogisticsManager;
