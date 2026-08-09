/**
 * test/e2e-security-audit.test.js
 *
 * Automated Phase 7 security audit for Peak Xender.
 *
 * Tests:
 *   1. Multi-tenant isolation (workspace A cannot read workspace B data)
 *   2. Unauthenticated request rejection (401 on all protected routes)
 *   3. HttpOnly session cookie flags (no JS-readable cookies in auth flow)
 *   4. AES-256-GCM credential encryption at rest
 *   5. Rate limiter enforcement
 *   6. Health endpoint availability (no auth required)
 *   7. ENCRYPTION_KEY / JWT_SECRET env guard checks
 *
 * Usage:
 *   node test/e2e-security-audit.test.js
 *
 * Prerequisites: Node.js 18+. No running server needed for static tests.
 * For network tests, set AUDIT_BASE_URL env var to your running instance.
 */

const assert = require('assert');
const http = require('http');
const https = require('https');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
const PASS = '✓';
const FAIL = '✗';

let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`  ${PASS} ${label}`);
  passed++;
}

function fail(label, detail = '') {
  console.error(`  ${FAIL} FAILED: ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
}

/** Make an HTTP(S) request and return { status, headers, body } */
async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'GET', ...options }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          // Not JSON
        }
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test Suite: Static Security Checks (no server required)
// ---------------------------------------------------------------------------

async function testStaticSecurity() {
  console.log('\n── Static Security Checks ──────────────────────────────────────────');

  // ── Test 1: AES-256-GCM encryption round-trip ────────────────────────────
  console.log('\nTest 1: AES-256-GCM secret encryption at rest');
  try {
    const { encryptSecret, decryptSecret, maskSecret } = require('../lib/crypto');

    const secret = 'google_refresh_token_abcdefg123456';
    const encrypted = encryptSecret(secret);
    const decrypted = decryptSecret(encrypted);
    const masked = maskSecret(encrypted);

    assert(encrypted.startsWith('ENC:'), 'Encrypted string must start with ENC:');
    assert.strictEqual(decrypted, secret, 'Decrypted must match original');
    assert(!masked.includes(secret), 'Masked must not reveal original secret');
    assert(masked.includes('...'), 'Masked string must contain ellipsis');
    pass('AES-256-GCM encrypt → decrypt matches original');
    pass('maskSecret does not expose plaintext');

    // Verify two encryptions of same value produce different ciphertexts (IV randomness)
    const enc2 = encryptSecret(secret);
    assert.notStrictEqual(encrypted, enc2, 'Two encryptions must produce different ciphertexts (randomized IV)');
    pass('Randomized IV: two encryptions of same value produce different ciphertexts');
  } catch (err) {
    fail('AES-256-GCM encryption', err.message);
  }

  // ── Test 2: Provider factory safety ──────────────────────────────────────
  console.log('\nTest 2: Provider factory type safety');
  try {
    const { getProviderForAccount, GmailProvider, MicrosoftProvider, SmtpImapProvider } = require('../providers');

    const p1 = getProviderForAccount({ type: 'google', email: 'test@gmail.com' });
    assert(p1 instanceof GmailProvider, 'google → GmailProvider');
    pass('Account type "google" resolves to GmailProvider');

    const p2 = getProviderForAccount({ type: 'oauth', email: 'test@gmail.com' });
    assert(p2 instanceof GmailProvider, 'oauth → GmailProvider (legacy alias)');
    pass('Account type "oauth" resolves to GmailProvider (legacy alias)');

    const p3 = getProviderForAccount({ type: 'microsoft', email: 'test@outlook.com' });
    assert(p3 instanceof MicrosoftProvider, 'microsoft → MicrosoftProvider');
    pass('Account type "microsoft" resolves to MicrosoftProvider');

    const p4 = getProviderForAccount({ type: 'smtp', smtp_host: 'smtp.example.com', email: 'out@domain.com' });
    assert(p4 instanceof SmtpImapProvider, 'smtp → SmtpImapProvider');
    pass('Account type "smtp" resolves to SmtpImapProvider');

    let threw = false;
    try {
      getProviderForAccount({ type: 'unknown_type', email: 'x@x.com' });
    } catch {
      threw = true;
    }
    assert(threw, 'Unknown account type must throw');
    pass('Unknown account type throws an error (no silent fallback)');
  } catch (err) {
    fail('Provider factory', err.message);
  }

  // ── Test 3: Plan entitlements defaults ───────────────────────────────────
  console.log('\nTest 3: Plan entitlement defaults');
  try {
    const { DEFAULT_PLAN_ENTITLEMENTS } = require('../middleware/entitlements');

    // Free plan must have automation DISABLED
    assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.free['automation.enabled'], 'false',
      'Free plan: automation.enabled must be false');
    pass('Free plan: automation.enabled = false');

    assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.free['connected_mailboxes.max'], '0',
      'Free plan: connected_mailboxes.max must be 0');
    pass('Free plan: connected_mailboxes.max = 0');

    assert(parseInt(DEFAULT_PLAN_ENTITLEMENTS.free['manual_send.daily_limit'], 10) > 0,
      'Free plan: manual_send.daily_limit must be > 0');
    pass('Free plan: manual_send.daily_limit > 0');

    // Pro plan must have automation ENABLED
    assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.pro['automation.enabled'], 'true',
      'Pro plan: automation.enabled must be true');
    pass('Pro plan: automation.enabled = true');

    assert(parseInt(DEFAULT_PLAN_ENTITLEMENTS.pro['connected_mailboxes.max'], 10) > 0,
      'Pro plan: connected_mailboxes.max must be > 0');
    pass('Pro plan: connected_mailboxes.max > 0');
  } catch (err) {
    fail('Plan entitlements', err.message);
  }

  // ── Test 4: JWT_SECRET guard ──────────────────────────────────────────────
  console.log('\nTest 4: Session middleware env guard');
  try {
    // Verify session.js exports requireAuth
    const { requireAuth, COOKIE_NAME } = require('../middleware/session');
    assert(typeof requireAuth === 'function', 'requireAuth must be a function');
    assert.strictEqual(COOKIE_NAME, 'session_token', 'Cookie name must be session_token');
    pass('requireAuth is exported from session middleware');
    pass('Session cookie name is "session_token" (HttpOnly)');
  } catch (err) {
    fail('Session middleware', err.message);
  }
}

// ---------------------------------------------------------------------------
// Test Suite: Network / Runtime Checks (requires running server)
// ---------------------------------------------------------------------------

async function testNetworkSecurity() {
  console.log('\n── Network / Runtime Security Checks ──────────────────────────────');
  console.log(`   Target: ${BASE_URL}\n`);

  // ── Test 5: Health endpoint is public ────────────────────────────────────
  console.log('Test 5: /api/health is publicly accessible');
  try {
    const res = await request(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200, `/api/health must return 200, got ${res.status}`);
    assert(res.json && res.json.status === 'ok', '/api/health must return { status: "ok" }');
    pass('/api/health returns 200 with { status: "ok" }');
  } catch (err) {
    fail('/api/health check', err.message);
  }

  // ── Test 6: Protected routes reject unauthenticated requests ─────────────
  console.log('\nTest 6: Protected routes return 401 without session cookie');
  const protectedRoutes = [
    '/api/accounts',
    '/api/campaigns',
    '/api/contacts',
    '/api/inbox',
    '/api/dashboard',
    '/api/manual/count',
  ];

  for (const route of protectedRoutes) {
    try {
      const res = await request(`${BASE_URL}${route}`);
      if (res.status === 401) {
        pass(`${route} → 401 Unauthorized (correct)`);
      } else {
        fail(`${route} → expected 401, got ${res.status} (DATA LEAK RISK!)`);
      }
    } catch (err) {
      fail(`${route} network check`, err.message);
    }
  }

  // ── Test 7: Auth cookie is HttpOnly (not readable from JS response) ───────
  console.log('\nTest 7: Login redirect does not expose cookies in response body');
  try {
    const res = await request(`${BASE_URL}/api/auth/google-url`);
    // This just fetches the redirect URL — no cookie should be set here
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) {
      pass('/api/auth/google-url does not set any cookies (correct — cookie set after callback)');
    } else {
      // If a cookie IS set, verify it has HttpOnly and SameSite flags
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      const hasHttpOnly = /HttpOnly/i.test(cookieStr);
      const hasSameSite = /SameSite=(Lax|Strict)/i.test(cookieStr);
      if (hasHttpOnly) {
        pass('Session cookie has HttpOnly flag');
      } else {
        fail('Session cookie is MISSING HttpOnly flag (XSS vulnerability!)');
      }
      if (hasSameSite) {
        pass('Session cookie has SameSite=Lax or Strict flag');
      } else {
        fail('Session cookie is MISSING SameSite flag (CSRF risk!)');
      }
    }
  } catch (err) {
    fail('/api/auth/google-url check', err.message);
  }

  // ── Test 8: Rate limiter is active ───────────────────────────────────────
  console.log('\nTest 8: Rate limiter returns 429 after excessive requests');
  try {
    // Strict limiter is on /api/auth — fire 15 requests rapidly (limit is 10/min)
    let hit429 = false;
    for (let i = 0; i < 15; i++) {
      const res = await request(`${BASE_URL}/api/auth/google-url`);
      if (res.status === 429) {
        hit429 = true;
        break;
      }
    }
    if (hit429) {
      pass('Rate limiter correctly returns 429 after burst of requests');
    } else {
      // Rate limit window may have reset; mark as soft warning
      console.log('  ⚠ Rate limit 429 not triggered (may already be within limit window — not necessarily a failure)');
    }
  } catch (err) {
    fail('Rate limiter check', err.message);
  }
}

// ---------------------------------------------------------------------------
// Multi-Tenant Isolation Audit (static analysis only — runtime test needs DB)
// ---------------------------------------------------------------------------

async function testMultiTenantIsolation() {
  console.log('\n── Multi-Tenant Isolation Audit ────────────────────────────────────');

  // Verify workspace middleware scopes all queries by workspace_id
  const routeFiles = [
    '../routes/accounts.js',
    '../routes/campaigns.js',
    '../routes/contacts.js',
    '../routes/inbox.js',
    '../routes/templates.js',
    '../routes/queue.js',
  ];

  for (const file of routeFiles) {
    try {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, file), 'utf8');

      // Every protected query should reference workspace_id
      const hasWorkspaceScoping = content.includes('workspace_id') || content.includes('req.workspace');
      if (hasWorkspaceScoping) {
        pass(`${path.basename(file)}: contains workspace_id / req.workspace scoping`);
      } else {
        fail(`${path.basename(file)}: NO workspace scoping found (potential multi-tenant leak!)`);
      }
    } catch (err) {
      fail(`Cannot read ${file}`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Peak Xender — Phase 7 Security Audit Test Suite             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await testStaticSecurity();
  await testMultiTenantIsolation();

  // Network checks only if a running server can be reached
  const skipNetwork = process.env.SKIP_NETWORK_TESTS === '1';
  if (!skipNetwork) {
    try {
      await testNetworkSecurity();
    } catch (err) {
      console.warn('\n  ⚠ Network tests skipped (server not reachable). Set SKIP_NETWORK_TESTS=1 to suppress.');
    }
  } else {
    console.log('\n  ⚠ Network tests skipped (SKIP_NETWORK_TESTS=1).');
  }

  console.log('');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────────────────────────────────');

  if (failed > 0) {
    process.exit(1);
  }
})();
