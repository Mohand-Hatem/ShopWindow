#!/bin/sh
set -e

echo "=========================================="
echo " Starting ShopWindow Unified Container   "
echo " (NestJS Monolith + Local Redis 7 LRU)   "
echo "=========================================="

# 1. Start local Redis 7 server daemon with memory protection & LRU policy
echo "[1/3] Starting local Redis 7 daemon..."
redis-server --daemonize yes --maxmemory 128mb --maxmemory-policy allkeys-lru --bind 127.0.0.1 --protected-mode yes

# 2. Wait until Redis is responding to PING
until redis-cli ping > /dev/null 2>&1; do
  echo "[2/3] Waiting for local Redis to respond..."
  sleep 0.1
done

echo "[2/3] Local Redis is HEALTHY and listening on 127.0.0.1:6379"

# 3. Start NestJS backend application
echo "[3/3] Starting NestJS application via node dist/main.js..."
exec node dist/main.js
