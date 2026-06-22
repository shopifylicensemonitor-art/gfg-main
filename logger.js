const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  enabled: process.env.NODE_ENV !== 'test',
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV || 'development'
  }
});

module.exports = logger;
