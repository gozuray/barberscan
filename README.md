# BarberScan

> AI hairstyle simulation SaaS for professional barbers and salons.
> Upload one photo → show your client 8 realistic hairstyles → close the upsell.

Built on **Next.js 15 (App Router) · TypeScript · TailwindCSS · Prisma · PostgreSQL · Clerk · Stripe · NanoBananaPRO · UploadThing · Upstash Redis**.

---

## Architecture

```
src/
├── app/
│   ├── (marketing)/          # Public site (landing, pricing)
│   ├── (auth)/               # Clerk sign-in / sign-up
│   ├── (app)/dashboard/      # Authenticated SaaS dashboard
│   ├── present/[id]/         # Fullscreen client-presentation mode
│   └── api/                  # Route handlers (analyze, billing, webhooks, uploads)
├── components/
│   ├── ui/                   # ShadCN-style primitives
│   ├── analysis/             # Domain components (results, presentation)
│   └── billing/              # Plan + checkout actions
├── lib/
│   ├── nanobanana/           # client.ts · prompts.ts · types.ts
│   ├── stripe/               # client + checkout + portal
│   ├── auth/                 # session + quota guards
│   ├── db.ts, utils.ts, plans.ts, ratelimit.ts
├── server/
│   └── services/
│       └── analysis-service.ts   # Pipeline: analyze → generate 8 styles → score
└── middleware.ts              # Clerk route protection
```

### Request flow — "New Analysis"

```
UI (uploader)
 → /api/uploadthing (presigned upload to UploadThing)
 → POST /api/analyze
     ├ requireUser()               (Clerk → DB)
     ├ analyzeRateLimit.limit()    (Upstash sliding window: 10/min)
     ├ assertQuotaAvailable()      (plan-tier quota)
     ├ startAnalysis()             (creates DB row, usage event)
     │    └ runPipeline(id)        (async fire-and-forget)
     │         ├ nanobanana.analyzeFace()          → face/hair insights
     │         └ generateHairstyle() × 8 styles    (concurrency=3, retries+backoff)
     │              → scoreStyleForFace()          (match%, suitability tag, explanation)
     │              → persist StyleVariant rows
     └ returns {id, status} immediately
UI polls GET /api/analyze/:id every 2.5s until status = COMPLETED.
```

### Why this scales

- **Stateless Next.js server** — runs on Vercel Fn/Edge; horizontal scaling free.
- **Decoupled AI pipeline** — today inline, tomorrow `await inngest.send("analysis.created")` by changing *one line* in `analysis-service.ts`.
- **Rate limiting + quotas + idempotent webhooks** — prevents runaway costs on NanoBananaPRO.
- **Usage ledger (`UsageEvent`)** — append-only for analytics, quota windows, and Stripe metered billing.
- **Append-only DB writes** during pipeline — safe to retry failed jobs without corruption.
- **Single file to swap the AI provider** — `lib/nanobanana/client.ts`.

---

## Local setup

### 1. Prerequisites
- Node.js ≥ 20
- PostgreSQL 15+ (local or Neon/Supabase)
- Accounts with: [Clerk](https://clerk.com), [Stripe](https://stripe.com), [UploadThing](https://uploadthing.com), [Upstash](https://upstash.com), and NanoBananaPRO API access

### 2. Install
```bash
npm install
cp .env.example .env.local
# fill in all values in .env.local
```

### 3. Database
```bash
npm run db:push           # push schema
npm run db:studio         # optional — visual inspector
```

### 4. Stripe setup (one time)
Create three Products in Stripe, each with a **monthly** and **yearly** Price:
- **Starter** — $29/mo, $279/yr → 50 analyses
- **Pro** — $79/mo, $759/yr → 300 analyses
- **Studio** — $199/mo, $1899/yr → unlimited

Copy the six Price IDs into `STRIPE_PRICE_*` env vars.

Add a webhook endpoint at `https://yourdomain.com/api/webhooks/stripe` subscribed to:
```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

For local testing:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 5. Clerk setup
- Add `http://localhost:3000` as an allowed origin.
- Add a webhook at `/api/webhooks/clerk` subscribed to `user.created`, `user.updated`, `user.deleted`. Copy the signing secret to `CLERK_WEBHOOK_SECRET`.

### 6. Run
```bash
npm run dev
# http://localhost:3000
```

---

## Deployment (Vercel)

1. Push repo to GitHub.
2. Import to Vercel.
3. Add every var from `.env.example` to Vercel (Production + Preview).
4. Set the install command to `npm install` and build command to `npm run build` (already default).
5. After first deploy:
   - Update Clerk allowed origins + webhook URL.
   - Update Stripe webhook URL.
   - Point `NEXT_PUBLIC_APP_URL` to your production domain.

### Recommended infrastructure

| Concern          | Provider                    | Why                                  |
|------------------|-----------------------------|--------------------------------------|
| Hosting          | Vercel                      | Zero-config Next.js 15 + Edge        |
| DB               | Neon / Supabase (Postgres)  | Serverless pooling, branching        |
| Auth             | Clerk                       | Orgs, RBAC, social login built-in    |
| Payments         | Stripe                      | Subscriptions, portal, tax           |
| Storage          | UploadThing                 | Presigned uploads, S3 under the hood |
| Cache / RL       | Upstash Redis               | Serverless-friendly, pay-per-request |
| Background jobs  | Inngest / Trigger.dev       | When pipeline moves off the request  |
| Observability    | Sentry + Vercel Analytics   | Error & RUM tracking                 |

---

## Extending

- **Swap the AI provider** — re-implement `analyzeFace` + `generateHairstyle` in `src/lib/nanobanana/client.ts`. No other code needs to change.
- **Background queue** — wrap `runPipeline` in an Inngest/QStash job and remove the inline `.catch`.
- **Team accounts** — `Shop` + `User.shopId` are already modeled; add Clerk Organizations + a `/settings/team` page.
- **White-label** — add a `theme` column to `Shop` and read from Tailwind CSS variables per subdomain.
- **PDF export** — add `react-pdf` rendering the results page; track via `UsageEvent(kind=EXPORT_PDF)`.

---

## Scripts

| Command              | Purpose                          |
|----------------------|----------------------------------|
| `npm run dev`        | Dev server (Turbopack)           |
| `npm run build`      | Production build (runs `prisma generate`) |
| `npm run typecheck`  | TS without emit                  |
| `npm run db:push`    | Push Prisma schema               |
| `npm run db:migrate` | Create a migration               |
| `npm run db:studio`  | Launch Prisma Studio             |
