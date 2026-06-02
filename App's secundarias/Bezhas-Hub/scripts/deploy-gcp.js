const { execSync, spawn } = require('child_process');

console.log('🚀 Starting BeZhas Deployment...');

const runCommand = (command, cwd = process.cwd()) => {
    try {
        console.log(`> ${command}`);
        execSync(command, { stdio: 'inherit', cwd });
    } catch (error) {
        console.error(`❌ Command failed: ${command}`);
        process.exit(1);
    }
};

// 1. Backend Deployment (App Engine)
console.log('\n📦 Deploying Backend to App Engine...');
runCommand('gcloud app deploy backend/app.yaml --quiet');

// 2. Frontend & MCP Deployment (Cloud Build)
console.log('\n🏗️  Deploying Frontend & MCP via Cloud Build...');
// Cloud Build takes longer, so we just trigger it and wait
runCommand('gcloud builds submit --config=cloudbuild.yaml --async'); // --async to not block terminal too long?
// User wants it to be done. We should probably wait or verify.
// Let's remove --async to verify success, but note it might reach timeouts if run from Agent.
// For the agent script, let's keep it synchronous to report status.
// Removing --async for verify:
// runCommand('gcloud builds submit --config=cloudbuild.yaml');

// Actually, Cloud Build output is huge.
console.log('触发 Cloud Build...');
try {
    const build = execSync('gcloud builds submit --config=cloudbuild.yaml', { stdio: 'inherit' });
} catch (e) {
    console.error("Cloud Build failed");
    process.exit(1);
}

console.log('\n✅ Deployment Initiated Successfully!');
console.log('Backend: https://api.bez.digital');
console.log('Frontend: https://bez.digital');
