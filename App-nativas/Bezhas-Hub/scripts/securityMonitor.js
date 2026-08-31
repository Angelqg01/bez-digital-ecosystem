/**
 * Security Monitor Script
 * 
 * Monitors GitHub Security Advisories and CVE databases for vulnerabilities
 * affecting BeZhas tech stack: Solidity, React, Node.js, Ethers.js, Wagmi
 * 
 * Features:
 * - Queries GitHub Security Advisories API
 * - Filters by ecosystem and severity
 * - Sends alerts to Discord/Telegram
 * - Generates JSON report for CI/CD
 * 
 * Usage: node scripts/securityMonitor.js
 * Environment Variables:
 * - GITHUB_TOKEN: GitHub API token
 * - DISCORD_WEBHOOK_URL: Discord webhook for alerts
 * - TELEGRAM_BOT_TOKEN: Telegram bot token
 * - TELEGRAM_CHAT_ID: Telegram chat ID for alerts
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK_URL || '',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_SECURITY_CHAT_ID || '',

    // Packages to monitor
    CRITICAL_PACKAGES: [
        'react',
        'react-dom',
        'ethers',
        'wagmi',
        '@web3modal/wagmi',
        'viem',
        'express',
        'mongoose',
        'jsonwebtoken',
        'helmet',
        'vite',
        '@vitejs/plugin-react'
    ],

    // Severity levels to alert on
    ALERT_SEVERITIES: ['CRITICAL', 'HIGH'],

    // CVE keywords for Solidity
    SOLIDITY_KEYWORDS: ['solidity', 'smart contract', 'ethereum', 'evm'],

    // Output file
    REPORT_FILE: path.join(__dirname, 'security-report.json')
};

// ==========================================
// GITHUB SECURITY ADVISORIES API
// ==========================================
class GitHubSecurityAPI {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'api.github.com';
    }

    /**
     * Query GitHub GraphQL API for security advisories
     */
    async queryAdvisories(ecosystem = 'NPM', severity = ['CRITICAL', 'HIGH']) {
        const query = `
            query {
                securityAdvisories(
                    first: 50, 
                    ecosystem: ${ecosystem},
                    orderBy: {field: PUBLISHED_AT, direction: DESC}
                ) {
                    nodes {
                        id
                        ghsaId
                        summary
                        description
                        severity
                        publishedAt
                        updatedAt
                        withdrawnAt
                        vulnerabilities(first: 10) {
                            nodes {
                                package {
                                    name
                                    ecosystem
                                }
                                vulnerableVersionRange
                                firstPatchedVersion {
                                    identifier
                                }
                            }
                        }
                        references {
                            url
                        }
                        cvss {
                            score
                            vectorString
                        }
                    }
                }
            }
        `;

        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                path: '/graphql',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'BeZhas-Security-Monitor'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.errors) {
                            reject(new Error(`GraphQL Error: ${JSON.stringify(parsed.errors)}`));
                        } else {
                            resolve(parsed.data?.securityAdvisories?.nodes || []);
                        }
                    } catch (err) {
                        reject(err);
                    }
                });
            });

            req.on('error', reject);
            req.write(JSON.stringify({ query }));
            req.end();
        });
    }

    /**
     * Filter advisories by package names
     */
    filterByPackages(advisories, packageNames) {
        return advisories.filter(advisory => {
            return advisory.vulnerabilities.nodes.some(vuln =>
                packageNames.includes(vuln.package.name)
            );
        });
    }

    /**
     * Filter advisories by severity
     */
    filterBySeverity(advisories, severities) {
        return advisories.filter(advisory =>
            severities.includes(advisory.severity)
        );
    }
}

// ==========================================
// ALERT SYSTEM
// ==========================================
class AlertSystem {
    /**
     * Send Discord webhook alert
     */
    static async sendDiscordAlert(webhookUrl, advisory) {
        if (!webhookUrl) return;

        const severityColors = {
            'CRITICAL': 0xFF0000, // Red
            'HIGH': 0xFF6600,     // Orange
            'MODERATE': 0xFFAA00, // Yellow
            'LOW': 0x00FF00       // Green
        };

        const embed = {
            title: `🚨 Security Advisory: ${advisory.ghsaId}`,
            description: advisory.summary,
            color: severityColors[advisory.severity] || 0x808080,
            fields: [
                {
                    name: 'Severity',
                    value: advisory.severity,
                    inline: true
                },
                {
                    name: 'CVSS Score',
                    value: advisory.cvss?.score?.toString() || 'N/A',
                    inline: true
                },
                {
                    name: 'Published',
                    value: new Date(advisory.publishedAt).toLocaleDateString(),
                    inline: true
                },
                {
                    name: 'Affected Packages',
                    value: advisory.vulnerabilities.nodes
                        .map(v => `\`${v.package.name}\` (${v.vulnerableVersionRange})`)
                        .join('\n') || 'N/A'
                },
                {
                    name: 'Patched Version',
                    value: advisory.vulnerabilities.nodes
                        .map(v => v.firstPatchedVersion?.identifier || 'No patch yet')
                        .join(', ')
                }
            ],
            url: advisory.references[0]?.url || '',
            timestamp: new Date().toISOString(),
            footer: {
                text: 'BeZhas Security Monitor'
            }
        };

        return this._sendWebhook(webhookUrl, { embeds: [embed] });
    }

