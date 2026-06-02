#!/usr/bin/env node
/**
 * scripts/securityMonitor.js
 *
 * Scans the project workspaces (api, control-center/frontend) for dependency configurations
 * and checks for known security advisories or deprecated dependencies.
 * Generates a clean JSON security report and notifies configured channels (Discord/Telegram).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const REPORT_FILE = path.join(__dirname, 'security-report.json');

// Curated list of known high-risk/deprecated packages to check as a baseline
const DEPRECATED_OR_RISKY_PACKAGES = {
  'request': 'Deprecated package. Use axios or native fetch.',
  'node-fetch': 'Consider using native global fetch if running on Node.js >= 18.',
  'lodash': 'Ensure Lodash is updated to >= 4.17.21 to avoid prototype pollution vulnerabilities (CVE-2020-8203, CVE-2021-23337).',
  'express': 'Ensure Express is updated to >= 4.19.2 or >= 5.0.0-beta.3 to avoid open redirect and regex DoS issues (CVE-2024-43796, CVE-2024-43799).',
  'ws': 'Ensure ws is updated to >= 7.5.10 or >= 8.17.1 to avoid DoS vulnerabilities (CVE-2024-37890).'
};

async function runMonitor() {
  console.log('🛡️  Starting BeZhas Security & CVE Advisory Scan...');
  
  const timestamp = new Date().toISOString();
  const advisories = [];
  const checkedWorkspaces = [
    { name: 'Root Project', path: path.join(ROOT, 'package.json') },
    { name: 'Backend API', path: path.join(ROOT, 'api', 'package.json') },
    { name: 'Frontend (Next.js)', path: path.join(ROOT, 'control-center', 'frontend', 'package.json') }
  ];

  for (const ws of checkedWorkspaces) {
    if (!fs.existsSync(ws.path)) {
      console.log(`ℹ️  Skipping workspace ${ws.name} (package.json not found)`);
      continue;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(ws.path, 'utf8'));
      const dependencies = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
      };

      console.log(`🔍 Scanning ${ws.name} dependencies...`);

      for (const [pkg, version] of Object.entries(dependencies)) {
        if (DEPRECATED_OR_RISKY_PACKAGES[pkg]) {
          advisories.push({
            workspace: ws.name,
            package: pkg,
            installedVersion: version,
            severity: 'moderate',
            description: DEPRECATED_OR_RISKY_PACKAGES[pkg],
            remediation: `Verify that ${pkg} is updated to the latest secure version in ${ws.name}.`
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${ws.name}:`, error.message);
    }
  }

  // Generate Report
  const reportData = {
    status: 'success',
    timestamp,
    scanSummary: {
      totalWorkspacesScanned: checkedWorkspaces.filter(ws => fs.existsSync(ws.path)).length,
      totalIssuesFound: advisories.length
    },
    advisories
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(reportData, null, 2));
  console.log(`✅ Security report generated successfully at: ${REPORT_FILE}`);

  // Send alerts if issues are found and integrations are configured
  if (advisories.length > 0) {
    console.log(`⚠️  Discovered ${advisories.length} security advisory items. Sending alerts...`);
    await sendDiscordNotification(advisories);
    await sendTelegramNotification(advisories);
  } else {
    console.log('🎉 No critical package advisories detected in scanned workspaces!');
  }
}

async function sendDiscordNotification(advisories) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('ℹ️  Discord notification skipped (DISCORD_WEBHOOK_URL not set)');
    return;
  }

  const fields = advisories.slice(0, 10).map(adv => ({
    name: `🚨 [${adv.severity.toUpperCase()}] ${adv.package} in ${adv.workspace}`,
    value: `${adv.description}\n*Remediation:* ${adv.remediation}`,
    inline: false
  }));

  const payload = {
    embeds: [{
      title: '🛡️ BeZhas Security & CVE Advisory Alert',
      color: 16753920, // Orange
      description: `Discovered **${advisories.length}** security advisory items during the automated pipeline scan.`,
      fields,
      footer: { text: 'BeZhas Security Monitor Pipeline' },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    await axios.post(webhookUrl, payload);
    console.log('✅ Discord notification sent successfully.');
  } catch (error) {
    console.error('❌ Failed to send Discord notification:', error.message);
  }
}

async function sendTelegramNotification(advisories) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('ℹ️  Telegram notification skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set)');
    return;
  }

  try {
    const bot = new TelegramBot(botToken);
    let message = `🛡️ *BeZhas Security Alert*\n\nDiscovered *${advisories.length}* security advisories during automated scan:\n\n`;

    for (const adv of advisories.slice(0, 5)) {
      message += `⚠️ *${adv.package}* (${adv.workspace})\n`;
      message += `• _Severity:_ ${adv.severity.toUpperCase()}\n`;
      message += `• _Description:_ ${adv.description}\n\n`;
    }

    if (advisories.length > 5) {
      message += `_...and ${advisories.length - 5} more items. Check the artifacts for details._`;
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    console.log('✅ Telegram notification sent successfully.');
  } catch (error) {
    console.error('❌ Failed to send Telegram notification:', error.message);
  }
}

runMonitor().catch(err => {
  console.error('💥 Critical error in security monitor execution:', err);
  process.exit(1);
});
