/**
 * netlify/functions/scheduler.js — Scheduled Netlify Function
 * Runs every 15 seconds to dispatch queued emails
 *
 * This scheduled function is invoked automatically by Netlify on a schedule.
 * It calls processNextItem() from the main scheduler to send queued emails.
 */

const { processNextItem } = require('../../scheduler');
const logger = require('../../logger');

exports.handler = async (event, context) => {
  // Verify this is a scheduled invocation (not a manual HTTP request)
  // Scheduled invocations have no body and a specific context flag
  if (!event.body && context.clientContext && context.clientContext.custom?.event === 'scheduled') {
    try {
      const processed = await processNextItem();
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Dispatch tick executed.',
          processed
        })
      };
    } catch (err) {
      logger.error({ err }, 'Scheduled function error');
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: err.message,
          timestamp: new Date().toISOString()
        })
      };
    }
  } else {
    // Reject manual HTTP requests (only allow scheduled invocations)
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Forbidden: Only scheduled invocations allowed.',
        hint: 'This function should only be called by Netlify scheduler, not manually.'
      })
    };
  }
};