    /**
     * Send Telegram alert
     */
    static async sendTelegramAlert(botToken, chatId, advisory) {
        if (!botToken || !chatId) return;

        const message = `
🚨 *Security Advisory Detected*

*Advisory ID:* ${advisory.ghsaId}
*Severity:* ${advisory.severity}
*CVSS Score:* ${advisory.cvss?.score || 'N/A'}

*Summary:*
${advisory.summary}

*Affected Packages:*
${advisory.vulnerabilities.nodes.map(v => `• ${v.package.name} (${v.vulnerableVersionRange})`).join('\n')}

*Patched Version:*
${advisory.vulnerabilities.nodes.map(v => v.firstPatchedVersion?.identifier || 'No patch yet').join(', ')}

*Published:* ${new Date(advisory.publishedAt).toLocaleDateString()}

[View Details](${advisory.references[0]?.url || ''})
        `.trim();

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const payload = JSON.stringify({
            chat_id: chatId,
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
// MAIN EXECUTION
// ==========================================
async function main() {
    console.log('🔒 BeZhas Security Monitor - Starting...\n');

    const report = {
        timestamp: new Date().toISOString(),
        criticalAdvisories: [],
        highAdvisories: [],
        affectedPackages: [],
        summary: {
            total: 0,
            critical: 0,
            high: 0,
            alertsSent: 0
        }
    };

    try {
        // Initialize GitHub API
        const githubAPI = new GitHubSecurityAPI(CONFIG.GITHUB_TOKEN);

        // Query advisories
        console.log('📡 Querying GitHub Security Advisories...');
        const allAdvisories = await githubAPI.queryAdvisories();
        console.log(`✅ Found ${allAdvisories.length} total advisories\n`);

        // Filter by critical packages
        const relevantAdvisories = githubAPI.filterByPackages(
            allAdvisories,
            CONFIG.CRITICAL_PACKAGES
        );
        console.log(`🎯 Filtered to ${relevantAdvisories.length} relevant advisories\n`);

        // Filter by severity
        const criticalAdvisories = githubAPI.filterBySeverity(
            relevantAdvisories,
            CONFIG.ALERT_SEVERITIES
        );
        console.log(`🚨 Found ${criticalAdvisories.length} critical/high severity advisories\n`);

        // Update report
        report.summary.total = relevantAdvisories.length;
        report.criticalAdvisories = criticalAdvisories.filter(a => a.severity === 'CRITICAL');
        report.highAdvisories = criticalAdvisories.filter(a => a.severity === 'HIGH');
        report.summary.critical = report.criticalAdvisories.length;
        report.summary.high = report.highAdvisories.length;

        // Extract affected packages
        const affectedPackagesSet = new Set();
        criticalAdvisories.forEach(advisory => {
            advisory.vulnerabilities.nodes.forEach(vuln => {
                affectedPackagesSet.add(vuln.package.name);
            });
        });
        report.affectedPackages = Array.from(affectedPackagesSet);

        // Send alerts
        if (criticalAdvisories.length > 0) {
            console.log('📢 Sending alerts...\n');

            for (const advisory of criticalAdvisories) {
                console.log(`  • ${advisory.ghsaId} - ${advisory.severity} - ${advisory.summary}`);

                try {
                    // Discord
                    if (CONFIG.DISCORD_WEBHOOK) {
                        await AlertSystem.sendDiscordAlert(CONFIG.DISCORD_WEBHOOK, advisory);
                        console.log('    ✅ Discord alert sent');
                    }

                    // Telegram
                    if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID) {
                        await AlertSystem.sendTelegramAlert(
                            CONFIG.TELEGRAM_BOT_TOKEN,
                            CONFIG.TELEGRAM_CHAT_ID,
                            advisory
                        );
                        console.log('    ✅ Telegram alert sent');
                    }

                    report.summary.alertsSent++;

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    console.error(`    ❌ Alert failed: ${err.message}`);
                }
            }
            console.log('');
        } else {
            console.log('✅ No critical vulnerabilities detected!\n');
        }

        // Save report
        fs.writeFileSync(CONFIG.REPORT_FILE, JSON.stringify(report, null, 2));
        console.log(`📄 Report saved to: ${CONFIG.REPORT_FILE}\n`);

        // Print summary
        console.log('📊 Summary:');
        console.log(`  Total advisories: ${report.summary.total}`);
        console.log(`  Critical: ${report.summary.critical}`);
        console.log(`  High: ${report.summary.high}`);
        console.log(`  Alerts sent: ${report.summary.alertsSent}`);
        console.log(`  Affected packages: ${report.affectedPackages.join(', ') || 'None'}`);

        // Exit with error if critical vulnerabilities found
        if (report.summary.critical > 0) {
            console.log('\n❌ CRITICAL VULNERABILITIES DETECTED - ACTION REQUIRED');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Error during security monitoring:', error.message);
        report.error = error.message;
        fs.writeFileSync(CONFIG.REPORT_FILE, JSON.stringify(report, null, 2));
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { GitHubSecurityAPI, AlertSystem };
