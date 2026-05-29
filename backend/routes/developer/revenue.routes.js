const express = require('express');
const router = express.Router();
const BridgeOrder = require('../../models/BridgeOrder.model');
const AuditLog = require('../../models/pg/AuditLog');
const User = require('../../models/pg/User');
const logger = require('../../utils/logger');
const auth = require('../../middleware/auth'); // Asegúrate que este middleware exista para proteger la ruta

/**
 * GET /api/developer/revenue/stats
 * Obtiene las estadísticas de ingresos para el desarrollador autenticado
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user._id; // Obtenido del token JWT
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 1. Obtener órdenes pagadas del bridge donde el usuario sea el vendedor
        // En una implementación real buscaríamos por el beZhasId del vendedor que coincida con el usuario
        const sales = await BridgeOrder.find({
            // 'seller.beZhasId': `BEZ_USER_${userId}`, // Ejemplo de filtrado por ID de usuario
            paymentStatus: 'paid'
        }).sort({ createdAt: -1 });

        // 2. Calcular totales
        const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
        const totalSalesCount = sales.length;

        // 3. Obtener historial de reputación (recompensas on-chain)
        // Buscamos en el AuditLog acciones de 'mintReputation' para este usuario
        const reputationLogs = await AuditLog.find({
            userId: userId,
            action: 'mintReputation'
        }).sort({ createdAt: -1 }).limit(10);

        // 4. Agrupar ingresos por plataforma
        const platformStats = {};
        sales.forEach(sale => {
            platformStats[sale.platform] = (platformStats[sale.platform] || 0) + sale.totalAmount;
        });

        // 5. Datos para el gráfico (últimos 7 días)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const chartData = await BridgeOrder.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo }, paymentStatus: 'paid' } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                amount: { $sum: "$totalAmount" }
            }},
            { $sort: { "_id": 1 } }
        ]);

        res.json({
            success: true,
            stats: {
                totalRevenue,
                totalSalesCount,
                currency: 'EUR',
                reputationPoints: user.reputation || 0,
                platformBreakdown: platformStats
            },
            recentTransactions: sales.slice(0, 5).map(s => ({
                id: s.beZhasOrderId,
                platform: s.platform,
                amount: s.totalAmount,
                status: s.status,
                date: s.createdAt
            })),
            reputationHistory: reputationLogs.map(l => ({
                date: l.createdAt,
                amount: 10, // Default reward per sale
                txHash: l.metadata?.txHash || 'Pending...'
            })),
            chartData: chartData.map(d => ({ date: d._id, amount: d.amount }))
        });

    } catch (error) {
        logger.error({ error }, 'Error fetching revenue stats');
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
