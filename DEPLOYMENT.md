# Production Deployment Guide

This document describes the persistent production deployment for Peak Xender / OutreachFlow Pro. Use the separate Netlify configuration only for staging/preview environments.

## 1. Architecture Overview
The application is a Full-Stack Node.js monolith:
- **Backend**: Express.js REST API (`server.js`) plus one separate always-on queue worker (`worker.js` & `scheduler.js`).
- **Frontend**: React (Vite) single-page application compiled to static files (`gfg-main/dist`).
- **Database**: Supports PostgreSQL (recommended for production) or SQLite (fallback for local dev).

## 2. Build & Start Commands
When configuring your deployment on a cloud provider, use the following commands:

- **Build Command**: `npm install && npm run build`
  *(This installs root and frontend dependencies, builds the Vite React app, and moves the static assets into the root `dist` folder).*
- **API Start Command**: `npm start`
  *(This executes `node server.js`, serving the API and static frontend.)*
- **Worker Start Command**: `npm run worker`
  *(Run exactly one worker process against the production queue.)*

## 3. Database Configuration (CRITICAL)
Cloud providers like Render and Railway use **ephemeral file systems**. If you use the default SQLite database (`sqlite.db`), your data will be permanently wiped every time the server restarts or deploys.

**For Production:**
1. Provision a **PostgreSQL** database addon in your cloud provider dashboard.
2. Copy the provided connection string.
3. Set the `DATABASE_URL` environment variable to this connection string. The application will automatically detect it and use PostgreSQL instead of SQLite.

## 4. Environment Variables
You must configure the following Environment Variables in your cloud provider's dashboard:

### Core Configuration
| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment context. | `production` |
| `PORT` | The port the server binds to (usually auto-injected by the provider). | `3000` |
| `JWT_SECRET` | A long, secure random string used to sign auth tokens. | `your_secure_jwt_secret_32_chars` |
| `ENCRYPTION_KEY` | A 32-character key for encrypting SMTP credentials/tokens in the DB. | `super_secret_encryption_key_32!!` |
| `ACCESS_PIN` | The PIN required for initial app access / admin registration. | `1234` |
| `FRONTEND_ORIGIN` | The public URL of your deployed application. | `https://send.peakconix.site` |
| `TRACKING_BASE_URL` | The public URL used for email open tracking & unsubscribe links. | `https://send.peakconix.site` |

### Database
| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Prevents data loss on restart). | `postgresql://user:pass@host:5432/db` |

### Integrations (Optional but Recommended)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key for AI generation features. | `AIzaSy...` |
| `GMAIL_CLIENT_ID` | OAuth2 Client ID for Gmail integration. | `...apps.googleusercontent.com` |
| `GMAIL_CLIENT_SECRET` | OAuth2 Client Secret for Gmail integration. | `GOCSPX-...` |
| `GMAIL_REDIRECT_URI` | OAuth2 Redirect URI (must match Google Cloud Console). | `https://send.peakconix.site/api/accounts/oauth/callback` |

## 5. Background Worker (24/7 Sending)
Run exactly one dedicated `npm run worker` process. It polls the queue every 15 seconds by default and dispatches queued emails.
- **Important**: Keep both the API and worker on non-sleeping services.
- Do not run the Netlify scheduled function against the same production database.
- If using Render's Free Tier, the instance will spin down after 15 minutes of inactivity, pausing your email dispatching. Upgrade to a paid/standard tier or use Railway to ensure 24/7 background worker execution.

## 6. Domain & DNS Setup
To ensure optimal email deliverability and that tracking/unsubscribe links work:
1. Map your custom domain (e.g., `send.peakconix.site`) to your cloud provider.
2. Ensure SSL/TLS (HTTPS) is enabled.
3. Update `FRONTEND_ORIGIN` and `TRACKING_BASE_URL` to match this exact custom domain (including `https://`).
