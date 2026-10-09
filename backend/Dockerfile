# Multi-stage Dockerfile: NestJS Monolith + In-Container Redis 7
# Builder stage: compile TypeScript & generate Prisma Client
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Runner stage: lightweight production image with local Redis server
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV REDIS_HOST=127.0.0.1
ENV REDIS_PORT=6379

# Install Redis server and cleanup apt cache
RUN apt-get update && apt-get install -y --no-install-recommends \
    redis-server \
    && rm -rf /var/lib/apt/lists/*

# Copy built code and dependencies from builder
COPY package*.json ./
COPY prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copy entrypoint script and sanitize line endings (CRLF to LF)
COPY entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
