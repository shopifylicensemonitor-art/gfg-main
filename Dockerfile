# --------------------------------------------------------------------------- #
#  Peak Xender - Multi-stage Production Dockerfile                             #
#                                                                             #
#  Stage 1 (builder): Install all deps & compile the Vite React SPA           #
#  Stage 2 (runner):  Minimal Node runtime, production deps only              #
#                                                                             #
#  Build:  docker build -t peak-xender .                                      #
#  Run web:    docker run -p 3000:3000 --env-file .env peak-xender            #
#  Run worker: docker run --env-file .env peak-xender node worker.js          #
# --------------------------------------------------------------------------- #

# ─── Stage 1: Build frontend ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files and install backend dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

# Copy frontend package files and install frontend dependencies
COPY gfg-main/package.json gfg-main/package-lock.json* ./gfg-main/
RUN npm ci --prefix gfg-main

# Copy full source
COPY . .

# Build the Vite SPA (output → gfg-main/dist)
RUN npm run frontend:build


# ─── Stage 2: Production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runner

# Use non-root user for security
RUN addgroup -S peakx && adduser -S peakx -G peakx

WORKDIR /app

# Copy production node_modules from builder (backend only)
COPY --from=builder /app/node_modules ./node_modules

# Copy server source files
COPY --from=builder /app/app.js \
                    /app/server.js \
                    /app/worker.js \
                    /app/scheduler.js \
                    /app/logger.js \
                    /app/db.js \
                    /app/package.json ./

# Copy subdirectories
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/providers ./providers
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts

# Copy compiled frontend SPA
COPY --from=builder /app/gfg-main/dist ./gfg-main/dist

# Use non-root
USER peakx

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Default command: run the Express web server
# For the worker process, override CMD to: node worker.js
CMD ["node", "server.js"]
