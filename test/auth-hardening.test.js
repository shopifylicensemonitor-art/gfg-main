const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  return app;
}

test('pin login rejects when ACCESS_PIN is not configured', async () => {
  const originalPin = process.env.ACCESS_PIN;
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.ACCESS_PIN;
  delete process.env.JWT_SECRET;

  const app = createApp();
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });

    assert.equal(response.status, 401);
    const body = await response.json();
    assert.match(body.error, /PIN login is not configured|Invalid PIN/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalPin === undefined) delete process.env.ACCESS_PIN; else process.env.ACCESS_PIN = originalPin;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
});
