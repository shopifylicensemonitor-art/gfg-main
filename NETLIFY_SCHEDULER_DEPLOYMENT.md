# Netlify Deployment & Scheduler Guide

This guide explains the current Netlify deployment setup and documents three approaches to handle automatic email sending (the scheduler) in production.

---

## Current Architecture

### Frontend + API on Netlify
- **Frontend**: Static React/Vite app served from `gfg-main/dist`
- **API**: Express.js routes wrapped in serverless functions via `netlify/functions/api.js`
- **Build**: `netlify.toml` runs `cd gfg-main && npm install && npm run build`

### The Problem: Scheduler Cannot Run on Netlify Alone
Netlify Functions are stateless and ephemeral. They spin up to handle a request and shut down when done. The `scheduler.js` worker (which runs every 15 seconds via `node-cron`) cannot persist in a serverless environment.

**Current `scheduler.js` implementation**:
```javascript
// Cron: every 15 seconds (Continuous Server-Side Background Worker)
const schedulerEnabled = process.env.DISABLE_SCHEDULER !== 'true';
if (schedulerEnabled) {
  sendTask = cron.schedule('*/15 * * * * *', async () => {
    try {
      lastTickAt = new Date().toISOString();
      await processNextItem();
    } catch (err) {
      logger.error({ err }, 'Unexpected error in cron send task');
    }
  });
  logger.info('Email worker started (every 15s continuous background dispatch)');
}
```

When deployed **only to Netlify**, this cron task will never run because the Node process terminates immediately after handling HTTP requests.

---

## Solution: Three Options

### Option 1: Separate Always-On Node Host (Recommended for Production)

Deploy the entire backend (`server.js` + `scheduler.js`) to a separate always-on host:
- **Render.io** (Standard tier, ~$7/month)
- **Railway.app** (Usage-based, ~$5/month)
- **Fly.io**
- **AWS EC2**

**Setup**:
1. Push the root directory (with `server.js`, `scheduler.js`, routes, etc.) to a separate repo.
2. Deploy to Render/Railway.
3. Set `FRONTEND_ORIGIN` and API base URLs to point to the backend host.
4. Keep the Netlify frontend-only build for the React app.

**Pros**:
- Full control over scheduler behavior
- Best performance and reliability
- Can scale backend independently

**Cons**:
- Requires two deployments/hosts

---

### Option 2: External Scheduler Service (Netlify + IFTTT/Zapier)

Keep Netlify as-is and use a free external scheduler to trigger the existing `/api/queue/worker/trigger` endpoint every 15 seconds.

**Trigger endpoint** (already exists in `routes/queue.js`):
```javascript
router.post('/worker/trigger', async (req, res) => {
  try {
    processNextItem().catch(() => {});
    res.json({ success: true, message: 'Worker dispatch tick triggered manually.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Setup** using **Zapier** (free tier):
1. Create a "Schedule by Zapier" trigger (every 15 minutes)
2. Add a "Webhooks" action: `POST https://your-netlify-app/.netlify/functions/api/queue/worker/trigger`
3. Test and enable

**Setup** using **EasyCron.com** (free tier):
1. Create a cron job: `https://your-netlify-app/.netlify/functions/api/queue/worker/trigger`
2. Set frequency to every 15 minutes
3. Webhook method: POST

**Pros**:
- No additional hosting cost
- Simple to set up
- Netlify handles everything

**Cons**:
- External dependency (Zapier/EasyCron availability)
- 15-min frequency may be too coarse (batches may send slower)
- Less control over retry logic

---

### Option 3: ~~Netlify Scheduled Function (Beta)~~ [NOT VIABLE]

❌ **DOES NOT WORK**: Netlify's `netlify.toml` parser **does not support** `[[functions]]` (array table) syntax. The parser requires `functions` to be a single object with only these properties: `directory`, `node_bundler`, `included_files`, `external_node_modules`.

Netlify scheduled functions **may exist as a beta UI feature**, but they cannot be configured via `netlify.toml`. Use **Option 1** or **Option 2** instead.

**Error**: `Configuration property functions must be an object.`

---

## Recommended Path Forward

### For Local Development
1. Run `npm start` to start `server.js` + the embedded scheduler
2. The app works out-of-the-box with no external dependencies

### For Production on Netlify (MVP) ⭐ RECOMMENDED FOR NETLIFY-ONLY
**Option 2: External Scheduler Service (Zapier/EasyCron)** - Free & proven
1. Deploy frontend to Netlify (no code changes needed)
2. Set environment variable: `DISABLE_SCHEDULER=true` (disable in-process scheduler)
3. Set up free Zapier/EasyCron trigger to `POST /api/queue/worker/trigger` every 15 minutes
4. **Cost**: $0 (free tier)
5. **Timeline**: 30 minutes
6. **Trade-off**: 15-minute email send delay (acceptable for MVP)

**Why not Option 3?** Netlify's `netlify.toml` parser doesn't support scheduled functions configuration. The feature may exist in the Netlify dashboard UI, but it cannot be configured via TOML.

