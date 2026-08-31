/**
 * PM2 Ecosystem Configuration for BeZhas Revenue Monitor
 * 
 * Uso:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --only revenue-monitor
 *   pm2 start ecosystem.config.js --env production
 */

module.exports = {
    apps: [
        {
            // Revenue Monitoring System
            name: 'revenue-monitor',
            script: './backend/scripts/monitorRevenue.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            error_file: './logs/revenue-monitor-error.log',
            out_file: './logs/revenue-monitor-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            env: {
                NODE_ENV: 'development',
                PORT: 3001
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3001
            }
        },

        // Backend API Server (si quieres correrlo con PM2 también)
        {
            name: 'backend-api',
            script: './backend/server.js',
            instances: 2,
            exec_mode: 'cluster',
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            error_file: './logs/backend-api-error.log',
            out_file: './logs/backend-api-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            env: {
                NODE_ENV: 'development',
                PORT: 5000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000
            }
        }
    ],

    deploy: {
        production: {
            user: 'bezhas',
            host: 'your-server.com',
            ref: 'origin/main',
            repo: 'git@github.com:bezhas/bezhas-web3.git',
            path: '/var/www/bezhas-web3',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
            'pre-setup': ''
        }
    }
};
