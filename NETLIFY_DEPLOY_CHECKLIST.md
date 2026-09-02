# Netlify Staging/Preview Deployment Checklist

> This path is for staging and previews only. Production uses the persistent Node API plus one dedicated worker described in `DEPLOYMENT.md`. Never point both schedulers at the same production database.

## ✅ What's Already Set Up

Both `Google-new` and `gfg-main` folders now have:
- ✅ `netlify/functions/scheduler.js` — Scheduled function that runs every 15 seconds
- ✅ `netlify.toml` — Configured with `[[functions]]` scheduler section
- ✅ `.env.example` — All required environment variables
- ✅ `netlify/functions/api.js` — Express.js API wrapper

---

## 🚀 Deployment Steps (Same for Both Folders)

### Step 1: Push to GitHub (5 min)
```bash
cd gfg-main  # or Google-new
git add .
git commit -m "Enable Netlify Scheduled Function for email scheduling"
git push origin main
```

### Step 2: Create Netlify Site (5 min)
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Select your GitHub repository
4. **Important:** Click "Deploy site" (Netlify will auto-detect netlify.toml)

### Step 3: Set Environment Variables (10 min)
Go to **Site Settings** → **Build & Deploy** → **Environment variables** → Add:

```env
# Required
NODE_ENV=production
PORT=3000
JWT_SECRET=<generate: openssl rand -hex 32>
ENCRYPTION_KEY=<generate: openssl rand -hex 32>
FRONTEND_ORIGIN=https://your-site.netlify.app
TRACKING_BASE_URL=https://your-site.netlify.app
ACCESS_PIN=1234
DISABLE_SCHEDULER=true

# Database (CRITICAL - use PostgreSQL, not SQLite)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_LOGIN_REDIRECT_URI=https://your-site.netlify.app/.netlify/functions/api/auth/callback
GOOGLE_ACCOUNT_REDIRECT_URI=https://your-site.netlify.app/.netlify/functions/api/accounts/callback

# Optional: Microsoft Outlook
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_REDIRECT_URI=https://your-site.netlify.app/.netlify/functions/api/accounts/microsoft/callback

# Optional: Batch size per scheduled invocation
SCHEDULER_BATCH_SIZE=10
```

### Step 4: Set Up Database (PostgreSQL)
**⚠️ CRITICAL:** Never use SQLite on Netlify (ephemeral filesystem)

**Option A: Supabase (Recommended)**
1. Go to https://supabase.com
2. Create new project
3. Copy connection string
4. Run migrations: `psql -U user -d dbname < supabase_schema.sql`
5. Set `DATABASE_URL` in Netlify

**Option B: Neon**
1. Go to https://neon.tech
2. Create PostgreSQL database
3. Copy connection string
4. Run migrations
5. Set `DATABASE_URL` in Netlify

### Step 5: Deploy
```bash
# Netlify auto-deploys when you push to GitHub
# Watch build logs at https://app.netlify.com/sites/your-site/deploys

# After first deploy, verify scheduled function is active
```

### Step 6: Verify Scheduled Function (5 min)
1. Go to Netlify **Functions** → **Logs**
2. Wait 15-30 seconds for first scheduled invocation
3. Should see successful execution logs
4. Check for "Dispatch tick executed" message

---

## 🔧 Environment Variable Generator

Generate secure values:
```bash
# Generate JWT_SECRET
openssl rand -hex 32

# Generate ENCRYPTION_KEY
openssl rand -hex 32

# Generate ACCESS_PIN (just a 4-6 digit number)
echo $RANDOM
```

---

## 📊 How It Works on Netlify

```
Timeline:
  00:00 — Netlify invokes scheduler.js
  00:15 — Netlify invokes scheduler.js
  00:30 — Netlify invokes scheduler.js
  00:45 — Netlify invokes scheduler.js
  01:00 — Netlify invokes scheduler.js
  ...

Each invocation:
  1. Calls processNextItem() from scheduler.js
  2. Sends up to SCHEDULER_BATCH_SIZE emails from queue
  3. Records delivery status in database
  4. Returns success/error to Netlify
  5. Netlify logs the execution
```

---

