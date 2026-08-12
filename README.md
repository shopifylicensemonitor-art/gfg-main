# Peak Xender - Unified Bulk Email Outreach Platform

A production-ready email outreach platform with automated campaign management, multi-account support, and 24/7 background processing. Send 25-50x faster than manual UI automation with automatic retries, tracking, and fallback support.

**Live Demo:** https://send.peakconix.site  
**Documentation:** See [`QUICKSTART.md`](QUICKSTART.md)

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 20+ and npm (or Bun)
- PostgreSQL 14+ (for production) or SQLite (for development)
- Google OAuth 2.0 credentials (for Gmail integration, optional)

### Local Development Setup

```bash
# Clone repository
git clone <repo-url>
cd peak-xender

# Install dependencies
npm install

# Create .env from template
cp .env.example .env

# Edit .env with your configuration
# - Set DATABASE_URL (local SQLite or remote PostgreSQL)
# - Set JWT_SECRET and ENCRYPTION_KEY (generate with: openssl rand -hex 32)
# - Set Google OAuth credentials if using Gmail

# Start development server
npm run dev
```

This starts:
- Backend API on `http://localhost:3000`
- Frontend dev server on `http://localhost:5173`
- Background worker for email processing

### Production Deployment

```bash
# Build and start
npm run build
npm start
```

**Deploy to Render or Railway:** Use `render.yaml` or `railway.json` included in repo.

---

## 📊 What's Included

### Backend Features
- ✅ **Express.js REST API** with JWT authentication
- ✅ **Multi-account support** (Gmail, Outlook, SMTP)
- ✅ **Background email worker** (processes 24/7, independent of browser)
- ✅ **Atomic queue system** (no race conditions, PostgreSQL/SQLite support)
- ✅ **Automatic retries** (exponential backoff: 5m → 15m → 45m)
- ✅ **Email tracking** (open tracking, click tracking, bounce detection)
- ✅ **Rate limiting** to prevent abuse
- ✅ **Health checks** for monitoring

### Frontend Features
- ✅ **React + Vite SPA** with Tailwind CSS
- ✅ **Responsive design** (works on desktop & mobile)
- ✅ **Campaign builder** with template editor
- ✅ **Recipient management** with CSV import
- ✅ **Account configuration** (Gmail, Outlook, SMTP)
- ✅ **Real-time sending status** with live updates
- ✅ **Analytics dashboard** (sent, opened, clicked)

