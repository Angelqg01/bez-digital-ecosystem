const express = require('express');
const { PrismaClient } = require('@prisma/client');
// const { syncPluginsFromGithub } = require('../services/githubSyncService'); // Removed
const { validateAdminSignature } = require('../middleware/authAdmin');
const UnifiedAI = require('../services/unified-ai.service');

const router = express.Router();
const prisma = new PrismaClient();

// Listar todos los plugins
router.get('/', async (req, res) => {
    try {
        const plugins = await prisma.plugin.findMany({
            include: {
                currentVersion: true,
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            }
        });
        res.json(plugins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sincronizar con GitHub (Requiere firma Admin)
router.post('/sync', validateAdminSignature, async (req, res) => {
    try {
        await syncPluginsFromGithub();
        res.json({ message: 'Sincronización completada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener consejo de IA para actualización
router.get('/:id/advice', validateAdminSignature, async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Obtener datos del plugin y sus versiones
        const plugin = await prisma.plugin.findUnique({
            where: { id },
            include: {
                currentVersion: true,
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1 // La última versión disponible
                }
            }
        });

        if (!plugin) return res.status(404).json({ error: 'Plugin no encontrado' });

        const latestVersion = plugin.versions[0];
        const currentVersionTag = plugin.currentVersion?.versionTag || '0.0.0';

        if (!latestVersion) {
            return res.json({
                advice: {
                    riskLevel: "low",
                    summary: "No hay versiones disponibles.",
                    recommendation: "Nada que actualizar.",
                    breakingChanges: []
                }
            });
        }

        if (latestVersion.versionTag === currentVersionTag) {
            return res.json({
                advice: {
                    riskLevel: "low",
                    summary: "El plugin ya está actualizado.",
                    recommendation: "Mantener versión actual.",
                    breakingChanges: []
                }
            });
        }

        // 2. Consultar al servicio de IA unificado
        const advice = await UnifiedAI.process('CHAT', {
            message: `Analiza esta actualización de plugin:\n
Plugin: ${plugin.name}\nVersión actual: ${currentVersionTag}\nVersión nueva: ${latestVersion.versionTag}\nChangelog: ${latestVersion.changelog || "No disponible"}\n\n¿Es recomendable actualizar? Explica beneficios y riesgos.`,
            context: { userId: 'system', task: 'plugin-analysis' }
        });

        res.json({ advice });

    } catch (error) {
        console.error('AI Advice Error:', error);
        res.status(500).json({ error: 'Error obteniendo consejo de IA' });
    }
});

// Actualizar plugin individual
router.patch('/:id/update', validateAdminSignature, async (req, res) => {
    const { id } = req.params;
    const { versionId } = req.body;
    const { address } = req.headers;

    try {
        const plugin = await prisma.plugin.findUnique({ where: { id } });
        if (!plugin) return res.status(404).json({ error: 'Plugin no encontrado' });

        const version = await prisma.pluginVersion.findUnique({ where: { id: versionId } });
        if (!version) return res.status(404).json({ error: 'Versión no encontrada' });

        // Actualizar puntero
        await prisma.plugin.update({
            where: { id },
            data: { currentVersionId: versionId }
        });

        // Log de auditoría
        await prisma.updateLog.create({
            data: {
                pluginId: id,
                adminWallet: address,
                action: 'UPDATE',
                fromVersion: plugin.currentVersionId,
                toVersion: versionId,
                status: 'SUCCESS'
            }
        });

        res.json({ message: `Plugin actualizado a ${version.versionTag}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rollback a versión estable anterior
router.patch('/:id/rollback', validateAdminSignature, async (req, res) => {
    const { id } = req.params;
    const { address } = req.headers;

    try {
        const plugin = await prisma.plugin.findUnique({
            where: { id },
            include: { currentVersion: true }
        });

        if (!plugin) return res.status(404).json({ error: 'Plugin no encontrado' });

        // Buscar la última versión estable anterior a la actual
        const stableVersion = await prisma.pluginVersion.findFirst({
            where: {
                pluginId: id,
                isStable: true,
                createdAt: { lt: plugin.currentVersion?.createdAt || new Date() }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!stableVersion) {
            return res.status(400).json({ error: 'No se encontró una versión estable anterior para rollback' });
        }

        // Ejecutar Rollback
        await prisma.plugin.update({
            where: { id },
            data: { currentVersionId: stableVersion.id }
        });

        // Log
        await prisma.updateLog.create({
            data: {
                pluginId: id,
                adminWallet: address,
                action: 'ROLLBACK',
                fromVersion: plugin.currentVersionId,
                toVersion: stableVersion.id,
                status: 'SUCCESS'
            }
        });

        res.json({ message: `Rollback exitoso a ${stableVersion.versionTag}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update All (Actualización Masiva)
router.post('/update-all', validateAdminSignature, async (req, res) => {
    const { address } = req.headers;

    try {
        const plugins = await prisma.plugin.findMany();
        const results = [];

        for (const plugin of plugins) {
            // Buscar la versión más reciente
            const latestVersion = await prisma.pluginVersion.findFirst({
                where: { pluginId: plugin.id },
                orderBy: { createdAt: 'desc' }
            });

            if (latestVersion && latestVersion.id !== plugin.currentVersionId) {
                await prisma.plugin.update({
                    where: { id: plugin.id },
                    data: { currentVersionId: latestVersion.id }
                });

                await prisma.updateLog.create({
                    data: {
                        pluginId: plugin.id,
                        adminWallet: address,
                        action: 'UPDATE',
                        fromVersion: plugin.currentVersionId,
                        toVersion: latestVersion.id,
                        status: 'SUCCESS'
                    }
                });

                results.push(`${plugin.name}: Updated to ${latestVersion.versionTag}`);
            }
        }

        res.json({ message: 'Proceso de actualización masiva completado', details: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;