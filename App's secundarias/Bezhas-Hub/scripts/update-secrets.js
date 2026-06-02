const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const SECRETS = {
    'stripe-publishable-key': 'pk_live_PLACEHOLDER',
    'stripe-secret-key': 'sk_live_PLACEHOLDER',
    'stripe-webhook-secret': 'whsec_PLACEHOLDER'
};

async function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // If the error is "ALREADY_EXISTS", we might treat it as resolvable
                resolve({ success: false, error, stderr, stdout });
            } else {
                resolve({ success: true, stdout, stderr });
            }
        });
    });
}

async function updateSecret(name, value) {
    console.log(`\nProcessing secret: ${name}...`);

    // Create temporary file with the secret value (no extra newlines/quotes)
    const tempFile = path.resolve(__dirname, `temp_${name}.txt`);
    fs.writeFileSync(tempFile, value, { encoding: 'utf8', flag: 'w' });

    try {
        // 1. Try to CREATE the secret first
        console.log(`  Attempting to CREATE secret...`);
        const createCmd = `gcloud secrets create ${name} --data-file="${tempFile}"`;
        const createResult = await runCommand(createCmd);

        if (createResult.success) {
            console.log(`  ✅ Secret created successfully.`);
        } else {
            const stderr = createResult.stderr || '';
            if (stderr.includes('ALREADY_EXISTS')) {
                console.log(`  ⚠️ Secret already exists. Adding new version...`);
                // 2. Secret exists, add new version
                const addCmd = `gcloud secrets versions add ${name} --data-file="${tempFile}"`;
                const addResult = await runCommand(addCmd);

                if (addResult.success) {
                    console.log(`  ✅ New version added successfully.`);
                } else {
                    console.error(`  ❌ Failed to add version: ${addResult.stderr}`);
                }
            } else {
                console.error(`  ❌ Failed to create secret: ${stderr}`);
            }
        }
    } finally {
        // Cleanup temp file
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

async function main() {
    console.log('🚀 Starting Secret Update Script...');
    for (const [name, value] of Object.entries(SECRETS)) {
        await updateSecret(name, value);
    }
    console.log('\n🏁 Script finished.');
}

main();
