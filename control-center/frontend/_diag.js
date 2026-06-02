const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync('_diag.log', line);
    process.stdout.write(line);
};

log('Starting diagnostic...');

const startServerPath = require.resolve('./node_modules/next/dist/server/lib/start-server');
log(`start-server path: ${startServerPath}`);

const child = fork(startServerPath, {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: {
        ...process.env,
        __NEXT_DEV_SERVER: '1',
        NEXT_PRIVATE_START_TIME: Date.now().toString(),
        NEXT_PRIVATE_WORKER: '1',
        NODE_ENV: 'development',
        NEXT_RUNTIME: 'nodejs',
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_PATH: path.join(process.cwd(), 'node_modules')
    }
});

child.stdout.on('data', (d) => log(`STDOUT: ${d}`));
child.stderr.on('data', (d) => log(`STDERR: ${d}`));

child.on('message', (msg) => {
    log(`IPC MSG: ${JSON.stringify(msg)}`);
    if (msg && msg.nextWorkerReady) {
        log('Sending worker options...');
        child.send({
            nextWorkerOptions: {
                dir: process.cwd(),
                port: 3000,
                isDev: true,
                hostname: '127.0.0.1',
                allowRetry: true
            }
        });
    }
    if (msg && msg.nextServerReady) {
        log(`SERVER READY on port ${msg.port}`);
    }
});

child.on('error', (err) => log(`ERROR: ${err.message}`));
child.on('exit', (code, signal) => log(`EXIT: code=${code} signal=${signal}`));

// No timeout — keep running until manually stopped
process.on('SIGINT', () => {
    log('SIGINT received - shutting down');
    child.kill();
    process.exit(0);
});
process.on('SIGTERM', () => {
    log('SIGTERM received - shutting down');
    child.kill();
    process.exit(0);
});
