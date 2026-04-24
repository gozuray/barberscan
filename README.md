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
- **Local dev & AI experiments** — Optional **no-Clerk** mode, **single-image custom prompt** pipeline, and an **`/admin-test`** page to compare **OpenAI** (`images/edits`) vs **Nano Banana Pro gateway** or **Gemini** (when `NANOBANANA_API_KEY` is an `AIza…` key). See [Local development & AI testing](#local-development--ai-testing).

---

## Local development & AI testing

### Environment flags (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `LOCAL_DEV_NO_AUTH=true` | Bypasses Clerk and middleware protection; visiting `/dashboard` auto-creates a single **Local Dev** user. The new-analysis form can use a **paste image URL** path so UploadThing is not required for smoke tests. **Never enable in production.** |
| `AI_USE_CUSTOM_PROMPT=true` | Skips the default face-analysis + eight-style loop. The pipeline sends **one** prompt from `src/lib/ai/custom-prompt.ts` to the active provider (`AI_PROVIDER`) and stores the result like a normal analysis. Useful for iterating on prompts and models. |

### Custom prompt (`src/lib/ai/custom-prompt.ts`)

- **`CUSTOM_HAIRSTYLE_PROMPT`** — Default text is tuned for **identity-preserving hair edits**: change only the hairstyle, keep the same face, glasses, facial hair, clothing, background, and lighting. It includes a **`[HAIRSTYLE]`** placeholder replaced at runtime (admin-test) or you can embed a fixed description in the string for the dashboard pipeline.
- **`POPULAR_HAIRSTYLES`** — Curated English descriptions used by the admin-test UI as quick picks.
- **`CUSTOM_STYLE_NAME`** — Label for the custom style in test mode.

**Why one hairstyle per image:** Asking a single model call for a 2×2 “hairstyle chart” collage usually **re-synthesizes different faces** in each cell. For consistent identity, generate **one look per request** (or generate four images and compose the grid in your own UI).

### Admin test page — `/admin-test`

- Upload a portrait, choose **OpenAI** or **Nano Banana Pro** (see keys below), edit the prompt, pick or type a **hairstyle** (replaces `[HAIRSTYLE]`), and run **Probar API**.
- **OpenAI** uses `POST /v1/images/edits` with `OPENAI_IMAGE_MODEL` (default `gpt-image-1`).
- **Nano** uses `POST /api/admin-test/openai` (filename kept for compatibility), which calls `generateNanoBananaProImage` in `src/lib/nanobanana/bananapro-gateway.ts`.

> **Security:** `/admin-test` and its API route are **not** behind Clerk in the default middleware matcher. Treat them as **dev-only**; remove the routes or add auth before shipping a public production build.

### NanoBananaPRO vs Gemini (same env var, different key shape)

| `NANOBANANA_API_KEY` prefix | Behavior |
|-----------------------------|----------|
| `sk-…` | **Nano Banana Pro** async gateway at `NANOBANANA_BASE_URL` (default `https://gateway.bananapro.site/api`): `POST /v1/images/generate` → poll `GET /v1/images/{task_id}`. |
| `AIza…` | **Google Gemini** `generateContent` on `generativelanguage.googleapis.com` with `NANOBANANA_MODEL` (e.g. `gemini-3-pro-image-preview`) and optional `NANOBANANA_GEMINI_IMAGE_SIZE` (`512` \| `1K` \| `2K` \| `4K`). If `NANOBANANA_BASE_URL` points at the Banana gateway, it is **ignored** for Gemini unless it explicitly contains `generativelanguage.googleapis.com`. |

Face analysis for the legacy Nano client falls back to **OpenAI vision** when `OPENAI_API_KEY` is set, or to safe defaults otherwise (gateway docs do not expose the old `/analyze/face` endpoint).

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
│   ├── admin-test/              # Dev-only: compare OpenAI vs Nano/Gemini (protect in prod)
│   └── api/
│       ├── analyze/             # Start pipeline (+ provider override)
│       ├── analyze/[id]/        # Poll analysis status
│       ├── clients/[id]/        # PATCH rename · DELETE client
│       ├── variants/[id]/share  # Issue lazy public token
│       ├── variants/[id]/download  # Authenticated download proxy
│       ├── share/[token]/download  # Public download by token
│       ├── uploadthing/         # Presigned uploads
│       ├── billing/             # Checkout + portal
│       ├── admin-test/openai/   # Dev image generation (OpenAI edits or Nano/Gemini)
│       └── webhooks/            # Clerk + Stripe
├── components/
│   ├── ui/                      # ShadCN-style primitives
│   ├── analysis/                # Results, uploader, fullscreen photo viewer
│   ├── clients/                 # Client gallery + inline actions
│   └── billing/
├── lib/
│   ├── ai/                      # Provider registry + `custom-prompt.ts` (test / custom pipeline)
│   ├── nanobanana/              # Gateway client, bananapro-gateway (Nano + Gemini), types
│   ├── dev-mode.ts              # LOCAL_DEV_NO_AUTH + AI_USE_CUSTOM_PROMPT flags
│   ├── stripe/
│   ├── auth/
│   └── db.ts, utils.ts, plans.ts, ratelimit.ts
├── server/services/
│   ├── analysis-service.ts      # Pipeline: client allocation → analyze → 8 styles → score
│   └── download.ts              # Stream remote images as attachment downloads
└── middleware.ts                # Clerk protection unless `LOCAL_DEV_NO_AUTH=true` (public: /share, /api/share)
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
| Local dev (optional) | `LOCAL_DEV_NO_AUTH`, `AI_USE_CUSTOM_PROMPT` — see [Local development & AI testing](#local-development--ai-testing) |
| Database | `DATABASE_URL`, `DIRECT_URL` |
| Auth | `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| Stripe | `STRIPE_*`, `STRIPE_PRICE_*`, webhook secret |
| AI — routing | `AI_PROVIDER` = `nanobanana` \| `openai` (default when request omits `provider`) |
| NanoBananaPRO | `NANOBANANA_API_KEY` (`sk-…` for Nano Banana Pro gateway, or `AIza…` for Gemini), `NANOBANANA_BASE_URL` (gateway default `https://gateway.bananapro.site/api`; Gemini uses `generativelanguage.googleapis.com` automatically for `AIza…`), optional `NANOBANANA_MODEL` + `NANOBANANA_GEMINI_IMAGE_SIZE`, `NANOBANANA_TIMEOUT_MS` (gateway task polling budget) |
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
# edit .env.local with your real Clerk, Stripe, UploadThing, Upstash, and AI keys
```

### 3. Database (local)

**Option A — Docker (recommended on your machine)**  
Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose).

```bash
npm run db:up          # starts PostgreSQL 16 on localhost:5432
```

Create a **`.env`** file in the project root (gitignored) with **only** the two URLs Prisma CLI reads — copy the same `DATABASE_URL` and `DIRECT_URL` you use in `.env.local`. The repo ships `docker-compose.yml` with user `barberscan` / password `barberscan` / database `barberscan`:

```env
DATABASE_URL="postgresql://barberscan:barberscan@localhost:5432/barberscan?schema=public"
DIRECT_URL="postgresql://barberscan:barberscan@localhost:5432/barberscan?schema=public"
```

Then apply the schema:

```bash
npm run db:push
npm run db:studio   # optional
```

Stop Postgres when finished: `npm run db:down`.

**Option B — Hosted Postgres**  
Use Neon, Supabase, or any Postgres URL. Put `DATABASE_URL` and `DIRECT_URL` in **both** `.env.local` (Next.js) and `.env` (Prisma CLI), then `npm run db:push`.

### 4. Run the app locally

```bash
npm run dev
```

Open **http://localhost:3000**. The dashboard and APIs need valid Clerk, DB, Redis, UploadThing, and AI keys; the marketing pages work with fewer secrets.

### 5. Stripe (one time)

Create three Products with **monthly** and **yearly** prices (Starter / Pro / Studio). Copy Price IDs into `STRIPE_PRICE_*`.

Webhook at `https://yourdomain.com/api/webhooks/stripe` for:

`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

Local:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 6. Clerk

- Allow `http://localhost:3000` (and production URL).
- Webhook `/api/webhooks/clerk` → `user.created`, `user.updated`, `user.deleted` → `CLERK_WEBHOOK_SECRET`.

---

## GitHub & deployment

1. **Push to GitHub** — Do not commit `.env.local` or `.env` (they are gitignored). Stage source and config templates only, then push your branch (e.g. `main`).

   ```bash
   git status
   git add -A
   git commit -m "Describe your change"
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
| `npm run db:up` | Start local Postgres (`docker compose up -d`) |
| `npm run db:down` | Stop local Postgres (`docker compose down`) |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (configure project ESLint if prompted) |
| `npm run db:push` | Push Prisma schema |
| `npm run db:migrate` | Create a migration |
| `npm run db:studio` | Prisma Studio |

---

## License

Private / proprietary unless you add an explicit `LICENSE` file.
