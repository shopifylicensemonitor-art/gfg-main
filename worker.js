/**
 * worker.js — Always-on Background Queue Worker for Peak Xender.
 *
 * Runs independently from server.js.
 * Handles background campaign sending, atomic PostgreSQL queue claiming (FOR UPDATE SKIP LOCKED),
 * retry handling with exponential backoff, worker health heartbeats, and stale job recovery.
 */

require('dotenv').config();

const crypto = require('crypto');
const { getDb } = require('./db');
const logger = require('./logger');
const {
  processQueueBatch,
  recoverStaleJobs,
} = require('./scheduler');

const WORKER_ID = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS, 10) || 15000; // 15 seconds default
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

let isProcessing = false;
let isShuttingDown = false;
let jobsProcessedCount = 0;
let pollTimer = null;
let heartbeatTimer = null;

/**
 * Send heartbeat to database for worker health monitoring.
 */
async function updateHeartbeat(status = 'active') {
  try {
    const db = await getDb();
    if (!db._isPg) {
      // In SQLite mode, record heartbeat if table exists
      try {
        await db.prepare(`
          INSERT INTO worker_heartbeats (worker_id, last_seen, status, jobs_processed)
          VALUES (?, datetime('now'), ?, ?)
          ON CONFLICT(worker_id) DO UPDATE SET last_seen = datetime('now'), status = ?, jobs_processed = ?
        `).run(WORKER_ID, status, jobsProcessedCount, status, jobsProcessedCount);
      } catch (_) {}
      return;
    }

    await db.prepare(`
      INSERT INTO worker_heartbeats (worker_id, last_seen, status, jobs_processed)
      VALUES (?, NOW(), ?, ?)
      ON CONFLICT(worker_id) DO UPDATE SET last_seen = NOW(), status = EXCLUDED.status, jobs_processed = EXCLUDED.jobs_processed
    `).run(WORKER_ID, status, jobsProcessedCount);
  } catch (err) {
    logger.warn({ err: err.message, workerId: WORKER_ID }, 'Worker heartbeat update failed');
  }
}

/**
 * Main worker tick — recovers stale jobs and claims/processes due queue items.
 */
async function workerTick() {
  if (isProcessing || isShuttingDown) return;
  isProcessing = true;

  try {
    // 1. Recover stale jobs (locked by crashed workers > 5 min ago)
    const recovered = await recoverStaleJobs();
    if (recovered > 0) {
      logger.info({ recovered, workerId: WORKER_ID }, 'Recovered stale locked jobs');
    }

    // 2. Claim and process batch of due queue items
    const processed = await processQueueBatch(WORKER_ID);
    if (processed > 0) {
      jobsProcessedCount += processed;
      logger.info({ processed, total: jobsProcessedCount, workerId: WORKER_ID }, 'Batch processing complete');
    }
  } catch (err) {
    logger.error({ err: err.message, workerId: WORKER_ID }, 'Error in worker tick');
  } finally {
    isProcessing = false;
  }
}

/**
 * Graceful shutdown handler.
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal, workerId: WORKER_ID }, 'Received shutdown signal. Stopping worker...');

  if (pollTimer) clearInterval(pollTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  // Wait for currently running tick to finish (up to 10s)
  let waitMs = 0;
  while (isProcessing && waitMs < 10000) {
    await new Promise(r => setTimeout(r, 200));
    waitMs += 200;
  }

  await updateHeartbeat('stopped');

  try {
    const db = await getDb();
    if (db && typeof db.close === 'function') {
      await db.close();
    }
  } catch (_) {}

  logger.info({ workerId: WORKER_ID, totalProcessed: jobsProcessedCount }, 'Worker stopped cleanly.');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Startup initialization
(async () => {
  logger.info({ workerId: WORKER_ID, pollIntervalMs: POLL_INTERVAL_MS }, 'Initializing Peak Xender Background Worker');
  await getDb();

  // Record initial heartbeat
  await updateHeartbeat('active');

  // Start periodic tasks
  heartbeatTimer = setInterval(() => updateHeartbeat('active'), HEARTBEAT_INTERVAL_MS);
  pollTimer = setInterval(workerTick, POLL_INTERVAL_MS);

  // Immediate first run
  setImmediate(workerTick);
})();
