#!/usr/bin/env node
require('dotenv').config();
const { getDb } = require('../db');

async function main() {
  const wrapped = await getDb();
  const db = wrapped;

  console.log('Seeding test account, contacts, and campaign...');

  const now = new Date();
  const scheduledAt = now.toISOString();

  const tx = db.transaction(async (txDb) => {
    // Insert a test SMTP account (points to localhost:1025 — use MailHog or similar if available)
    const acctRes = await txDb.prepare(`
      INSERT INTO accounts (email, daily_sent, daily_limit, status, display_name, type, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure)
      VALUES (?, 0, ?, 'active', ?, 'smtp', ?, ?, ?, ?, ?)
    `).run('test.sender@example.com', 100, 'Local Test Sender', 'localhost', 1025, '', '', 0);

    const accountId = acctRes.lastInsertRowid;

    // Create a contact list with three recipients
    const contacts = [
      { email: 'recipient1@example.com' },
      { email: 'recipient2@example.com' },
      { email: 'recipient3@example.com' },
    ];

    for (const c of contacts) {
      await txDb.prepare('INSERT INTO contacts (list_name, email, fields) VALUES (?, ?, ?)')
        .run('test-list', c.email, JSON.stringify({ first_name: c.email.split('@')[0] }));
    }

    // Create a simple campaign in draft
    const campRes = await txDb.prepare(`
      INSERT INTO campaigns (name, subject, body_html, contact_list, delay_seconds, start_time, end_time, status, total_contacts)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(
      'Test Campaign',
      'Hello {{name}} - Test',
      '<p>This is a test email for {{name}}.</p>',
      'test-list',
      30,
      '00:00',
      '23:59',
      contacts.length
    );

    const campaignId = campRes.lastInsertRowid;

    // Seed campaign_recipients and queue, round-robin to the single test account
    for (let i = 0; i < contacts.length; i++) {
      const email = contacts[i].email;
      await txDb.prepare('INSERT INTO campaign_recipients (campaign_id, recipient_email, status, current_step) VALUES (?, ?, "active", 1)')
        .run(campaignId, email);

      await txDb.prepare(`
        INSERT INTO queue (campaign_id, recipient_email, account_id, status, scheduled_at, fields, step_number)
        VALUES (?, ?, ?, 'pending', ?, ?, 1)
      `).run(campaignId, email, accountId, scheduledAt, JSON.stringify({ first_name: email.split('@')[0] }));
    }

    // Mark campaign as sending
    await txDb.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ?").run(campaignId);

    return { accountId, campaignId };
  });

  const result = await tx();
  console.log('Seed complete:', result);
  console.log('Campaign will be processed by scheduler if ENABLE_SCHEDULER=true and an SMTP server is available at localhost:1025.');

  if (db && typeof db.close === 'function') {
    await db.close();
  }
}

main().catch(async err => {
  console.error('Seeding failed:', err);
  try {
    const db = await getDb();
    if (db && typeof db.close === 'function') {
      await db.close();
    }
  } catch (_) {}
  process.exit(1);
});
