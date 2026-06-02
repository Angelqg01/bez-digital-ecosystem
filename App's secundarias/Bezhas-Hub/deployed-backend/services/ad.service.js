// backend/services/adService.js
// Servicio para eventos de anuncios y liquidación
const events = [];

const { broadcastAdEvent } = require('../websocket-server');

async function getActiveCampaigns() {
    // Simulación: deberías consultar la base de datos
    return [
        { id: 1, image: '/ads/ad1.png', text: 'Ad DeFi', link: 'https://defi.com', keywords: ['DeFi', 'crypto'] },
        { id: 2, image: '/ads/ad2.png', text: 'Ad NFT', link: 'https://nft.com', keywords: ['NFT', 'art'] }
    ];
}

async function logAdEvent(campaignId, ip, type, userId = null) {
    const eventId = Date.now() + '-' + Math.random();
    const event = { eventId, campaignId, ip, type, userId, timestamp: Date.now() };
    events.push(event);
    // Emitir evento por WebSocket filtrado por campaña/usuario
    broadcastAdEvent({
        type,
        message: `Evento ${type} en campaña ${campaignId}${userId ? ' por usuario ' + userId : ''}`,
        campaignId,
        userId,
        timestamp: event.timestamp
    });
    return eventId;
}

async function verifyAdEvent(eventId, type, userId, ip) {
    const recent = events.filter(e => e.ip === ip && e.type === type && Date.now() - e.timestamp < 60000);
    if (recent.length > 5) return false;
    // Emitir evento de recompensa si es clic
    if (type === 'click') {
        broadcastAdEvent({
            type: 'Recompensa',
            message: `Recompensa generada por clic en campaña ${recent[0]?.campaignId || ''}`,
            campaignId: recent[0]?.campaignId,
            userId,
            timestamp: Date.now()
        });
    }
    return true;
}

// Filtro avanzado para obtener eventos por usuario/campaña
function getEventsByFilter({ userId, campaignId }) {
    return events.filter(e =>
        (!userId || e.userId === userId) &&
        (!campaignId || e.campaignId === campaignId)
    );
}

module.exports = { getActiveCampaigns, logAdEvent, verifyAdEvent, getEventsByFilter };