## 🔍 Testing

### Check Scheduler Logs
```bash
# In Netlify dashboard
Functions → Logs → Filter: "scheduler"

# Should see status codes:
# 200 = Success
# 403 = Wrong invocation type (manual HTTP call)
# 500 = Error (check error message)
```

### Manual API Test
```bash
# Check queue status (should show pending items)
curl https://your-site.netlify.app/.netlify/functions/api/queue/status

# Should return something like:
# {
#   "active": true,
#   "interval": "15s",
#   "lastTickAt": "2024-08-12T...",
#   "pendingQueue": 5,
#   "mode": "Scheduled Function"
# }
```

### Test Email Sending
1. Add test recipient to database
2. Create campaign via API
3. Wait 15-30 seconds for next scheduled invocation
4. Check email inbox and Netlify logs

---

## ⚠️ Important Notes

### Schedule Format
- `*/15 * * * * *` = Every 15 seconds (6 invocations/minute)
- `*/5 * * * *` = Every 5 minutes (more efficient)
- `0 * * * *` = Every hour
- Cron times are UTC by default

### Limitations
- ⏱️ **Cold starts**: First invocation may be slow (1-3 seconds)
- 🌍 **Timezone**: All times are UTC, no timezone config
- 📊 **Rate limits**: Free tier: ~25,000 function invocations/month (plenty for every 15 seconds)
- 🐛 **Beta feature**: May change or be removed by Netlify

### Costs
- **Free tier**: Includes ~25,000 function invocations/month
- **Pro tier**: Unlimited invocations
- **Database**: Supabase free tier has 500K requests/month (plenty for this use case)

---

## 📋 Monitoring Checklist

- [ ] Netlify build completes successfully
- [ ] Environment variables set in Netlify dashboard
- [ ] Database connection string tested (DATABASE_URL set)
- [ ] Scheduled function appears in Functions → Logs
- [ ] Scheduled function executes every 15 seconds
- [ ] 200 status codes (success)
- [ ] Queue status endpoint returns pending items
- [ ] Test email received in inbox within 30 seconds of campaign creation

---

## 🆘 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Build fails | netlify.toml syntax error | Check [[functions]] section format |
| Scheduler not running | DISABLE_SCHEDULER=false | Set to `true` in env vars |
| 403 Forbidden in logs | Manual HTTP call to scheduler | Only Netlify can invoke it |
| 500 errors | Database connection failed | Verify DATABASE_URL is correct |
| Emails not sending | Scheduler not running | Check Functions → Logs |
| Cold start delays | Netlify function startup time | Expected on first run, improves after |
| "Cannot find module" | scheduler.js path wrong | Check `require('../../scheduler')` path |

---

## 🎯 Next: Configure Google OAuth (Optional)

To enable Gmail integration:
1. Go to https://console.cloud.google.com
2. Create OAuth 2.0 credentials (Desktop app)
3. Set redirect URI: `https://your-site.netlify.app/.netlify/functions/api/accounts/callback`
4. Copy Client ID and Secret to Netlify env vars
5. Deploy and test OAuth flow

---

## 📖 Related Documentation

- [NETLIFY_SCHEDULER_DEPLOYMENT.md](NETLIFY_SCHEDULER_DEPLOYMENT.md) — Full scheduler options
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment guide
- [QUICKSTART.md](QUICKSTART.md) — Quick start (3 steps)
- [netlify.toml](netlify.toml) — Netlify config
- [netlify/functions/scheduler.js](netlify/functions/scheduler.js) — Scheduled function code

---

## ✅ Deployment Complete!

Once all steps are done:
- ✅ Frontend served on Netlify CDN
- ✅ API running as serverless functions
- ✅ Emails sent every 15 seconds via scheduled function
- ✅ All data persisted in PostgreSQL database
- ✅ No external dependencies (Zapier not needed)
- ✅ No separate backend infrastructure needed

**Cost:** Free to $10/month (depending on database choice)
**Uptime:** 99.9% (Netlify SLA)
**Email Frequency:** Every 15 seconds

---

**Ready to deploy? Follow the steps above and your email platform will be live in ~20 minutes!**
