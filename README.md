# BarberScan

> AI hairstyle simulation SaaS for professional barbers and salons (B2B).
> Upload one client photo → generate eight hairstyle previews in **9:16 phone format** → present, save to the client’s gallery, or share a link.

Built on **Next.js 15 (App Router) · TypeScript · TailwindCSS · Prisma · PostgreSQL · Clerk · Stripe · UploadThing · Upstash Redis**, with a **pluggable AI layer** (NanoBananaPRO and/or OpenAI).

---

## Features

- **Client book** — Each new analysis auto-creates a numbered client (`Cliente 1`, `Cliente 2`, …). Barbers can rename or delete clients from the client page. Deleting removes app records only; files in UploadThing are not purged by design.
- **Client gallery** — Per-client page with a mosaic of generated looks, fullscreen **9:16** viewer, native **share to gallery** (mobile share sheet + “Save to Photos”), optional **public share link** (`/share/<token>`) with download.
- **Dual AI engines** — Default **NanoBananaPRO**; optional **OpenAI** path (vision analysis + image generation) for A/B testing. Provider is stored on each `Analysis` row (`aiProvider`, `aspectRatio`).
- **Billing & quotas** — Stripe subscriptions, plan tiers, usage events.

---

## Architecture

```
src/
├── app/
│   ├── (marketing)/              # Public site (landing, pricing)
│   ├── (auth)/                   # Clerk sign-in / sign-up
│   ├── (app)/dashboard/          # Authenticated SaaS (clients, analyses, billing)
│   ├── present/[id]/             # Fullscreen client-presentation mode
│   ├── share/[token]/           # Public shared hairstyle (no auth)
│   └── api/
│       ├── analyze/             # Start pipeline (+ provider override)
│       ├── analyze/[id]/        # Poll analysis status
│       ├── clients/[id]/        # PATCH rename · DELETE client
│       ├── variants/[id]/share  # Issue lazy public token
│       ├── variants/[id]/download  # Authenticated download proxy
│       ├── share/[token]/download  # Public download by token
│       ├── uploadthing/         # Presigned uploads
│       ├── billing/             # Checkout + portal
│       └── webhooks/            # Clerk + Stripe
├── components/
│   ├── ui/                      # ShadCN-style primitives
│   ├── analysis/                # Results, uploader, fullscreen photo viewer
│   ├── clients/                 # Client gallery + inline actions
│   └── billing/
├── lib/
│   ├── ai/                      # Provider registry (NanoBanana · OpenAI)
│   ├── nanobanana/              # Legacy vendor client + prompts + types
│   ├── stripe/
│   ├── auth/
│   └── db.ts, utils.ts, plans.ts, ratelimit.ts
├── server/services/
│   ├── analysis-service.ts      # Pipeline: client allocation → analyze → 8 styles → score
│   └── download.ts              # Stream remote images as attachment downloads
└── middleware.ts                # Clerk protection (public: /share, /api/share)
```

### Request flow — New analysis

```
UI (UploadThing dropzone)
 → POST /api/analyze { imageUrl, imageKey?, provider?, aspectRatio? }
     ├ requireUser()                 (Clerk → DB)
     ├ analyzeRateLimit              (Upstash)
     ├ assertQuotaAvailable()
     ├ startAnalysis()
     │    ├ allocate Cliente N if no clientId
     │    ├ persist Analysis (aiProvider, aspectRatio)
     │    └ runPipeline (fire-and-forget)
     │         ├ provider.analyzeFace(imageUrl)
     │         └ provider.generateHairstyle × 8   (concurrency=3)
     │              → scoreStyleForFace() → StyleVariant rows
     └ returns { id, status }
UI → /dashboard/analyses/:id (polls until COMPLETED)
```

### Public share flow

```
Authenticated: POST /api/variants/:id/share → { url: /share/<token> }
Public: GET /share/<token> (page) · GET /api/share/<token>/download (file)
```

### Why this scales

