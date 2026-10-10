/**
 * Energy Module - BeZhas Universal SDK
 * Gestión de energía renovable y créditos
 */

class EnergyModule {
    constructor(config) {
        this.config = config;
        this.baseURL = config.baseURL || 'https://api.bezhas.com';
        this.apiKey = config.apiKey;
    }

    async tradeEnergyCredits(tradeData) {
        const response = await fetch(`${this.baseURL}/v1/energy/credits/trade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                amount: tradeData.amount,
                price: tradeData.price,
                type: tradeData.type, // 'buy', 'sell'
                creditType: tradeData.creditType // 'solar', 'wind', 'hydro'
            })
        });

        return response.json();
    }

    async trackConsumption(meterId, period) {
        const response = await fetch(
            `${this.baseURL}/v1/energy/consumption/${meterId}?period=${period}`,
            {
                headers: { 'X-API-Key': this.apiKey }
            }
        );

        return response.json();
    }

    async balanceGrid(gridData) {
        const response = await fetch(`${this.baseURL}/v1/energy/grid/balance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify(gridData)
        });

        return response.json();
    }

    async certifyRenewable(facilityId, certificationData) {
        const response = await fetch(`${this.baseURL}/v1/energy/renewable/certify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                facilityId,
                energyType: certificationData.type,
                capacity: certificationData.capacity,
                certifier: certificationData.certifier
            })
        });

        return response.json();
    }

    async readMeters(meterId) {
        const response = await fetch(`${this.baseURL}/v1/energy/meters/${meterId}`, {
            headers: { 'X-API-Key': this.apiKey }
        });

        return response.json();
    }
}

module.exports = EnergyModule;
