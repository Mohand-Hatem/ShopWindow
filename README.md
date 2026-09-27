# ShopWindow 🪟⚡

> **An Educational, Production-Grade Caching Laboratory**  
> Built with **NestJS**, **Docker Redis**, **Supabase PostgreSQL**, and **React (Vite + TanStack Query)**.

---

## 📌 About The Project

ShopWindow is not just an e-commerce catalog application; it is an **engineering laboratory** designed to teach every layer of caching from first principles.

Instead of treating Redis as a magic black box, ShopWindow progressively introduces real-world caching patterns, benchmarks performance, intentionally exposes edge cases (cache stampedes, penetration, invalidation bugs, cascading failures), and engineers resilient production solutions.

---

## 🏗️ Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│             Storefront & Admin UI (Phase 19)           │
│             React + Vite + TanStack Query              │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST
                           ▼
┌────────────────────────────────────────────────────────┐
│                 NestJS Modular Monolith                │
│         - Products, Categories, Admin, Health          │
│         - Decoupled CachePort (Hexagonal Architecture) │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│     Docker Redis 7 (Local)   │ │  Supabase PostgreSQL (Cloud) │
│ - Port 6379                  │ │ - AWS Ireland (eu-west-1)    │
│ - Maxmemory 256MB            │ │ - Prisma ORM                 │
│ - Policy: allkeys-lru        │ │ - Transaction Pooler: 6543   │
│ - Single-flight mutex locks  │ │ - Session Direct: 5432       │
└──────────────────────────────┘ └──────────────────────────────┘
```

- **Backend:** NestJS 10, TypeScript 5, Express, Prisma ORM, `ioredis`
- **Cache Store:** Redis 7 (Alpine) running via Docker Compose with LRU eviction
- **Database:** Supabase PostgreSQL with pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connections
- **Load Testing:** Autocannon v8 for automated latency percentiles and RPS benchmarking
- **Frontend:** React 18, Vite, TypeScript, TailwindCSS, TanStack Query v5

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Redis)
- A [Supabase](https://supabase.com/) project

### 2. Environment Setup
Copy the sample environment file and configure your Supabase connection strings:
```bash
cp .env.example .env
```

### 3. Start Redis Cache
```bash
docker compose up -d
```
Verify the container:
```bash
docker exec -i shopwindow-redis redis-cli ping
# Should respond: PONG
```

### 4. Install Dependencies & Seed Database
```bash
cd backend
npm install

# Run database migrations and seed realistic catalog (520 products)
npx prisma migrate deploy
npm run seed
```

### 5. Run the Backend
```bash
npm run start:dev
```
The API will be live at `http://localhost:3000`.  
Check system diagnostics: `curl http://localhost:3000/health`.

### 6. Run Automated Tests
```bash
# Unit tests (CachePort & ProductsService)
npm test

# Full E2E integration test suite
npm run test:e2e

# Run Autocannon baseline load test
npm run test:load:baseline
```

---

## 📈 Roadmap & Completed Phases

- [x] **Phase 0:** Project Infrastructure (Docker Redis LRU, Supabase connection, NestJS & Vite init)
- [x] **Phase 1:** Database & Domain Modeling (Prisma schema, composite indexes, 520 seeded products)
- [x] **Phase 2:** Catalog REST API (Uncached baseline endpoints: search, category filters, pagination)
- [x] **Phase 3:** Baseline Performance Benchmarking (Cold Autocannon load test: ~3.8s median latency recorded)
- [x] **Phase 4:** Cache Abstraction Layer (`CachePort` interface, `RedisCacheAdapter`, Hexagonal Architecture)
- [x] **Phase 5:** Cache-Aside Pattern for Product Detail (`X-Cache: HIT/MISS` headers, 120x speedup down to ~5-7ms)
- [ ] **Phase 6:** Time-To-Live (TTL) Policy & Eviction
- [ ] **Phase 7:** Active Cache Invalidation (Write Path Mutation)
- [ ] **Phase 8:** Product List Caching (Multi-Dimensional Key Generation)
- [ ] **Phase 9:** Query Normalization & Stable Cache Keys
- [ ] **Phase 10:** Version-Based List Invalidation (`listVer`)
- [ ] **Phase 11:** Negative Caching (404 Cache Penetration Guard)
- [ ] **Phase 12:** TTL Jitter (Preventing Expiration Avalanches)
- [ ] **Phase 13:** Cache Stampede Simulation (The Thundering Herd)
- [ ] **Phase 14:** Single-Flight Lock Pattern (Distributed Mutex)
- [ ] **Phase 15:** Graceful Redis Degradation (`X-Cache: BYPASS`)
- [ ] **Phase 16:** HTTP Caching (ETag, `If-None-Match`, 304 Not Modified)
- [ ] **Phase 17:** Cache Telemetry & Real-Time Metrics
- [ ] **Phase 18:** Admin Cache Operations (Purge & Stats)
- [ ] **Phase 19:** Modern Storefront UI with TanStack Query & Dual-Panel Benchmark Dashboard
- [ ] **Phase 20:** Final Comparative Integration Benchmark & Post-Mortem

---

## 📄 License
UNLICENSED — Educational Laboratory Project.
