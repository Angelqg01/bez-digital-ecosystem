/**
 * @fileoverview Admin Dependencies Routes
 * @description Endpoints para gestión de dependencias del monorepo
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const pino = require('pino');

const execAsync = promisify(exec);
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Root del proyecto (asumiendo backend está en /backend)
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * GET /api/admin/dependencies
 * Obtiene el estado de todas las dependencias del monorepo
 */
router.get('/', async (req, res) => {
    try {
        const [frontend, backend, root, sdk] = await Promise.all([
            getDependenciesStatus('frontend'),
            getDependenciesStatus('backend'),
            getDependenciesStatus('.'),
            getDependenciesStatus('sdk').catch(() => ({ dependencies: [], devDependencies: [], outdated: [] }))
        ]);

        // Get security audit
        const security = await getSecurityAudit();

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            summary: {
                totalPackages: frontend.dependencies.length + backend.dependencies.length + root.dependencies.length,
                outdated: frontend.outdated.length + backend.outdated.length + root.outdated.length,
                vulnerabilities: security.vulnerabilities?.length || 0,
                criticalVulns: security.vulnerabilities?.filter(v => v.severity === 'critical').length || 0
            },
            modules: {
                frontend: {
                    name: 'Frontend (React/Vite)',
                    path: 'frontend',
                    dependencies: frontend.dependencies,
                    devDependencies: frontend.devDependencies,
                    outdated: frontend.outdated
                },
                backend: {
                    name: 'Backend (Node/Express)',
                    path: 'backend',
                    dependencies: backend.dependencies,
                    devDependencies: backend.devDependencies,
                    outdated: backend.outdated
                },
                root: {
                    name: 'Root (Hardhat/Solidity)',
                    path: '.',
                    dependencies: root.dependencies,
                    devDependencies: root.devDependencies,
                    outdated: root.outdated
                },
                sdk: {
                    name: 'SDK',
                    path: 'sdk',
                    dependencies: sdk.dependencies,
                    devDependencies: sdk.devDependencies,
                    outdated: sdk.outdated
                }
            },
            security
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error getting dependencies');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/admin/dependencies/:workspace
 * Obtiene dependencias de un workspace específico
 */
router.get('/:workspace', async (req, res) => {
    const { workspace } = req.params;
    const validWorkspaces = ['frontend', 'backend', 'root', 'sdk', '.'];

    if (!validWorkspaces.includes(workspace)) {
        return res.status(400).json({
            success: false,
            error: `Workspace inválido. Válidos: ${validWorkspaces.join(', ')}`
        });
    }

    try {
        const workspacePath = workspace === 'root' ? '.' : workspace;
        const data = await getDependenciesStatus(workspacePath);

        res.json({
            success: true,
            workspace,
            ...data
        });
    } catch (error) {
        logger.error({ error: error.message, workspace }, 'Error getting workspace dependencies');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/admin/dependencies/update
 * Actualiza una dependencia específica
 */
router.post('/update', async (req, res) => {
    const { workspace, package: packageName, version } = req.body;

    if (!workspace || !packageName) {
        return res.status(400).json({
            success: false,
            error: 'workspace y package son requeridos'
        });
    }

    try {
        const workspacePath = path.join(PROJECT_ROOT, workspace === 'root' ? '' : workspace);
        const versionSuffix = version ? `@${version}` : '@latest';

        logger.info({ workspace, packageName, version }, 'Updating dependency');

        // Use pnpm to update
        const { stdout, stderr } = await execAsync(
            `pnpm update ${packageName}${versionSuffix}`,
            { cwd: workspacePath, timeout: 120000 }
        );

        res.json({
            success: true,
            message: `${packageName} actualizado exitosamente`,
            output: stdout,
            warnings: stderr
        });
    } catch (error) {
        logger.error({ error: error.message, workspace, packageName }, 'Error updating dependency');
        res.status(500).json({
            success: false,
            error: error.message,
            command: `pnpm update ${packageName}`
        });
    }
});

/**
 * POST /api/admin/dependencies/reinstall
 * Reinstala todas las dependencias de un workspace
 */
router.post('/reinstall', async (req, res) => {
    const { workspace } = req.body;

    if (!workspace) {
        return res.status(400).json({
            success: false,
            error: 'workspace es requerido'
        });
    }

    try {
        const workspacePath = path.join(PROJECT_ROOT, workspace === 'root' ? '' : workspace);

        logger.info({ workspace }, 'Reinstalling dependencies');

        // Use pnpm install --force
        const { stdout, stderr } = await execAsync(
            'pnpm install --force',
            { cwd: workspacePath, timeout: 300000 }
        );

        res.json({
            success: true,
            message: `Dependencias de ${workspace} reinstaladas correctamente`,
            output: stdout,
            warnings: stderr
        });
    } catch (error) {
        logger.error({ error: error.message, workspace }, 'Error reinstalling dependencies');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/admin/dependencies/security
 * Obtiene el reporte de seguridad (audit)
 */
router.get('/security/audit', async (req, res) => {
    try {
        const security = await getSecurityAudit();
        res.json({
            success: true,
            ...security
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function getDependenciesStatus(workspace) {
    const workspacePath = path.join(PROJECT_ROOT, workspace);
    const packageJsonPath = path.join(workspacePath, 'package.json');

    // Read package.json
    let packageJson;
    try {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(content);
    } catch (error) {
        throw new Error(`No se pudo leer package.json de ${workspace}: ${error.message}`);
    }

    const dependencies = [];
    const devDependencies = [];

    // Process dependencies
    if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
            dependencies.push({
                name,
                current: cleanVersion(version),
                wanted: cleanVersion(version),
                type: 'dependency',
                isLocal: version.startsWith('file:') || version.startsWith('link:') || version.startsWith('workspace:')
            });
        }
    }

    // Process devDependencies
    if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
            devDependencies.push({
                name,
                current: cleanVersion(version),
                wanted: cleanVersion(version),
                type: 'devDependency',
                isLocal: version.startsWith('file:') || version.startsWith('link:') || version.startsWith('workspace:')
            });
        }
    }

    // Get outdated packages using pnpm
    let outdated = [];
    try {
        const { stdout } = await execAsync('pnpm outdated --json', {
            cwd: workspacePath,
            timeout: 60000
        });

        if (stdout) {
            const outdatedData = JSON.parse(stdout);

            // pnpm outdated --json returns object with package names as keys
            for (const [pkgName, info] of Object.entries(outdatedData)) {
                outdated.push({
                    name: pkgName,
                    current: info.current || 'unknown',
                    wanted: info.wanted || info.current,
                    latest: info.latest || info.wanted,
                    type: info.dependencyType || 'dependency',
                    updateType: getUpdateType(info.current, info.latest)
                });

                // Update the dependencies/devDependencies arrays with latest info
                const depArray = info.dependencyType === 'devDependencies' ? devDependencies : dependencies;
                const dep = depArray.find(d => d.name === pkgName);
                if (dep) {
                    dep.wanted = info.wanted;
                    dep.latest = info.latest;
                    dep.hasUpdate = info.current !== info.latest;
                }
            }
        }
    } catch (error) {
        // pnpm outdated returns exit code 1 when there are outdated packages
        if (error.stdout) {
            try {
                const outdatedData = JSON.parse(error.stdout);
                for (const [pkgName, info] of Object.entries(outdatedData)) {
                    outdated.push({
                        name: pkgName,
                        current: info.current || 'unknown',
                        wanted: info.wanted || info.current,
                        latest: info.latest || info.wanted,
                        type: info.dependencyType || 'dependency',
                        updateType: getUpdateType(info.current, info.latest)
                    });

                    const depArray = info.dependencyType === 'devDependencies' ? devDependencies : dependencies;
                    const dep = depArray.find(d => d.name === pkgName);
                    if (dep) {
                        dep.wanted = info.wanted;
                        dep.latest = info.latest;
                        dep.hasUpdate = info.current !== info.latest;
                    }
                }
            } catch (parseError) {
                // Not JSON output, ignore
            }
        }
    }

    return {
        name: packageJson.name || workspace,
        version: packageJson.version || '0.0.0',
        dependencies,
        devDependencies,
        outdated
    };
}

async function getSecurityAudit() {
    const vulnerabilities = [];
    let summary = { low: 0, moderate: 0, high: 0, critical: 0 };

    try {
        // Run pnpm audit
        const { stdout, stderr } = await execAsync('pnpm audit --json', {
            cwd: PROJECT_ROOT,
            timeout: 120000
        });

        if (stdout) {
            const auditData = JSON.parse(stdout);

            if (auditData.advisories) {
                for (const [id, advisory] of Object.entries(auditData.advisories)) {
                    vulnerabilities.push({
                        id: advisory.id || id,
                        severity: advisory.severity,
                        title: advisory.title,
                        module: advisory.module_name,
                        vulnerable_versions: advisory.vulnerable_versions,
                        patched_versions: advisory.patched_versions,
                        recommendation: advisory.recommendation,
                        url: advisory.url
                    });

                    // Count by severity
                    if (summary[advisory.severity] !== undefined) {
                        summary[advisory.severity]++;
                    }
                }
            }

            if (auditData.metadata) {
                summary = {
                    ...summary,
                    ...auditData.metadata.vulnerabilities
                };
            }
        }
    } catch (error) {
        // pnpm audit returns exit code 1 when vulnerabilities found
        if (error.stdout) {
            try {
                const auditData = JSON.parse(error.stdout);
                if (auditData.advisories) {
                    for (const [id, advisory] of Object.entries(auditData.advisories)) {
                        vulnerabilities.push({
                            id: advisory.id || id,
                            severity: advisory.severity,
                            title: advisory.title,
                            module: advisory.module_name,
                            vulnerable_versions: advisory.vulnerable_versions,
                            patched_versions: advisory.patched_versions,
                            recommendation: advisory.recommendation,
                            url: advisory.url
                        });

                        if (summary[advisory.severity] !== undefined) {
                            summary[advisory.severity]++;
                        }
                    }
                }
            } catch (parseError) {
                // Not JSON, might be an error message
                logger.warn({ error: error.message }, 'Could not parse audit output');
            }
        }
    }

    return {
        vulnerabilities,
        summary,
        lastAudit: new Date().toISOString()
    };
}

function cleanVersion(version) {
    // Remove ^, ~, >=, etc.
    return version.replace(/^[\^~>=<]+/, '');
}

function getUpdateType(current, latest) {
    if (!current || !latest) return 'unknown';

    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    if (latestParts[0] > currentParts[0]) return 'major';
    if (latestParts[1] > currentParts[1]) return 'minor';
    if (latestParts[2] > currentParts[2]) return 'patch';
    return 'none';
}

module.exports = router;