- **Stateless Next.js** — horizontal scaling on Vercel.
- **Swappable AI** — implement `AIProvider` in `src/lib/ai/providers/` and register in `src/lib/ai/index.ts`.
- **Rate limits + quotas + webhooks** — cost control.
- **Usage ledger (`UsageEvent`)** — analytics and metering; metadata can include `providerId`.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill every value.

| Group | Variables |
|-------|-----------|
| App | `NEXT_PUBLIC_APP_URL` (production domain; used for Stripe return URLs and share links) |
| Database | `DATABASE_URL`, `DIRECT_URL` |
| Auth | `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| Stripe | `STRIPE_*`, `STRIPE_PRICE_*`, webhook secret |
| AI — routing | `AI_PROVIDER` = `nanobanana` \| `openai` (default when request omits `provider`) |
| NanoBananaPRO | `NANOBANANA_API_KEY`, `NANOBANANA_BASE_URL`, `NANOBANANA_TIMEOUT_MS` |
| OpenAI (optional, for A/B) | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ANALYSIS_MODEL` (e.g. `gpt-5.5`), `OPENAI_IMAGE_MODEL` (e.g. `gpt-image-1`), `OPENAI_TIMEOUT_MS` |
| Storage | `UPLOADTHING_TOKEN`, `UPLOADTHING_SECRET` |
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

---

## Local setup

### 1. Prerequisites

- Node.js ≥ 20
- PostgreSQL 15+
- Accounts: [Clerk](https://clerk.com), [Stripe](https://stripe.com), [UploadThing](https://uploadthing.com), [Upstash](https://upstash.com)
- At least one AI backend: **NanoBananaPRO** and/or **OpenAI** (set keys accordingly)

### 2. Install

```bash
npm install
cp .env.example .env.local
# edit .env.local — do not commit secrets
```

### 3. Database

```bash
npm run db:push
npm run db:studio   # optional
```

### 4. Stripe (one time)

Create three Products with **monthly** and **yearly** prices (Starter / Pro / Studio). Copy Price IDs into `STRIPE_PRICE_*`.

Webhook at `https://yourdomain.com/api/webhooks/stripe` for:

`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

Local:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 5. Clerk

- Allow `http://localhost:3000` (and production URL).
- Webhook `/api/webhooks/clerk` → `user.created`, `user.updated`, `user.deleted` → `CLERK_WEBHOOK_SECRET`.

### 6. Run

```bash
npm run dev
# http://localhost:3000
```

---

## GitHub & deployment

1. **Push to GitHub** (this repo is intended to live on GitHub for CI and Vercel import).

   ```bash
   git add -A
   git commit -m "Your message"
   git push origin main
   ```

2. **Vercel** — Import the GitHub repo, set all env vars from `.env.example`, build `npm run build`, install `npm install`.
3. After deploy — Update Clerk origins/webhooks, Stripe webhook URL, and set `NEXT_PUBLIC_APP_URL` to the production domain (required for absolute share URLs).

### Recommended infrastructure

| Concern | Provider | Why |
|---------|-----------|-----|
| Hosting | Vercel | Next.js 15 |
| DB | Neon / Supabase | Postgres, branching |
| Auth | Clerk | B2B-ready auth |
| Payments | Stripe | Subscriptions, portal |
| Storage | UploadThing | Client photo uploads |
| Cache / RL | Upstash | Serverless Redis |
| Jobs | Inngest / Trigger.dev | When pipeline moves off-request |
| Observability | Sentry + Vercel Analytics | Errors and RUM |

---

## Extending

- **New AI vendor** — Add `src/lib/ai/providers/<name>.ts`, implement `AIProvider`, register in `src/lib/ai/index.ts`.
- **Background queue** — Replace inline `runPipeline` with Inngest/QStash.
- **Team / shops** — `Shop` + `User.shopId` exist; add org onboarding and invites.
- **PDF export** — `react-pdf` + `UsageEvent(kind=EXPORT_PDF)`.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (configure project ESLint if prompted) |
| `npm run db:push` | Push Prisma schema |
| `npm run db:migrate` | Create a migration |
| `npm run db:studio` | Prisma Studio |

---

## License

Private / proprietary unless you add an explicit `LICENSE` file.
