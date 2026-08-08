const test = require('node:test');
const assert = require('node:assert/strict');
const { createDefaultCampaignContent, resolveLaunchRecipientPlan } = require('../routes/campaigns');

test('creates fallback content when subject and body are omitted', () => {
  const result = createDefaultCampaignContent('', '', '');

  assert.equal(result.subject, 'Untitled campaign');
  assert.match(result.body_html, /ready for editing/i);
  assert.match(result.body_plain, /ready for editing/i);
});

test('reuses existing queue rows when launching a campaign that already has queued recipients', () => {
  const result = resolveLaunchRecipientPlan({
    existingQueueRows: [
      { recipient_email: 'first@example.com', account_id: 7, fields: '{"first_name":"Ada"}' },
    ],
    recipients: [],
    contacts: [],
  });

  assert.equal(result.useExistingQueue, true);
  assert.deepEqual(result.recipients, [
    { recipient_email: 'first@example.com', account_id: 7, fields: '{"first_name":"Ada"}' },
  ]);
});
