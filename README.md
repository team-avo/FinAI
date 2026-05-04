# FinAI

> AI-first accounting platform for modern businesses. WhatsApp-native. Zoho-free.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 + shadcn-style components |
| UI Extras | Motion, cmdk, Sonner, Lucide |
| Backend | Next.js Route Handlers + Server Actions |
| ORM | Drizzle (added W3) |
| Database | Neon Postgres (added W3) |
| Auth | Better Auth — magic link (wired W3) |
| AI | Anthropic Claude via Vercel AI SDK (W9) |
| WhatsApp | Meta Cloud API (W14) |
| Queue | Upstash QStash (W13) |
| Storage | Cloudflare R2 (W4) |
| Email | Resend (W9) |
| Lint/Format | Biome |

---

## Getting started

```bash
# Install deps
pnpm install

# Copy env file and fill in values
cp .env.example .env.local

# Run dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server (Turbopack, localhost:3000) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | Biome lint |
| `pnpm lint:fix` | Biome lint + auto-fix |
| `pnpm format` | Biome format |

---

## Phase 1 build schedule (solo)

| Month | Focus |
|-------|-------|
| M1 (now) | Foundation, design system, contacts |
| M2 | Accounting engine, invoices |
| M3 | Invoice delivery, expenses, OCR |
| M4 | AI agent, WhatsApp |
| M5 | Reports, dashboard |
| M6 | Polish, internal cutover |

---

## Auth status

**W1: visual shell only.** Auth UI is built but not wired.
Full Better Auth + magic link integration happens in **W3** once Neon DB is connected.
`DATABASE_URL` and `RESEND_API_KEY` must be set before auth works.

---

## Design language

Dark-first, electric-lime accent (`#d4ff00`), Geist Sans + Mono, 13px dense UI.
Effects: `GridBg`, `Spotlight`, `GlowBorder`, `NumberTicker`, `ShimmerSkeleton`, `GradientMesh` — all in `src/components/effects/`.

Press `⌘K` anywhere in the app to open the command palette.