### For Production with Highest Reliability & Scaling
**Option 1: Separate Always-On Backend** - Best long-term solution
1. Deploy backend to **Render.io** (Standard tier ~$7/mo) or **Railway.app** (~$5/mo)
2. Frontend stays on Netlify
3. Set `API_BASE_URL` in frontend `.env` to point to the backend
4. Full scheduler runs continuously on backend with <15s email delay
5. **Cost**: ~$10/month total
6. **Timeline**: 2-3 hours (separate git repo)

---

## Environment Variables for Netlify

Set these in your Netlify site settings > Build & Deploy > Environment:

```env
# Core
NODE_ENV=production
FRONTEND_ORIGIN=https://send.peakconix.site

# Database
DATABASE_URL=postgresql://user:pass@host/db

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://send.peakconix.site/.netlify/functions/api/accounts/callback

# Tracking & Security
TRACKING_BASE_URL=https://send.peakconix.site
JWT_SECRET=<32-char-random-string>
ENCRYPTION_KEY=<32-char-random-string>
ACCESS_PIN=<4-6-digit-pin>

# Scheduler (if using Option 2)
SCHEDULER_BATCH_SIZE=10
DISABLE_SCHEDULER=true  # Disable cron since external trigger will fire

# Gmail Integration
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GEMINI_API_KEY=...
```

---

## Monitoring & Troubleshooting

### Check Scheduler Health
**Endpoint**: `GET https://send.peakconix.site/.netlify/functions/api/queue/worker/status`

**Response** (should show active status):
```json
{
  "active": true,
  "interval": "15s",
  "lastTickAt": "2024-08-12T10:45:30.123Z",
  "activeCampaigns": 2,
  "pendingQueue": 15,
  "mode": "Server-Side Continuous Worker (Independent of Browser)"
}
```

### Manual Trigger (for testing)
```bash
curl -X POST https://send.peakconix.site/.netlify/functions/api/queue/worker/trigger
```

### Check Logs
1. Go to Netlify dashboard > Functions > Logs
2. Filter for `scheduler` or `queue`
3. Look for "Email sent" or "processing batch" messages

### Common Issues

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| Emails not sending | Scheduler not running | Use external cron trigger (Option 2) |
| "No active scheduler" error | `DISABLE_SCHEDULER=true` + no external trigger | Set up Zapier/EasyCron or deploy backend separately |
| Slow sends | External cron runs every 15 min | Reduce interval to 5-10 min in Zapier |
| OAuth fails | Wrong redirect URI | Ensure `GOOGLE_REDIRECT_URI` matches Google Console |

---

## Next Steps

**✅ To deploy to Netlify with external cron (Recommended for MVP):**

1. Deploy to Netlify immediately:
   ```bash
   git push origin main
   ```
   Build will succeed with clean netlify.toml

2. Set environment variable in Netlify dashboard:
   ```env
   DISABLE_SCHEDULER=true
   ```
   This disables the in-process cron since external trigger will fire.

3. Set up free Zapier trigger (15 minutes to complete):
   - Go to [zapier.com](https://zapier.com)
   - Create **New Zap**
   - Trigger: **Schedule by Zapier** → Every 15 minutes
   - Action: **Webhooks** → **Catch Raw Hook**
   - Configure: `POST https://send.peakconix.site/.netlify/functions/api/queue/worker/trigger`
   - Add basic auth if you want security (optional)
   - **Turn on**

4. Alternatively, use **EasyCron.com** (free tier):
   - Go to [easycron.com](https://www.easycron.com)
   - Create HTTP request: `https://send.peakconix.site/.netlify/functions/api/queue/worker/trigger`
   - Method: POST, Frequency: Every 15 minutes
   - Enable

5. Monitor:
   - Go to Netlify dashboard > Functions > Logs
   - Watch for POST requests to `/api/queue/worker/trigger`
   - Check for successful email dispatch

---

**🚀 To scale with separate backend (production-grade):**

1. Deploy backend to Render/Railway (see **Option 1** above)
2. Frontend stays on Netlify
3. Update frontend `.env` to point to backend API
4. Scheduler runs on backend continuously

---

## Environment Variables for Netlify

```env
# Required for Netlify deployment
NODE_ENV=production
FRONTEND_ORIGIN=https://send.peakconix.site
DISABLE_SCHEDULER=true    # CRITICAL: Disable in-process cron

# Database (PostgreSQL required, SQLite won't persist)
DATABASE_URL=postgresql://user:pass@host/db

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://send.peakconix.site/.netlify/functions/api/accounts/callback

# Security
TRACKING_BASE_URL=https://send.peakconix.site
JWT_SECRET=<32-char-random-string>
ENCRYPTION_KEY=<32-char-random-string>
ACCESS_PIN=<4-6-digit-pin>

# Gmail Integration
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GEMINI_API_KEY=...

# Scheduler (if using external trigger)
SCHEDULER_BATCH_SIZE=10
```
