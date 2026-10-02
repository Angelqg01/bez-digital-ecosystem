/**
 * Agriculture Module - BeZhas Universal SDK
 * AgriTech - Certificación orgánica, trazabilidad farm-to-table
 */

class AgricultureModule {
    constructor(config) {
        this.config = config;
        this.baseURL = config.baseURL || 'https://api.bezhas.com';
        this.apiKey = config.apiKey;
    }

    async certifyHarvest(harvestData) {
        const response = await fetch(`${this.baseURL}/v1/agriculture/harvest/certify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                farmId: harvestData.farmId,
                cropType: harvestData.cropType,
                quantity: harvestData.quantity,
                harvestDate: harvestData.date,
                certifier: harvestData.certifier
            })
        });

        return response.json();
    }

    async trackSupplyChain(productId) {
        const response = await fetch(`${this.baseURL}/v1/agriculture/supply/track/${productId}`, {
            headers: { 'X-API-Key': this.apiKey }
        });

        return response.json();
    }

    async tokenizeLand(landData) {
        const response = await fetch(`${this.baseURL}/v1/agriculture/land/tokenize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                coordinates: landData.coordinates,
                size: landData.size,
                soilType: landData.soilType,
                crops: landData.crops
            })
        });

        return response.json();
    }

    async verifyOrganic(farmId, certificationData) {
        const response = await fetch(`${this.baseURL}/v1/agriculture/organic/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                farmId,
                certificationBody: certificationData.body,
                standard: certificationData.standard, // 'USDA_Organic', 'EU_Organic'
                expiresAt: certificationData.expiresAt
            })
        });

        return response.json();
    }

    async readIoTSensors(farmId, sensorType) {
        const response = await fetch(
            `${this.baseURL}/v1/agriculture/iot/sensors/${farmId}?type=${sensorType}`,
            {
                headers: { 'X-API-Key': this.apiKey }
            }
        );

        return response.json();
    }
}

module.exports = AgricultureModule;
