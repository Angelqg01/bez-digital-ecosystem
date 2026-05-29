// Uses shared http client for consistent auth (wallet header + JWT + interceptors)
import http from './http';

// Alias for backward compatibility - all requests go through the shared client
const api = http;

// ====================
// ADVERTISER PROFILE
// ====================

export const advertiserProfileService = {
    // Crear o actualizar perfil
    createOrUpdateProfile: async (profileData) => {
        const response = await api.post('/api/advertiser-profile', profileData);
        return response.data;
    },

    // Obtener perfil
    getProfile: async () => {
        const response = await api.get('/api/advertiser-profile');
        return response.data;
    },

    // Verificar si tiene perfil
    checkProfile: async () => {
        const response = await api.get('/api/advertiser-profile/check');
        return response.data;
    }
};

// ====================
// CAMPAIGNS
// ====================

export const campaignsService = {
    // Subir imagen de creatividad
    uploadCreative: async (file) => {
        const formData = new FormData();
        formData.append('image', file);

        const response = await api.post('/api/campaigns/upload-creative', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // Crear campaña
    createCampaign: async (campaignData) => {
        const response = await api.post('/api/campaigns', campaignData);
        return response.data;
    },

    // Obtener campañas
    getCampaigns: async (params = {}) => {
        const response = await api.get('/api/campaigns', { params });
        return response.data;
    },

    // Obtener campaña específica
    getCampaign: async (id) => {
        const response = await api.get(`/api/campaigns/${id}`);
        return response.data;
    },

    // Actualizar campaña
    updateCampaign: async (id, data) => {
        const response = await api.put(`/api/campaigns/${id}`, data);
        return response.data;
    },

    // Pausar campaña
    pauseCampaign: async (id) => {
        const response = await api.put(`/api/campaigns/${id}`, { action: 'pause' });
        return response.data;
    },

    // Reanudar campaña
    resumeCampaign: async (id) => {
        const response = await api.put(`/api/campaigns/${id}`, { action: 'resume' });
        return response.data;
    },

    // Eliminar campaña
    deleteCampaign: async (id) => {
        const response = await api.delete(`/api/campaigns/${id}`);
        return response.data;
    },

    // Obtener analytics
    getCampaignAnalytics: async (id) => {
        const response = await api.get(`/api/campaigns/${id}/analytics`);
        return response.data;
    },

    // Obtener resumen
    getCampaignsSummary: async () => {
        const response = await api.get('/api/campaigns/stats/summary');
        return response.data;
    }
};

// ====================
// BILLING
// ====================

export const billingService = {
    // Añadir fondos FIAT
    addFiatFunds: async (amount) => {
        const response = await api.post('/api/billing/add-fiat-funds', { amount });
        return response.data;
    },

    // Añadir fondos BEZ
    addBezFunds: async (amount, txHash) => {
        const response = await api.post('/api/billing/add-bez-funds', { amount, txHash });
        return response.data;
    },

    // Obtener balance
    getBalance: async () => {
        const response = await api.get('/api/billing/balance');
        return response.data;
    },

    // Obtener historial
    getHistory: async (params = {}) => {
        const response = await api.get('/api/billing/history', { params });
        return response.data;
    },

    // Estimar consumo IA antes de ejecutar un job
    estimateAIUsage: async (model, usage) => {
        const response = await api.post('/api/billing/ai/estimate', { model, usage });
        return response.data;
    },

    // Registrar y cobrar consumo IA real
    chargeAIUsage: async ({ model, usage, feature, projectId }) => {
        const response = await api.post('/api/billing/ai/charge', { model, usage, feature, projectId });
        return response.data;
    },

    // Resumen de saldo y consumo IA para dashboard
    getAIUsageSummary: async () => {
        const response = await api.get('/api/billing/ai/summary');
        return response.data;
    }
};

// ====================
// ADMIN ADS
// ====================

export const adminAdsService = {
    // Obtener cola de aprobación
    getPendingQueue: async (params = {}) => {
        const response = await api.get('/api/admin/ads/pending-queue', { params });
        return response.data;
    },

    // Aprobar campaña
    approveCampaign: async (id) => {
        const response = await api.post(`/api/admin/ads/approve/${id}`);
        return response.data;
    },

    // Rechazar campaña
    rejectCampaign: async (id, reason) => {
        const response = await api.post(`/api/admin/ads/reject/${id}`, { reason });
        return response.data;
    },

    // Obtener todas las campañas
    getAllCampaigns: async (params = {}) => {
        const response = await api.get('/api/admin/ads/all-campaigns', { params });
        return response.data;
    },

    // Toggle campaña
    toggleCampaign: async (id, action, reason = '') => {
        const response = await api.post(`/api/admin/ads/toggle-campaign/${id}`, { action, reason });
        return response.data;
    },

    // Obtener anunciantes
    getAdvertisers: async (params = {}) => {
        const response = await api.get('/api/admin/ads/advertisers', { params });
        return response.data;
    },

    // Suspender/Reactivar anunciante
    suspendAdvertiser: async (id, suspend, reason = '') => {
        const response = await api.post(`/api/admin/ads/suspend-advertiser/${id}`, { suspend, reason });
        return response.data;
    }
};

export default {
    advertiserProfile: advertiserProfileService,
    campaigns: campaignsService,
    billing: billingService,
    adminAds: adminAdsService
};
