/**
 * server.js — Standalone Express API entry point for Peak Xender.
 *
 * Starts the HTTP server. Background email sending is decoupled into worker.js.
 */

require('dotenv').config();

const app = require('./app');
const path = require('path');
const { getDb } = require('./db');
const logger = require('./logger');

const PORT = process.env.PORT || 3000;

// Catch-all: serve React app for client-side routing in local/standalone mode
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'gfg-main', 'dist', 'index.html'));
});

let server;
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown of HTTP API server...`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
    });
  }

  try {
    const db = await getDb();
    if (db && typeof db.close === 'function') {
      await db.close();
      logger.info('Database connections closed.');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error closing database connections');
  }

  logger.info('API Server Shutdown complete.');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

(async () => {
  await getDb();

  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const localIps = [];
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIps.push(iface.address);
      }
    }
  }

  server = app.listen(PORT, () => {
    logger.info(`Peak Xender API Server running on http://localhost:${PORT}`);
    localIps.forEach(ip => {
      logger.info(`  Network:   http://${ip}:${PORT}`);
    });
    logger.info(`API Health Check: http://localhost:${PORT}/api/health`);
  });
})();
