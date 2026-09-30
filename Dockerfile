# ==============================================================================
# Micro-Redis Dockerfile (Node.js 22 LTS on Alpine)
# ==============================================================================
FROM node:22-alpine AS base

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application source
COPY src/ ./src/

# Run as non-root node user
USER node

EXPOSE 3000

ENV PORT=3000 \
    NODE_ENV=production

# Health check to ensure API and Redis connection are responsive
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/cache/health || exit 1

CMD ["node", "src/server.js"]
