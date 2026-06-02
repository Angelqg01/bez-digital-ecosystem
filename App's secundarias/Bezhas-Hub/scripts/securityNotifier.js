/**
 * Security Notifier with Cron Scheduler
 * 
 * Monitors GitHub Security Advisories every 12 hours and sends alerts
 * to Discord/Telegram for critical vulnerabilities in BeZhas stack
 * 
 * Stack monitored: Solidity, React, Next.js, Node.js, OpenZeppelin, Ethers.js
 * 
 * Usage: node scripts/securityNotifier.js
 * Environment Variables:
 * - DISCORD_WEBHOOK_URL: Discord webhook for alerts
 * - TELEGRAM_BOT_TOKEN: Telegram bot token (optional)
 * - TELEGRAM_SECURITY_CHAT_ID: Telegram chat ID (optional)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK_URL || '',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_SECURITY_CHAT_ID || '',

    // Stack keywords to monitor
    STACK_KEYWORDS: [
        'solidity',
        'react',
        'next.js',
        'node.js',
        'nodejs',
        'openzeppelin',
        'ethers',
        'ethers.js',
        'wagmi',
        'viem',
        'express',
        'web3',
        'hardhat',
        'truffle'
    ],

    // Critical packages to monitor
    CRITICAL_PACKAGES: [
        'react',
        'react-dom',
        'ethers',
        'wagmi',
        '@web3modal/wagmi',
        'viem',
        'express',
        'next',
        '@openzeppelin/contracts',
        'hardhat',
        'mongoose',
        'helmet'
    ],

    // Only alert on these severities
    ALERT_SEVERITIES: ['critical', 'high'],

    // Report file
    REPORT_FILE: path.join(__dirname, 'security-alerts.json'),

    // Check interval (milliseconds) - 12 hours
    CHECK_INTERVAL: 12 * 60 * 60 * 1000
};

// ==========================================
// GITHUB SECURITY ADVISORIES API
// ==========================================
class SecurityAdvisoryChecker {
    /**
     * Fetch latest security advisories from GitHub
     */
    static async checkSecurityAdvisories() {
        console.log('🔍 Escaneando nuevas vulnerabilidades en el stack de BeZhas...\n');

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: '/advisories?per_page=50',
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'BeZhas-Security-Sentinel'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const alerts = JSON.parse(data);
                        resolve(alerts);
                    } catch (err) {
                        reject(err);
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }

    /**
     * Filter alerts by stack keywords and severity
     */
    static filterAlerts(alerts) {
        return alerts.filter(alert => {
            // Check if alert matches our stack
            const summary = alert.summary?.toLowerCase() || '';
            const description = alert.description?.toLowerCase() || '';
            const ecosystem = alert.vulnerable_ecosystem?.toLowerCase() || '';

            const matchesStack = CONFIG.STACK_KEYWORDS.some(keyword =>
                summary.includes(keyword) ||
                description.includes(keyword) ||
                ecosystem.includes(keyword)
            );

            // Check if package is in our critical list
            const matchesPackage = alert.vulnerabilities?.some(vuln =>
                CONFIG.CRITICAL_PACKAGES.includes(vuln.package?.name)
            );

            // Check severity
            const isCritical = CONFIG.ALERT_SEVERITIES.includes(
                alert.severity?.toLowerCase()
            );

            return (matchesStack || matchesPackage) && isCritical;
        });
    }
}

// ==========================================
// ALERT SYSTEM
// ==========================================
class AlertSystem {
    /**
     * Send Discord webhook alert
     */
    static async sendDiscordAlert(alert) {
        if (!CONFIG.DISCORD_WEBHOOK) {
            console.log('⚠️  Discord webhook not configured, skipping...');
            return;
        }

        const embed = {
            title: `🚨 ALERTA DE SEGURIDAD: ${alert.summary}`,
            description: `Se ha detectado una vulnerabilidad crítica en un componente del stack.\n\n**Ecosistema:** ${alert.vulnerable_ecosystem || 'N/A'}\n**Severidad:** ${alert.severity?.toUpperCase() || 'UNKNOWN'}`,
            url: alert.html_url || '',
            color: 15158332, // Red
            fields: [
                {
                    name: 'CVE ID',
                    value: alert.cve_id || alert.ghsa_id || 'N/A',
                    inline: true
                },
                {
                    name: 'CVSS Score',
                    value: alert.cvss?.score?.toString() || 'N/A',
                    inline: true
                },
                {
                    name: 'Publicado',
                    value: new Date(alert.published_at).toLocaleDateString('es-ES'),
                    inline: true
                }
            ],
            footer: {
                text: 'BeZhas Security Sentinel'
            },
            timestamp: new Date().toISOString()
        };

        // Add affected packages if available
        if (alert.vulnerabilities && alert.vulnerabilities.length > 0) {
            const packages = alert.vulnerabilities
                .map(v => `• ${v.package?.name || 'Unknown'} (${v.vulnerable_version_range || 'N/A'})`)
                .join('\n');

            embed.fields.push({
                name: 'Paquetes Afectados',
                value: packages.substring(0, 1024) || 'N/A',
                inline: false
            });
        }

        return this._sendWebhook(CONFIG.DISCORD_WEBHOOK, { embeds: [embed] });
    }

    /**
     * Send Telegram alert
     */
    static async sendTelegramAlert(alert) {
        if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
            return;
        }

