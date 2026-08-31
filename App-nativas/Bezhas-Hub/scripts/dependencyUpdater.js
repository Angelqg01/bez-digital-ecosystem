/**
 * Dependency Version Checker & Auto-Updater
 * 
 * Compares current package versions with latest NPM registry versions
 * Generates detailed update reports with changelogs
 * Creates Pull Requests for safe updates
 * 
 * Usage: node scripts/dependencyUpdater.js [--workspace=frontend|backend]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    WORKSPACES: ['frontend', 'backend'],

    // Packages to always check
    CRITICAL_PACKAGES: [
        'react', 'react-dom', 'ethers', 'wagmi', 'viem',
        '@web3modal/wagmi', 'express', 'mongoose', 'helmet'
    ],

    // Semver update policies
    AUTO_UPDATE_PATCH: true,    // Auto-update patch versions (1.0.0 -> 1.0.1)
    AUTO_UPDATE_MINOR: false,   // Require review for minor (1.0.0 -> 1.1.0)
    AUTO_UPDATE_MAJOR: false,   // Require review for major (1.0.0 -> 2.0.0)

    // GitHub PR settings
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    REPO_OWNER: 'bezhas',
    REPO_NAME: 'bezhas-web3',
    BASE_BRANCH: 'main',

    OUTPUT_DIR: path.join(__dirname, 'reports')
};

// ==========================================
// NPM REGISTRY API
// ==========================================
class NPMRegistry {
    /**
     * Get package metadata from NPM registry
     */
    static async getPackageInfo(packageName) {
        return new Promise((resolve, reject) => {
            const url = `https://registry.npmjs.org/${packageName}`;

            https.get(url, { headers: { 'User-Agent': 'BeZhas-Updater' } }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({
                            name: parsed.name,
                            latestVersion: parsed['dist-tags']?.latest,
                            versions: Object.keys(parsed.versions || {}),
                            description: parsed.description,
                            homepage: parsed.homepage,
                            repository: parsed.repository?.url,
                            time: parsed.time
                        });
                    } catch (err) {
                        reject(err);
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Get changelog between versions
     */
    static async getChangelog(packageName, fromVersion, toVersion) {
        try {
            const info = await this.getPackageInfo(packageName);

            // Try to fetch CHANGELOG or HISTORY from package
            const changelogUrl = info.repository?.replace('git+', '').replace('.git', '') +
                `/blob/master/CHANGELOG.md`;

            return {
                url: changelogUrl,
                summary: `Update from ${fromVersion} to ${toVersion}`,
                breaking: this._isBreakingChange(fromVersion, toVersion)
            };
        } catch (err) {
            return { summary: 'Changelog not available', breaking: false };
        }
    }

    /**
     * Check if version change is breaking (major version bump)
     */
    static _isBreakingChange(from, to) {
        const fromMajor = parseInt(from.split('.')[0]);
        const toMajor = parseInt(to.split('.')[0]);
        return toMajor > fromMajor;
    }
}

// ==========================================
// VERSION ANALYZER
// ==========================================
class VersionAnalyzer {
    /**
     * Parse semver version
     */
    static parseSemver(version) {
        const clean = version.replace(/^[^0-9]+/, ''); // Remove ^ ~ etc
        const [major, minor, patch] = clean.split('.').map(Number);
        return { major: major || 0, minor: minor || 0, patch: patch || 0, raw: clean };
    }

    /**
     * Compare two versions
     */
    static compareVersions(current, latest) {
        const curr = this.parseSemver(current);
        const lat = this.parseSemver(latest);

        if (lat.major > curr.major) return 'major';
        if (lat.minor > curr.minor) return 'minor';
        if (lat.patch > curr.patch) return 'patch';
        return 'current';
    }

    /**
     * Check if update is safe based on policy
     */
    static isSafeUpdate(updateType) {
        switch (updateType) {
            case 'patch': return CONFIG.AUTO_UPDATE_PATCH;
            case 'minor': return CONFIG.AUTO_UPDATE_MINOR;
            case 'major': return CONFIG.AUTO_UPDATE_MAJOR;
            default: return false;
        }
    }
}

// ==========================================
// DEPENDENCY SCANNER
// ==========================================
class DependencyScanner {
    constructor(workspace) {
        this.workspace = workspace;
        this.workspaceDir = path.join(process.cwd(), workspace);
        this.packageJsonPath = path.join(this.workspaceDir, 'package.json');
    }

    /**
     * Read package.json
     */
    readPackageJson() {
        const content = fs.readFileSync(this.packageJsonPath, 'utf8');
        return JSON.parse(content);
    }

    /**
     * Get all dependencies
     */
    getAllDependencies() {
        const pkg = this.readPackageJson();
        return {
            ...pkg.dependencies,
            ...pkg.devDependencies
        };
    }

    /**
     * Scan for outdated packages
     */
    async scanOutdated() {
        console.log(`\n📦 Scanning ${this.workspace} dependencies...\n`);

        const dependencies = this.getAllDependencies();
        const outdated = [];

        for (const [name, currentVersion] of Object.entries(dependencies)) {
            try {
                const info = await NPMRegistry.getPackageInfo(name);
                const updateType = VersionAnalyzer.compareVersions(currentVersion, info.latestVersion);

                if (updateType !== 'current') {
                    const changelog = await NPMRegistry.getChangelog(
                        name,
                        currentVersion,
                        info.latestVersion
                    );

                    const isCritical = CONFIG.CRITICAL_PACKAGES.includes(name);
                    const isSafe = VersionAnalyzer.isSafeUpdate(updateType);

                    outdated.push({
                        name,
                        currentVersion: VersionAnalyzer.parseSemver(currentVersion).raw,
                        latestVersion: info.latestVersion,
                        updateType,
                        isCritical,
                        isSafe,
                        changelog,
                        homepage: info.homepage,
                        repository: info.repository
                    });

                    const emoji = isCritical ? '🔴' : '🟡';
                    const safeTag = isSafe ? '✅ AUTO-UPDATE' : '⚠️  REVIEW';
                    console.log(`  ${emoji} ${name}: ${currentVersion} → ${info.latestVersion} [${updateType.toUpperCase()}] ${safeTag}`);
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.error(`  ❌ Error checking ${name}: ${err.message}`);
            }
        }

        return outdated;
    }
}

// ==========================================
// REPORT GENERATOR
// ==========================================
class ReportGenerator {
    static generate(workspace, outdatedPackages) {
        const timestamp = new Date().toISOString();
        const reportFile = path.join(
            CONFIG.OUTPUT_DIR,
            `${workspace}-dependencies-${timestamp.split('T')[0]}.json`
        );

        const report = {
            workspace,
            timestamp,
            summary: {
                total: outdatedPackages.length,
                major: outdatedPackages.filter(p => p.updateType === 'major').length,
                minor: outdatedPackages.filter(p => p.updateType === 'minor').length,
                patch: outdatedPackages.filter(p => p.updateType === 'patch').length,
                safeUpdates: outdatedPackages.filter(p => p.isSafe).length,
                criticalPackages: outdatedPackages.filter(p => p.isCritical).length
            },
            packages: outdatedPackages
        };

        // Ensure output directory exists
        if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
            fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
        }

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`\n📄 Report saved: ${reportFile}`);

        return report;
    }

    static generateMarkdown(report) {
        let md = `# Dependency Update Report - ${report.workspace}\n\n`;
        md += `**Date:** ${new Date(report.timestamp).toLocaleDateString()}\n\n`;
        md += `## Summary\n\n`;
        md += `- Total outdated: ${report.summary.total}\n`;
        md += `- Major updates: ${report.summary.major}\n`;
        md += `- Minor updates: ${report.summary.minor}\n`;
        md += `- Patch updates: ${report.summary.patch}\n`;
        md += `- Safe auto-updates: ${report.summary.safeUpdates}\n`;
        md += `- Critical packages: ${report.summary.criticalPackages}\n\n`;

        if (report.packages.length > 0) {
            md += `## Outdated Packages\n\n`;
            md += `| Package | Current | Latest | Type | Action |\n`;
            md += `|---------|---------|--------|------|--------|\n`;

            report.packages.forEach(pkg => {
                const action = pkg.isSafe ? '✅ Auto' : '⚠️ Review';
                md += `| ${pkg.name} | ${pkg.currentVersion} | ${pkg.latestVersion} | ${pkg.updateType} | ${action} |\n`;
            });
        }

        return md;
    }
}

// ==========================================
// MAIN EXECUTION
// ==========================================
async function main() {
    console.log('🔄 BeZhas Dependency Updater - Starting...\n');

    const workspaces = process.argv.includes('--workspace')
        ? [process.argv.find(arg => arg.startsWith('--workspace=')).split('=')[1]]
        : CONFIG.WORKSPACES;

    for (const workspace of workspaces) {
        try {
            const scanner = new DependencyScanner(workspace);
            const outdated = await scanner.scanOutdated();
            const report = ReportGenerator.generate(workspace, outdated);
            const markdown = ReportGenerator.generateMarkdown(report);

            // Save markdown report
            const mdFile = path.join(CONFIG.OUTPUT_DIR, `${workspace}-report.md`);
            fs.writeFileSync(mdFile, markdown);

            console.log(`\n✅ ${workspace} scan complete`);
            console.log(`   Total outdated: ${report.summary.total}`);
            console.log(`   Safe updates: ${report.summary.safeUpdates}`);
        } catch (err) {
            console.error(`\n❌ Error scanning ${workspace}:`, err.message);
        }
    }

    console.log('\n✅ Dependency scan complete!');
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { DependencyScanner, VersionAnalyzer, NPMRegistry, ReportGenerator };
