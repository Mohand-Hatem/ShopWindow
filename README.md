# ShopWindow 🪟⚡

> **An Educational, Production-Grade Caching Laboratory & Multi-Tier Catalog Platform**  
> Engineered with **NestJS 10**, **Dockerized Redis 7 (LRU)**, **Supabase PostgreSQL**, and **React 19 (Vite + TanStack Query v5 + TailwindCSS v4)**.

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-ea2849?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20+%20Vite-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Cache-Redis%207%20LRU-dc382d?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![TanStack Query](https://img.shields.io/badge/State-TanStack%20Query%20v5-ff4154?style=flat-square&logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![TailwindCSS](https://img.shields.io/badge/Styles-TailwindCSS%20v4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-99%20Unit%20%7C%2036%20E2E-11ff99?style=flat-square)](#-automated-testing-suite)
[![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)](#-license)

---

## 📌 Executive Summary

**ShopWindow** is not just another e-commerce catalog; it is an **empirical engineering laboratory** built to demystify every layer of caching in high-concurrency web systems from first principles.

Instead of treating Redis as an opaque black box, ShopWindow progressively introduces real-world distributed caching patterns, simulates failure scenarios, models high-traffic vulnerabilities, and benchmarks performance under load. It systematically addresses and proves solutions for:
- **Cache Stampedes / Thundering Herd** (collapsing 50 simultaneous cold queries into 1 origin fetch via distributed mutex locks)
- **Cache Penetration** (blocking repeated 404 queries via 30s negative caching sentinels)
- **Cache Avalanches** (eliminating synchronized key expirations using $\pm 10\%$ bounded TTL jitter)
- **Mass List Invalidation Inefficiency** (replacing blocking $\mathcal{O}(N)$ `KEYS *` scans with an atomic $\mathcal{O}(1)$ `listVer` counter)
- **Cascading Redis Downtime Failures** (150ms timeout fail-open bypass delivering 100% availability during container outages)
- **Network Bandwidth Saturation** (RFC 7232 ETag conditional validation returning 304 Not Modified 0-byte payloads)

---

## 🏛️ Multi-Tier Architecture & Resolution Journey

```text
                                [ Client Browser / Web Application ]
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 │                                                                 │
          [ Layer 1: Client Memory Cache ]                                         │
          • TanStack Query v5 (staleTime: 60s, gcTime: 5m)                         │
          • Instant back/forward navigation (0ms latency, 0 network)               │
                 │                                                                 │
                 └────────────────────────────────┬────────────────────────────────┘
                                                  │ Network HTTP Request
                                                  ▼
                 ┌─────────────────────────────────────────────────────────────────┐
                 │ Layer 2: HTTP Conditional ETag Cache (RFC 7232)                 │
                 │ • Header: If-None-Match: W/"<sha256-hash>"                      │
                 │ • Outcome: HTTP 304 Not Modified (0-byte payload, ~1-3ms)       │
                 └────────────────────────────────┬────────────────────────────────┘
                                                  │ If Modified or No ETag Match
                                                  ▼
                 ┌─────────────────────────────────────────────────────────────────┐
                 │ NestJS Modular Monolith API (Port 3000)                         │
                 │ • Hexagonal CachePort Abstraction                               │
                 │ • Query Normalizer (sorted params, whitespace stripped)         │
                 │ • 150ms Timeout Guard (Graceful Fail-Open Bypass)               │
                 └───────────────────┬─────────────────────────┬───────────────────┘
                                     │                         │
                                     ▼                         ▼
        ┌──────────────────────────────────────────┐ ┌─────────────────────────────┐
        │ Layer 3: Distributed L2 Cache (Redis 7)  │ │ Layer 4: L3 Origin Database │
        │ • Policy: allkeys-lru (Maxmemory: 256MB) │ │ • Supabase PostgreSQL       │
        │ • Single-Flight Mutex (SET NX EX)        │ │ • AWS Ireland (eu-west-1)   │
        │ • Dual-Key Invalidation (UUID + Slug)    │ │ • Prisma ORM                │
        │ • O(1) Atomic listVer Invalidation       │ │ • Pooled (6543) & Direct    │
        │ • ±10% Bounded TTL Jitter Entropy        │ │ • Composite Indexes:        │
        │ • 30s Negative Caching Sentinel (404s)   │ │   (categoryId, price)       │
        │ • Latency: ~5-15ms                       │ │ • Latency: ~800-4,000ms     │
        └──────────────────────────────────────────┘ └─────────────────────────────┘
```

---

## ⚡ The 7 Production Caching Invariants

| # | Invariant | Engineering Problem Addressed | Implementation Detail | Empirical Impact |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Deterministic Query Normalization** | Equivalent queries with swapped params (`?limit=10&page=1` vs `?page=1&limit=10`) causing cache fragment duplication. | Alphabetically sorted query keys, whitespace sanitization, default param elision, SHA-256 hashed. | **100% cache key determinism**, 0 duplicate entries for semantically identical requests. |
| **2** | **Single-Flight Lock (Distributed Mutex)** | **Cache Stampede (Thundering Herd):** 50 concurrent requests hitting a cold key all query the database simultaneously. | Atomic Redis `SET prod:lock:<id> <uuid> NX PX 5000` with atomic Lua safe release. 1 request queries origin; 49 wait and read cache. | **Collapsed 50 concurrent DB hits into exactly 1 query** (100% stampede protection). |
| **3** | **$\mathcal{O}(1)$ Version-Based List Invalidation** | Modifying 1 product requires scanning and deleting thousands of paginated/filtered list cache keys (`KEYS prod:list:*` blocks Redis). | Every list key embeds `prod:listVer`. Updating products executes atomic `INCR prod:listVer`. Old keys expire via LRU. | **$\mathcal{O}(1)$ instantaneous invalidation** without blocking Redis event loop. |
| **4** | **Dual-Key Entity Invalidation** | Products are queried both by UUID (`/admin/products/:id`) and by SEO slug (`/products/:slug`). Updating one could leave the other stale. | Both `prod:detail:id:<id>` and `prod:detail:slug:<slug>` invalidated inside an atomic database-first transaction. | **Zero stale reads** across ID and Slug routes. |
| **5** | **Negative Caching for 404s** | **Cache Penetration:** Attackers or bots spamming queries for non-existent IDs bypass cache and hammer database. | Non-existent records cached with sentinel value `{"__negative__": true}` for a short 30-second TTL. | **0 database queries** on repeated 404 probes; immediately purged on product creation. |
| **6** | **TTL Jitter ($\pm 10\%$)** | **Cache Avalanche:** Mass database imports or bulk cache warm-ups expire at the exact same second, overloading the database. | `TtlPolicyService` applies pseudo-random bounded entropy: $\text{TTL}_{\text{jitter}} = \text{TTL} \times (1 + \text{uniform}(-0.1, 0.1))$. | Expiration spikes smoothly distributed across time; zero synchronized stampedes. |
| **7** | **150ms Graceful Degradation (Fail-Open)** | **Cascading Outage:** If Redis crashes or experiences network partition, the API must not return 500 errors to users. | Redis commands wrapped in 150ms timeout promise races. Failures emit `X-Cache: BYPASS` and fetch from PostgreSQL. | **100% availability (0 HTTP 500s)** during complete Redis stoppage. Automatic self-healing on reconnection. |

---

## 📊 Empirical Benchmark Results (Phase 20 Proof)

Automated load tests were conducted using **Autocannon v8** under high concurrency ($c = 50$, duration $= 10\text{s}$) across three operational states:
- **State A (Baseline):** Direct PostgreSQL origin queries (Cache completely disabled).
- **State B (Fully Cached):** Full Redis L2 caching + Single-Flight Locks + Normalized Keys.
- **State C (Degraded Fail-Open):** Redis container forcefully stopped (`docker stop shopwindow-redis`).

| Metric | State A (Baseline Origin) | State B (Fully Cached Redis L2) | State C (Degraded Fail-Open) | Comparative Delta (State B vs State A) |
| :--- | :---: | :---: | :---: | :---: |
| **Throughput (req/s)** | **5.8 req/s** | **850.7 req/s** | **6.1 req/s** | <span style="color:#11ff99; font-weight:bold;">+145.4x Expansion</span> |
| **Total Requests Handled** | 64 requests | 8,507 requests | 67 requests | **+132.8x Total Volume** |
| **Median Latency (p50)** | 3,844 ms | **30 ms** | 3,820 ms | <span style="color:#11ff99; font-weight:bold;">-99.2% Latency Drop</span> |
| **90th Percentile (p90)** | 4,493 ms | **85 ms** | 4,470 ms | **-98.1% Latency Drop** |
| **95th Percentile (p95)** | 4,680 ms | **108 ms** | 4,640 ms | **-97.7% Latency Drop** |
| **99th Percentile (p99)** | 4,874 ms | **142 ms** | 4,810 ms | <span style="color:#11ff99; font-weight:bold;">-97.1% Tail Reduction</span> |
| **Error Rate (5xx Failures)** | 0% | 0% | **0% (100% Available)** | **Zero Fault Cascades** |
| **Header Telemetry** | `X-Cache: MISS` | `X-Cache: HIT` | `X-Cache: BYPASS` | Resilient Fail-Open Verified |

> Full raw benchmark artifacts and analytical breakdowns are archived in [`docs/benchmarks/final-comparison.md`](docs/benchmarks/final-comparison.md).

---

## 🖥️ Interactive Web Applications & Educational Suites

The frontend is an ultra-fast **React 19 single-page application** styled with the **Cinescope Mail** design language (`#000000` void, `rgba(214, 235, 253, 0.19)` frost hairline borders, 9999px pills, Fraunces serif headings, and JetBrains Mono telemetry):

### 1. The Interactive Storefront (`/products`)
- Full-text search and multi-category filtering synchronized to URL query parameters.
- Instant cached responses powered by TanStack Query v5 with zero-network back/forward navigation.
- 4-layer resolution trace inspector showing live cache status (`HIT`, `MISS`, `BYPASS`), response duration, and ETag hashes.

### 2. "How It Works" Educational Master Reference (`/how-it-works`)
- **4 Caching Layers Visualizer:** Detailed technical walkthrough from browser memory to relational database.
- **Request Lifecycle Journey:** Animated decision tree modeling lock acquisition, cache hit/miss, and fallback paths.
- **Metrics Encyclopedia:** Real-world definitions of `p50`, `p90`, `p95`, `p99`, `Throughput (req/s)`, and `Cache Hit Ratio (%)`.
- **Live Interactive Sandbox:** Test live API calls directly inside the browser, viewing exact headers and latency changes.
- **7 Guided Hands-On Scenarios:** Step-by-step instructions to trigger cold misses, warm hits, ETag 304s, list invalidations, negative caching, and chaos bypass mode.

### 3. "Phases Guide" Curriculum Manual (`/explanation-phases`)
- Comprehensive chronological study manual covering **Phase 1 through Phase 20**.
- Every single phase answers the strict **6 architectural questions**:
  1. *What did we build?*
  2. *What problem were we solving?*
  3. *How does it work under the hood?*
  4. *What technical concept was learned?*
  5. *What practical benefit did it give us?*
  6. *How does it connect to the next phase?*
- Features an interactive timeline, live search filter, and category filters (*Foundation*, *Core Caching*, *Advanced Invalidation*, *Resilience & Telemetry*, *Full-Stack Integration*).

### 4. Admin Cache & Telemetry Console (`/admin`)
- Live Redis memory usage, hit ratio, total operations, and real-time cache counters.
- Manual cache purge controls: Purge Product Lists ($O(1)$ `listVer` bump) or Scoped Single-Product Purges.
- Live Inventory Manager: Edit prices or stock levels and observe instant dual-key invalidation.
- Side-by-Side Benchmark Lab: Visual comparison of State A, State B, and State C with percentile bar charts.

### 5. Native View Transitions API
- Page-to-page navigation powered by **React Router 7 Native View Transitions API**.
- **0 kB added JavaScript bundle overhead** with hardware-accelerated 120 FPS transitions on the browser's GPU compositor thread.
- Isolated sticky header (`view-transition-name: site-header`) ensuring rock-solid navigation without flicker.

---

## 🛠️ Tech Stack & Engineering Specifications

### Backend
- **Framework:** NestJS 10 (Node.js 20+, Express)
- **Architecture:** Hexagonal / Ports & Adapters (`CachePort` interface)
- **Database ORM:** Prisma ORM 5 with Supabase PostgreSQL (AWS Ireland)
- **Cache Client:** `ioredis` with connection retry strategy & 150ms command timeout racing
- **HTTP Caching:** Custom RFC 7232 ETag Interceptor with MD5/SHA-256 body hashing
- **Locking:** Redis `SET NX PX` distributed mutex with atomic Lua safe release

### Frontend
- **Framework:** React 19 + TypeScript + Vite 8
- **State Management:** TanStack Query v5 (`@tanstack/react-query`)
- **Styling:** TailwindCSS v4 with custom theme tokens & CSS View Transitions
- **Icons:** Lucide React
- **Routing:** React Router v7 (`react-router-dom`) with native `viewTransition` support

### DevOps & Testing
- **Containerization:** Docker Compose (Redis 7 Alpine, `maxmemory 256mb`, `maxmemory-policy allkeys-lru`)
- **Unit Testing:** Jest (99 unit tests passing with 0 failures)
- **E2E Testing:** Supertest (36 E2E integration tests passing against real PostgreSQL and Redis)
- **Load Testing:** Autocannon v8 with automated markdown and JSON report generation

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher, v20+ recommended)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Redis 7)
- A [Supabase](https://supabase.com/) project or PostgreSQL database

### 2. Clone Repository & Setup Environment
```bash
git clone https://github.com/Mohand-Hatem/ShopWindow.git
cd ShopWindow

# Copy environment variables
cp .env.example .env
```

Ensure your `.env` contains valid credentials:
```env
PORT=3000
DATABASE_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
REDIS_HOST=localhost
REDIS_PORT=6379
ADMIN_API_KEY=shopwindow-super-secret-key-phase18
```

### 3. Start Redis Cache Container
```bash
docker compose up -d

# Verify Redis is healthy and responding
docker exec -i shopwindow-redis redis-cli ping
# Expected output: PONG
```

### 4. Install Dependencies, Migrate & Seed
```bash
# Setup Backend
cd backend
npm install
npx prisma migrate deploy
npm run seed  # Seeds 520 realistic catalog products with composite indexes

# Setup Frontend
cd ../frontend
npm install
```

### 5. Launch the Application
```bash
# Terminal 1: Start Backend (Port 3000)
cd backend
npm run start:dev

# Terminal 2: Start Frontend (Port 5173)
cd frontend
npm run dev
```

Open your browser:
- **Storefront:** [http://localhost:5173/products](http://localhost:5173/products)
- **How It Works:** [http://localhost:5173/how-it-works](http://localhost:5173/how-it-works)
- **Phases Guide:** [http://localhost:5173/explanation-phases](http://localhost:5173/explanation-phases)
- **Benchmark Lab:** [http://localhost:5173/benchmark](http://localhost:5173/benchmark)
- **Admin Console:** [http://localhost:5173/admin](http://localhost:5173/admin)
- **Backend Diagnostics:** [http://localhost:3000/health](http://localhost:3000/health)

---

## 🧪 Automated Testing Suite

```bash
cd backend

# Run all 99 Unit Tests
npm test

# Run all 36 End-to-End Tests against live Redis & PostgreSQL
npm run test:e2e

# Run Cache Stampede Simulation (50 concurrent cold requests)
npm run test:simulation:stampede

# Run Chaos / Graceful Degradation Simulation (Redis container killed)
npm run test:simulation:chaos

# Run Full Comparative Benchmark Suite (State A vs State B vs State C)
npm run test:benchmark:comparative
```

---

## 🗺️ Project Structure

```text
ShopWindow/
├── backend/                        # NestJS 10 Application
│   ├── src/
│   │   ├── admin/                  # Admin cache controller, purge service & API key guards
│   │   ├── cache/                  # CachePort, RedisCacheAdapter, Mutex, TTL Policy, Metrics
│   │   ├── common/                 # RFC 7232 HttpCacheInterceptor, ETag generator
│   │   ├── health/                 # Health controller & database/cache probes
│   │   ├── prisma/                 # PrismaService with connection pooling
│   │   └── products/               # Product catalog, cache-aside queries, pagination
│   ├── test/                       # E2E test suites (catalog-api.e2e-spec.ts)
│   └── prisma/                     # Schema, migrations, and seed scripts
├── frontend/                       # React 19 Single Page App
│   ├── src/
│   │   ├── api/                    # Axios API client & error handlers
│   │   ├── components/             # Cinescope UI components, cards, navigation, layout
│   │   ├── data/                   # Structured curriculum data for Phases 1-20
│   │   ├── hooks/                  # TanStack Query custom hooks (useProducts, useCacheStats)
│   │   └── pages/                  # Catalog, ProductDetail, HowItWorks, ExplanationPhases, Admin
├── docs/                           # Architectural Documentation & Verification Manuals
│   ├── benchmarks/                 # Raw benchmark results and comparative markdown reports
│   ├── phases/                     # Granular phase documentation (Phases 1-20)
│   ├── MASTER_PLAN.md              # 20-Phase Architectural Roadmap
│   └── VERIFICATION_GUIDE.md       # Comprehensive developer verification handbook
├── docker-compose.yml              # Redis 7 Alpine configuration (LRU eviction)
└── README.md                       # Project documentation
```

---

## 📋 The 20 Completed Architectural Phases

- [x] **Phase 0:** Project Infrastructure & Tooling Setup (Docker Redis 7, Supabase, NestJS & Vite init)
- [x] **Phase 1:** Database & Domain Modeling (Prisma schema, composite indexes, 520 seeded products)
- [x] **Phase 2:** Catalog REST API (Uncached baseline endpoints: search, category filters, pagination)
- [x] **Phase 3:** Baseline Performance Benchmarking (Cold Autocannon load test: 3.8s median latency recorded)
- [x] **Phase 4:** Cache Abstraction Layer (`CachePort` interface, `RedisCacheAdapter`, Hexagonal Architecture)
- [x] **Phase 5:** Cache-Aside Pattern for Product Detail (`X-Cache: HIT/MISS` headers, 120x speedup down to ~5-7ms)
- [x] **Phase 6:** Time-To-Live (TTL) Policy & Eviction (`PRODUCT_DETAIL_TTL = 300s`, active expiration, LRU memory protection)
- [x] **Phase 7:** Active Cache Invalidation on Mutations (`AdminProductsService.update/archive`, dual-key eviction)
- [x] **Phase 8:** Product List Caching (`PRODUCT_LIST_TTL = 120s`, multi-dimensional pagination envelopes, ~1,500ms down to ~7ms)
- [x] **Phase 9:** Query Normalization & Stable Cache Keys (Deterministic param sorting, whitespace sanitization, SHA-256 bounding)
- [x] **Phase 10:** Version-Based List Invalidation (`listVer`) ($\mathcal{O}(1)$ mass list invalidation via atomic `INCR prod:listVer`)
- [x] **Phase 11:** Negative Caching for 404s (Cache Penetration Guard: 30s TTL sentinels, 0 DB queries on repeated 404s)
- [x] **Phase 12:** TTL Jitter (Preventing Expiration Avalanches: $\pm 10\%$ bounded entropy, Monte Carlo tests)
- [x] **Phase 13:** Cache Stampede Simulation (The Thundering Herd: 50 concurrent requests produce 50 redundant DB queries)
- [x] **Phase 14:** Single-Flight Lock Pattern (Distributed Mutex: Redis `SET NX EX` + safe Lua release collapses 50 queries into 1)
- [x] **Phase 15:** Graceful Redis Degradation (`X-Cache: BYPASS`: 150ms command timeouts, fail-open to PostgreSQL, zero 500 errors)
- [x] **Phase 16:** HTTP Caching (RFC 7232 ETag, `If-None-Match`, 304 Not Modified, 0-byte payload bandwidth savings)
- [x] **Phase 17:** Cache Telemetry & Real-Time Metrics (Redis atomic counters, hit ratio calculation, `GET /admin/cache/stats`)
- [x] **Phase 18:** Admin Cache Operations (Scoped surgical eviction, O(1) list invalidation, non-blocking SCAN + UNLINK via `POST /admin/cache/purge`)
- [x] **Phase 19:** Modern Storefront UI with TanStack Query (Cinescope Mail design system, 4-layer resolution trace inspector, live admin console)
- [x] **Phase 20:** Final Comparative Integration Benchmark (State A vs State B vs State C empirical load proof: +145x throughput, -99% latency drop)

---

## 📄 License

MIT © 2026 [Mohand Hatem](https://github.com/Mohand-Hatem). Built as an open-source educational reference for distributed systems and high-concurrency caching architectures.