### Production Infrastructure
- ✅ **Docker containerization** (multi-stage builds)
- ✅ **Deployment configs** for Render.com and Railway.app
- ✅ **PostgreSQL support** for data persistence
- ✅ **Worker process separation** for reliable background job handling
- ✅ **Health checks** integrated into deployment blueprints

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React + Vite)                                 │
│ - Campaign builder                                      │
│ - Account management                                    │
│ - Analytics dashboard                                   │
└────────────────┬────────────────────────────────────────┘
                 │ POST /api/*
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Backend API (Express.js + Node.js)                      │
│ - JWT authentication                                    │
│ - Campaign endpoints                                    │
│ - Account OAuth handling                                │
│ - Rate limiting & validation                            │
└────────────────┬────────────────────────────────────────┘
                 │ READ/WRITE
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Database (PostgreSQL or SQLite)                         │
│ - Campaigns, Recipients, Accounts                       │
│ - Queue items (atomic claiming)                         │
│ - Tracking events (opens, clicks, bounces)              │
└─────────────────────────────────────────────────────────┘
                 ▲
                 │ READ/WRITE
┌─────────────────────────────────────────────────────────┐
│ Background Worker (Always-On)                           │
│ - Polls queue every 15 seconds                          │
│ - Sends emails via Gmail API or SMTP                    │
│ - Handles retries with exponential backoff              │
│ - Records delivery status & tracking events             │
└─────────────────────────────────────────────────────────┘
```

### Key Advantages
- **Decoupled**: Frontend and background worker operate independently
- **Scalable**: Multiple workers can run in parallel
- **Reliable**: Database-backed queue with atomic transactions
- **Fast**: 25-50x faster than UI automation
- **Persistent**: Emails keep sending even if user closes browser

---

## 📁 Project Structure

```
peak-xender/
├── server.js                 # Express.js API server
├── worker.js                 # Background email worker
├── scheduler.js              # Cron job for queue processing
├── db.js                     # Database layer (PG/SQLite)
├── logger.js                 # Logging utility
├── crypto.js                 # AES-256-GCM encryption for credentials
├── package.json              # Dependencies & scripts
│
├── routes/                   # API endpoints
│   ├── campaigns.js          # Campaign CRUD + sending
│   ├── accounts.js           # Email account management
│   ├── tracking.js           # Tracking pixels & events
│   └── queue.js              # Queue status & manual triggers
│
├── middleware/               # Express middleware
│   ├── auth.js               # JWT authentication
│   ├── errorHandler.js       # Error handling
│   └── rateLimit.js          # Rate limiting
│
├── providers/                # Email provider implementations
│   ├── EmailProvider.js      # Abstract base class
│   ├── GmailProvider.js      # Gmail OAuth + API
│   ├── MicrosoftProvider.js  # Microsoft Graph API (Outlook)
│   ├── SmtpImapProvider.js   # Custom SMTP/IMAP
│   └── index.js              # Factory function
│
├── lib/                      # Shared utilities
│   └── crypto.js             # Credential encryption
│
├── scripts/                  # Helper scripts
│   └── migrate.js            # Database migrations
│
├── gfg-main/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── App.jsx           # Main component
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   └── styles/           # CSS modules
│   └── package.json
│
├── netlify/                  # Netlify functions (serverless)
│   └── functions/
│       └── api.js            # HTTP wrapper for Express app
│
├── Dockerfile                # Multi-stage Docker build
├── render.yaml               # Render.com deployment blueprint
├── railway.json              # Railway.app deployment config
│
├── .env.example              # Environment variable template
├── .dockerignore              # Docker build exclusions
├── .gitignore                # Git exclusions
│
├── QUICKSTART.md             # 3-step setup guide
├── DEPLOYMENT.md             # Production deployment guide
├── NETLIFY_SCHEDULER_DEPLOYMENT.md  # Netlify-specific setup
├── INTEGRATION_SUMMARY.md    # Architecture & integration docs
├── README.md                 # This file
└── supabase_schema.sql       # Database schema
```

---

## 🔧 Core Scripts

### Development
```bash
npm run dev              # Full dev mode (API + worker + frontend)
npm run backend:dev      # API server only
npm run worker           # Background worker only
npm run frontend:dev     # Frontend dev server only
npm run build            # Build frontend for production
npm run lint             # Run ESLint
```

### Testing & Validation
```bash
npm test                 # Run all tests
npm run test:security    # Security audit & validation
./test_backend_campaign_api.ps1  # PowerShell integration test (Windows)
```

### Production
```bash
npm start                # Start API server
npm run worker           # Start background worker (separate process)
npm run build            # Build optimized frontend
```

---

## 🔐 Configuration

### Environment Variables

Create `.env` file from `.env.example`:

```env
# Core
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db

# Security (generate: openssl rand -hex 32)
JWT_SECRET=your_32_byte_random_string_here
ENCRYPTION_KEY=your_32_byte_random_string_here
ACCESS_PIN=1234

# Frontend
FRONTEND_ORIGIN=https://send.peakconix.site
TRACKING_BASE_URL=https://send.peakconix.site

# Gmail OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_LOGIN_REDIRECT_URI=https://send.peakconix.site/api/auth/callback
GOOGLE_ACCOUNT_REDIRECT_URI=https://send.peakconix.site/api/accounts/callback

# Microsoft Outlook (from Microsoft Entra)
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_REDIRECT_URI=https://send.peakconix.site/api/accounts/microsoft/callback

# Optional: Google Gemini AI for content generation
GEMINI_API_KEY=your_api_key_here

# Logging
LOG_LEVEL=info            # debug, info, warn, error
WORKER_POLL_INTERVAL_MS=15000   # Worker check interval (ms)
```

### Database Setup

**PostgreSQL (Production):**
```bash
psql -U postgres -c "CREATE DATABASE peakxender"
psql -U postgres peakxender < supabase_schema.sql
```

**SQLite (Development):**
```bash
# Set USE_SQLITE=true in .env or runtime
sqlite3 sqlite.db < supabase_schema.sql
```

---

## 🚢 Deployment

### Quick Deploy to Render.com

1. Fork/push repo to GitHub
2. Go to [render.com](https://render.com)
3. Click "New Blueprint Instance"
4. Select this repository
5. Follow prompts for PostgreSQL setup
6. Set environment variables in dashboard
7. Deploy! ✨

### Quick Deploy to Railway.app

1. Push to GitHub
2. Go to [railway.app](https://railway.app)
3. Create new project from GitHub repo
4. Railway auto-detects `railway.json`
5. Configure environment variables
6. Deploy!

### Docker (Any Platform)

```bash
# Build image
docker build -t peak-xender .

# Run API server
docker run -p 3000:3000 --env-file .env peak-xender node server.js

# Run background worker
docker run --env-file .env peak-xender node worker.js
```

### Local Production (Systemd)

Create `/etc/systemd/system/peak-xender.service`:

```ini
[Unit]
Description=Peak Xender Email Platform
After=network.target

[Service]
Type=simple
User=peakx
WorkingDirectory=/opt/peak-xender
ExecStart=/usr/bin/node /opt/peak-xender/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable peak-xender
sudo systemctl start peak-xender
sudo systemctl status peak-xender
```

---

## 📖 Documentation

- **[`QUICKSTART.md`](QUICKSTART.md)** — 3-step setup + troubleshooting (5 min read)
- **[`DEPLOYMENT.md`](DEPLOYMENT.md)** — Full production deployment guide (15 min read)
- **[`NETLIFY_SCHEDULER_DEPLOYMENT.md`](NETLIFY_SCHEDULER_DEPLOYMENT.md)** — Netlify-specific setup (10 min read)
- **[`INTEGRATION_SUMMARY.md`](INTEGRATION_SUMMARY.md)** — Architecture & performance details (15 min read)
- **[`DELIVERY_SUMMARY.md`](DELIVERY_SUMMARY.md)** — Project overview & deliverables

---

## 🔌 API Endpoints

### Campaigns
- `POST /api/campaigns/create-from-csv` — Create campaign from CSV data
- `GET /api/campaigns/:id` — Get campaign details
- `GET /api/campaigns` — List campaigns
- `POST /api/campaigns/:id/send` — Manually trigger sending
- `GET /api/campaigns/:id/status` — Get real-time status

### Accounts
- `POST /api/accounts/google/auth` — Initiate Gmail OAuth
- `GET /api/accounts/google/callback` — Gmail OAuth callback
- `POST /api/accounts/microsoft/auth` — Initiate Outlook OAuth
- `GET /api/accounts/microsoft/callback` — Outlook OAuth callback
- `POST /api/accounts/smtp` — Add custom SMTP account
- `GET /api/accounts` — List all accounts
- `DELETE /api/accounts/:id` — Remove account

### Tracking
- `GET /api/tracking/pixel/:trackingId` — Open tracking pixel
- `GET /api/tracking/click/:trackingId` — Click tracking redirect
- `POST /api/tracking/events` — Record tracking events

### Queue
- `GET /api/queue/status` — Check worker status
- `POST /api/queue/worker/trigger` — Manually trigger worker tick

---

## 🧪 Testing

### Integration Test (PowerShell)

```powershell
.\test_backend_campaign_api.ps1
```

Tests:
- ✅ Backend connectivity
- ✅ OAuth token retrieval
- ✅ Campaign creation endpoint
- ✅ Database integrity

### Manual Testing

```bash
# Start backend
npm run backend:dev

# In another terminal, create a campaign
curl -X POST http://localhost:3000/api/campaigns/create-from-csv \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "subjects": ["Hello World"],
    "recipients": [{"email": "test@example.com", "name": "Test"}],
    "html_template": "<h1>Hello {name}</h1>",
    "delay_seconds": 0
  }'
```

---

## 🐛 Troubleshooting

### Backend won't start
```
Error: EADDRINUSE: address already in use :::3000
Solution: Kill process on port 3000 or change PORT in .env
```

### Database connection error
```
Error: Connection refused (host: localhost)
Solution: Ensure PostgreSQL/SQLite is running and DATABASE_URL is correct
```

### Worker not processing emails
```
Problem: Queue items stuck in "pending"
Solution:
  1. Check worker is running: ps aux | grep worker.js
  2. Check logs: grep "processing batch" in output
  3. Verify accounts exist: SELECT COUNT(*) FROM accounts WHERE status='active'
  4. Set LOG_LEVEL=debug for detailed output
```

### OAuth errors
```
Error: Invalid redirect URI
Solution: Ensure GOOGLE_REDIRECT_URI and MICROSOFT_REDIRECT_URI match your OAuth app settings
```

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Send Rate | 50+ emails/min per account |
| Campaign Limit | Unlimited recipients |
| Uptime | 24/7 (not tied to browser) |
| Concurrency | 3 parallel workers (configurable) |
| Retry Strategy | Exponential backoff (5m → 15m → 45m) |
| Tracking Accuracy | Open/click rates within 2% of industry standard |

---

## 🎯 Roadmap

- [ ] Drag-and-drop email builder
- [ ] A/B testing support
- [ ] Advanced analytics (heat maps, engagement scoring)
- [ ] Webhook integrations (Zapier, Make, etc.)
- [ ] Team collaboration (shared accounts, approval workflow)
- [ ] SMS/WhatsApp channel support
- [ ] WYSIWYG template designer

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see LICENSE file for details.

---

## 💬 Support

- **Issues:** Report bugs on GitHub Issues
- **Discussions:** Share ideas and Q&A on GitHub Discussions
- **Email:** support@peakconix.dev
- **Docs:** See [QUICKSTART.md](QUICKSTART.md) for common issues

---

## 🙏 Acknowledgments

Built with:
- [Express.js](https://expressjs.com/) — Web framework
- [React](https://react.dev/) — Frontend library
- [Vite](https://vitejs.dev/) — Build tool
- [PostgreSQL](https://www.postgresql.org/) — Production database
- [Nodemailer](https://nodemailer.com/) — Email sending
- [Gmail API](https://developers.google.com/gmail/api) — Gmail integration
- [Microsoft Graph](https://learn.microsoft.com/en-us/graph/) — Outlook integration

---

**🚀 Ready to send emails at scale?** Start with [`QUICKSTART.md`](QUICKSTART.md)