        const message = `
🚨 *ALERTA DE SEGURIDAD*

*Resumen:* ${alert.summary}

*Severidad:* ${alert.severity?.toUpperCase() || 'UNKNOWN'}
*CVE ID:* ${alert.cve_id || alert.ghsa_id || 'N/A'}
*CVSS Score:* ${alert.cvss?.score || 'N/A'}

*Ecosistema:* ${alert.vulnerable_ecosystem || 'N/A'}
*Publicado:* ${new Date(alert.published_at).toLocaleDateString('es-ES')}

[Ver Detalles](${alert.html_url || ''})

_BeZhas Security Sentinel_
        `.trim();

        const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const payload = JSON.stringify({
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
        });

        return this._sendWebhook(url, payload, true);
    }

    /**
     * Generic webhook sender
     */
    static _sendWebhook(url, payload, isTelegram = false) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(
                        isTelegram ? payload : JSON.stringify(payload)
                    )
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });

            req.on('error', reject);
            req.write(isTelegram ? payload : JSON.stringify(payload));
            req.end();
        });
    }
}

// ==========================================
// REPORT GENERATOR
// ==========================================
class ReportGenerator {
    static saveReport(alerts, timestamp) {
        const report = {
            timestamp: timestamp.toISOString(),
            alertsFound: alerts.length,
            alerts: alerts.map(alert => ({
                id: alert.ghsa_id || alert.cve_id,
                summary: alert.summary,
                severity: alert.severity,
                ecosystem: alert.vulnerable_ecosystem,
                published: alert.published_at,
                url: alert.html_url,
                cvss: alert.cvss?.score
            }))
        };

        fs.writeFileSync(CONFIG.REPORT_FILE, JSON.stringify(report, null, 2));
        console.log(`📄 Reporte guardado: ${CONFIG.REPORT_FILE}\n`);
    }

    static loadLastReport() {
        try {
            if (fs.existsSync(CONFIG.REPORT_FILE)) {
                const content = fs.readFileSync(CONFIG.REPORT_FILE, 'utf8');
                return JSON.parse(content);
            }
        } catch (err) {
            console.error('Error loading last report:', err.message);
        }
        return null;
    }
}

// ==========================================
// MAIN EXECUTION
// ==========================================
async function runSecurityCheck() {
    const timestamp = new Date();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🛡️  BeZhas Security Sentinel - ${timestamp.toLocaleString('es-ES')}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        // Fetch advisories
        const allAlerts = await SecurityAdvisoryChecker.checkSecurityAdvisories();
        console.log(`✅ Consultadas ${allAlerts.length} alertas de seguridad\n`);

        // Filter by stack and severity
        const criticalAlerts = SecurityAdvisoryChecker.filterAlerts(allAlerts);
        console.log(`🎯 Filtradas ${criticalAlerts.length} alertas críticas para el stack de BeZhas\n`);

        if (criticalAlerts.length === 0) {
            console.log('✅ No se detectaron vulnerabilidades críticas\n');
            ReportGenerator.saveReport([], timestamp);
            return;
        }

        // Load last report to avoid duplicate alerts
        const lastReport = ReportGenerator.loadLastReport();
        const lastAlertIds = new Set(
            lastReport?.alerts?.map(a => a.id) || []
        );

        // Send alerts only for new vulnerabilities
        let newAlertsCount = 0;
        for (const alert of criticalAlerts) {
            const alertId = alert.ghsa_id || alert.cve_id;

            if (!lastAlertIds.has(alertId)) {
                console.log(`🚨 Nueva vulnerabilidad detectada: ${alert.summary}`);
                console.log(`   Severidad: ${alert.severity?.toUpperCase()}`);
                console.log(`   CVE: ${alertId}\n`);

                try {
                    // Send to Discord
                    if (CONFIG.DISCORD_WEBHOOK) {
                        await AlertSystem.sendDiscordAlert(alert);
                        console.log('   ✅ Alerta enviada a Discord');
                    }

                    // Send to Telegram
                    if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID) {
                        await AlertSystem.sendTelegramAlert(alert);
                        console.log('   ✅ Alerta enviada a Telegram');
                    }

                    newAlertsCount++;

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    console.error(`   ❌ Error enviando alerta: ${err.message}`);
                }
            }
        }

        // Save report
        ReportGenerator.saveReport(criticalAlerts, timestamp);

        // Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 Resumen:`);
        console.log(`   Total de alertas críticas: ${criticalAlerts.length}`);
        console.log(`   Nuevas alertas enviadas: ${newAlertsCount}`);
        console.log(`${'='.repeat(60)}\n`);

    } catch (error) {
        console.error('❌ Error durante el escaneo de seguridad:', error.message);
        process.exit(1);
    }
}

// ==========================================
// CRON SCHEDULER
// ==========================================
function startScheduler() {
    console.log('🚀 Iniciando BeZhas Security Sentinel...\n');
    console.log(`⏰ Configurado para ejecutar cada ${CONFIG.CHECK_INTERVAL / (60 * 60 * 1000)} horas\n`);

    // Run immediately on start
    runSecurityCheck();

    // Schedule recurring checks
    setInterval(() => {
        runSecurityCheck();
    }, CONFIG.CHECK_INTERVAL);
}

// ==========================================
// ENTRY POINT
// ==========================================
if (require.main === module) {
    // Check configuration
    if (!CONFIG.DISCORD_WEBHOOK && !CONFIG.TELEGRAM_BOT_TOKEN) {
        console.error('❌ Error: No se configuró ningún webhook de alerta');
        console.log('\nAgrega a scripts/.env:');
        console.log('DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...');
        console.log('o');
        console.log('TELEGRAM_BOT_TOKEN=...');
        console.log('TELEGRAM_SECURITY_CHAT_ID=...\n');
        process.exit(1);
    }

    // Start scheduler
    startScheduler();
}

module.exports = { SecurityAdvisoryChecker, AlertSystem, ReportGenerator };
