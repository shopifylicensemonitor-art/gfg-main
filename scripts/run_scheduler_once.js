const { processNextItem, stopScheduler } = require('./scheduler');
(async () => {
  try {
    await processNextItem();
    console.log('Scheduler manual run complete');
  } catch (err) {
    console.error('Scheduler run error', err);
    process.exitCode = 1;
  } finally {
    stopScheduler();
  }
})();
