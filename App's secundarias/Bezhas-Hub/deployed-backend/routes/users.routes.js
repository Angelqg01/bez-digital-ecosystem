const express = require('express');
const router = express.Router();
const { User } = require('../models/mockModels');
const { requireAuth, requireOwnership } = require('../middleware/auth.middleware');
const { userProfileSchema } = require('../lib/validations/user.validation');

// Base de datos en memoria para perfiles y actividad
const userProfiles = new Map();
const userActivity = new Map();

// Obtener perfil de usuario por dirección de wallet
router.get('/profile/:address', async (req, res) => {
    try {
        const { address } = req.params;

        // Buscar usuario en el modelo
        let user = await User.findOne({ walletAddress: address.toLowerCase() });

        if (!user) {
            // Crear usuario predeterminado si no existe
            user = new User({
                walletAddress: address.toLowerCase(),
                username: `User${address.slice(2, 8)}`,
                bio: '',
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`,
                stats: {
                    totalVisits: 0,
                    sectionsViewed: 0,
                    totalTimeSpent: 0,
                    totalInteractions: 0,
                    lastVisit: null
                }
            });
            await user.save();
        }

        // Construir respuesta con estadísticas
        const profile = {
            _id: user._id,
            address: user.walletAddress,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            bio: user.bio,
            email: user.email,
            avatarUrl: user.avatarUrl,
            coverUrl: user.coverUrl,
            interests: user.interests,
            role: user.role,
            subscription: user.subscription,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            stats: user.stats || {
                totalVisits: 0,
                sectionsViewed: 0,
                totalTimeSpent: 0,
                totalInteractions: 0,
                lastVisit: null
            }
        };

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener el perfil del usuario'
        });
    }
});

// Actualizar perfil de usuario
router.put('/profile/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const updates = req.body;

        // Validate input with Zod
        const validation = userProfileSchema.safeParse(updates);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid profile data',
                details: validation.error.errors
            });
        }

        // Find user
        let user = await User.findOne({ walletAddress: address.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Perfil no encontrado'
            });
        }

        // Update only allowed fields
        const allowedUpdates = ['username', 'firstName', 'lastName', 'bio', 'email', 'avatarUrl', 'coverUrl', 'interests'];
        allowedUpdates.forEach(field => {
            if (validation.data[field] !== undefined) {
                user[field] = validation.data[field];
            }
        });

        user.updatedAt = new Date().toISOString();
        await user.save();

        const profile = {
            _id: user._id,
            address: user.walletAddress,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            bio: user.bio,
            email: user.email,
            avatarUrl: user.avatarUrl,
            coverUrl: user.coverUrl,
            interests: user.interests,
            updatedAt: user.updatedAt
        };

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar el perfil'
        });
    }
});

// Registrar visita a la página
router.post('/track-visit', async (req, res) => {
    try {
        const { address, page } = req.body;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Dirección de wallet requerida'
            });
        }

        // Actualizar estadísticas del perfil
        let profile = userProfiles.get(address.toLowerCase());
        if (profile) {
            profile.stats.totalVisits += 1;
            profile.stats.lastVisit = new Date().toISOString();
            userProfiles.set(address.toLowerCase(), profile);
        }

        // Registrar actividad
        const activityKey = `${address.toLowerCase()}_${Date.now()}`;
        userActivity.set(activityKey, {
            address: address.toLowerCase(),
            type: 'page_visit',
            page: page || 'about',
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Visita registrada correctamente'
        });
    } catch (error) {
        console.error('Error tracking visit:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar la visita'
        });
    }
});

// Sincronizar actividad del usuario
router.post('/sync-activity', async (req, res) => {
    try {
        const { address, sectionsViewed, timeSpent, interactions } = req.body;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Dirección de wallet requerida'
            });
        }

        // Actualizar estadísticas del perfil
        let profile = userProfiles.get(address.toLowerCase());
        if (profile) {
            profile.stats.sectionsViewed = Math.max(
                profile.stats.sectionsViewed,
                sectionsViewed || 0
            );
            profile.stats.totalTimeSpent += timeSpent || 0;
            profile.stats.totalInteractions += interactions || 0;
            userProfiles.set(address.toLowerCase(), profile);
        }

        // Registrar sincronización
        const activityKey = `${address.toLowerCase()}_sync_${Date.now()}`;
        userActivity.set(activityKey, {
            address: address.toLowerCase(),
            type: 'activity_sync',
            data: { sectionsViewed, timeSpent, interactions },
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Actividad sincronizada correctamente',
            profile
        });
    } catch (error) {
        console.error('Error syncing activity:', error);
        res.status(500).json({
            success: false,
            error: 'Error al sincronizar actividad'
        });
    }
});

// Registrar interacción específica
router.post('/track-interaction', async (req, res) => {
    try {
        const { address, action, sectionId, metadata } = req.body;

        if (!address || !action) {
            return res.status(400).json({
                success: false,
                error: 'Dirección y acción son requeridas'
            });
        }

        // Actualizar contador de interacciones
        let profile = userProfiles.get(address.toLowerCase());
        if (profile) {
            profile.stats.totalInteractions += 1;
            userProfiles.set(address.toLowerCase(), profile);
        }

        // Registrar la interacción
        const activityKey = `${address.toLowerCase()}_interaction_${Date.now()}`;
        userActivity.set(activityKey, {
            address: address.toLowerCase(),
            type: 'interaction',
            action,
            sectionId,
            metadata,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Interacción registrada correctamente'
        });
    } catch (error) {
        console.error('Error tracking interaction:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar la interacción'
        });
    }
});

// Obtener historial de actividad del usuario
router.get('/activity/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const { limit = 50, type } = req.query;

        // Filtrar actividades del usuario
        const activities = Array.from(userActivity.entries())
            .filter(([_, activity]) => activity.address === address.toLowerCase())
            .filter(([_, activity]) => !type || activity.type === type)
            .map(([key, activity]) => ({ id: key, ...activity }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, parseInt(limit));

        res.json({
            success: true,
            activities,
            total: activities.length
        });
    } catch (error) {
        console.error('Error getting user activity:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener el historial de actividad'
        });
    }
});

// Obtener estadísticas agregadas
router.get('/stats/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const profile = userProfiles.get(address.toLowerCase());

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Perfil no encontrado'
            });
        }

        // Calcular estadísticas adicionales
        const activities = Array.from(userActivity.entries())
            .filter(([_, activity]) => activity.address === address.toLowerCase());

        const stats = {
            ...profile.stats,
            totalActivities: activities.length,
            activityByType: activities.reduce((acc, [_, activity]) => {
                acc[activity.type] = (acc[activity.type] || 0) + 1;
                return acc;
            }, {}),
            avgTimePerVisit: profile.stats.totalVisits > 0
                ? Math.round(profile.stats.totalTimeSpent / profile.stats.totalVisits)
                : 0
        };

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener las estadísticas'
        });
    }
});

module.exports = router;
