const fs = require('fs');
const path = require('path');

const replacements = [
    { from: /UnifiedAI\.service/g, to: 'unified-ai.service' },
    { from: /adRewards\.service/g, to: 'ad-rewards.service' },
    { from: /adService/g, to: 'ad.service' },
    { from: /aiGuide\.service/g, to: 'ai-guide.service' },
    { from: /alertSystem\.service/g, to: 'alert-system.service' },
    { from: /automationEngine\.service/g, to: 'automation-engine.service' },
    { from: /blockchainListener\.service/g, to: 'blockchain-listener.service' },
    { from: /blockchainService/g, to: 'blockchain.service' },
    { from: /clothingRental\.service/g, to: 'clothing-rental.service' },
    { from: /dataOracle\.service/g, to: 'data-oracle.service' },
    { from: /databaseService/g, to: 'database.service' },
    { from: /deFiIntegration\.service/g, to: 'defi-integration.service' },
    { from: /feedOptimizer\.service/g, to: 'feed-optimizer.service' },
    { from: /fiatGateway\.service/g, to: 'fiat-gateway.service' },
    { from: /keyManagement\.service/g, to: 'key-management.service' },
    { from: /newsAggregator\.service/g, to: 'news-aggregator.service' },
    { from: /newsFetcher/g, to: 'news-fetcher.service' },
    { from: /notificationService/g, to: 'notification.service' },
    { from: /priceOracle\.service/g, to: 'price-oracle.service' },
    { from: /prometheusExporter/g, to: 'prometheus-exporter.service' },
    { from: /qualityNotificationService/g, to: 'quality-notification.service' },
    { from: /qualityReputationSystem/g, to: 'quality-reputation.service' },
    { from: /revenueEventListener/g, to: 'revenue-event-listener.service' },
    { from: /validationQueue\.service/g, to: 'validation-queue.service' },
];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (file === 'node_modules' || file === '.git') return;

        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

async function updateReferences(dir) {
    console.log(`Scanning ${dir}...`);
    const files = getAllFiles(dir);

    let modifiedCount = 0;

    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            let newContent = content;
            let fileModified = false;

            for (const { from, to } of replacements) {
                if (newContent.match(from)) {
                    newContent = newContent.replace(from, to);
                    fileModified = true;
                }
            }

            if (fileModified) {
                fs.writeFileSync(file, newContent, 'utf8');
                console.log(`Updated: ${file}`);
                modifiedCount++;
            }
        } catch (err) {
            console.error(`Error processing ${file}:`, err.message);
        }
    }

    console.log(`\nScan complete. Modified ${modifiedCount} files.`);
}

// Run in backend root
const backendRoot = path.resolve(__dirname, '..');
updateReferences(backendRoot);
