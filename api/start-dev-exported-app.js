'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.GCP_ENABLED = process.env.GCP_ENABLED || 'false';

const app = require('./index');
const { connectRedis } = require('./cache/redis');

const port = Number(process.env.PORT || 3001);
let server;

connectRedis()
  .catch(error => console.warn(`[DEV] Redis unavailable: ${error.message}`))
  .finally(() => {
    server = app.listen(port, () => {
      console.log(`BeZhas exported app listening on ${port}`);
    });
  });

const close = () => {
  if (!server) return process.exit(0);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', close);
process.on('SIGINT', close);
