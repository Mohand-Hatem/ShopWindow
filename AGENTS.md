<!-- BEGIN:nextjs-agent-rules -->

# Next.js & Modern Frontend Architecture Rules

For Next.js and React frontend development, refer to official version-matched documentation via:
- Documentation Index: https://nextjs.org/docs/llms.txt
- Full Documentation: https://nextjs.org/docs/llms-full.txt
- AI Agent Guide: https://nextjs.org/docs/app/guides/ai-agents.md
- TanStack Query Guide: https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query.md

Key Principles:
1. Ground implementation decisions in official documentation (`source-driven-development`).
2. Coordinate server caching (Redis / Cache Components / HTTP 304 ETags) with browser memory caches (TanStack Query v5).
3. Use `<Suspense>` boundaries for dynamic data and avoid blocking prerender passes.
4. Let runtime errors and compiler feedback drive targeted fixes.

<!-- END:nextjs-agent-rules -->

# ShopWindow Project Context & AI Rules

## 1. Architecture Overview
- **Backend:** NestJS 10 Modular Monolith (Prisma ORM, Supabase PostgreSQL, Dockerized Redis 7 LRU).
- **Frontend:** React 19, Vite, TanStack Query v5, TailwindCSS v4, React Router.
- **Design System:** Cinescope Mail (`#000000` void, `rgba(214, 235, 253, 0.19)` frost borders, 9999px pills, Fraunces serif display headings, Inter sans body, JetBrains Mono telemetry).

## 2. Caching Invariants
- Dual-key invalidation (UUID + Slug).
- O(1) list invalidation via `prod:listVer`.
- 30s negative caching sentinel on 404s (`prod:detail:neg:*`).
- ±10% bounded TTL jitter (`TtlPolicyService`).
- Single-Flight Lock mutex on cold misses.
- 150ms timeout fail-open graceful degradation (`X-Cache: BYPASS`).
- RFC 7232 HTTP ETag validation (304 Not Modified).

## 3. Strict GitHub Policy
- NEVER interact with, access, modify, query, or execute commands affecting the user's GitHub account or remote repositories on GitHub without explicit, direct instruction from the user.
