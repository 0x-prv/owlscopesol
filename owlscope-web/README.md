# OwlScope Web

OwlScope Web is the primary deployable Next.js full-stack application for Solana token risk intelligence. It runs a deterministic risk engine first, then asks Groq to explain that fixed report in plain language. The product does not produce trading signals and does not fabricate missing market data.

## Architecture

- `src/app` — Next.js App Router pages and API routes.
- `src/components` — UI components for search, token identity, risk scoring, AI explanation, and visible top holders.
- `src/lib/server` — server-only backend modules:
  - `helius.ts` fetches Helius `getAsset` and `getTokenLargestAccounts` data.
  - `jupiter.ts` fetches Jupiter Price API data.
  - `risk-engine.ts` contains the deterministic POC scoring engine.
  - `groq-explainer.ts` contains the real Groq explanation layer with deterministic fallback.
  - `supabase-admin.ts` creates the Supabase service-role client.
  - `token-pipeline.ts` orchestrates fetches, persistence, risk scoring, explanation, and typed API output.
- `src/services/token-intelligence-service.ts` reads previously persisted token intelligence for server-rendered token pages.
- `owlscope-poc` remains as an archive/reference folder until production integration is complete.

## Local setup

```bash
cd owlscope-web
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and paste a Solana token mint address.

## Environment variables

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `HELIUS_API_KEY` | Yes | Server only | Helius RPC/DAS token identity, supply, authorities, and largest-token-account data. |
| `GROQ_API_KEY` | Recommended | Server only | Groq chat completions for AI explanation. Without it, deterministic fallback text is used. |
| `GROQ_MODEL` | No | Server only | Groq model name. Defaults to `llama-3.1-8b-instant`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public URL | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Service-role key for trusted backend upserts/inserts. Never expose it to clients. |

## Supabase requirements

The application expects these tables/columns:

- `tokens`: `id`, `mint_address`, `name`, `symbol`, `decimals`, `mint_authority`, `freeze_authority`, `metadata`, `last_updated_at`.
- `token_snapshots`: `id`, `token_id`, `price_usd`, `market_cap_usd`, `liquidity_usd`, `volume_24h_usd`, `holder_count`, `top_holders`, `source`, `snapshot_at`.
- `risk_reports`: `id`, `token_id`, `overall_risk_score`, `overall_risk_label`, `developer_risk_score`, `liquidity_risk_score`, `holder_concentration_score`, `confidence`, `risk_factors`, `ai_summary`, `ai_headline`, `ai_findings`, `ai_limitations`, `ai_provider`, `ai_model`, `ai_generated_at`, `generated_at`.

Use RLS for browser-facing access. The service-role client is imported only from `server-only` modules.

## API usage

Analyze a token:

```bash
curl http://localhost:3000/api/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

Successful responses contain `success: true`, typed token identity, snapshot, deterministic risk report, AI explanation, and `dataAvailabilityWarnings`. Invalid mint addresses return HTTP 400. Server failures return safe error messages without stack traces or secrets.

## Deployment

1. Provision Supabase tables and service-role secret.
2. Add all environment variables in the hosting provider.
3. Deploy `owlscope-web` as the application root.
4. Run `npm run build` during deployment.

## Known data limitations

- Holder concentration uses Helius `getTokenLargestAccounts` visible top accounts only, not a complete holder graph.
- Total holder count is not provided by the current data source.
- Liquidity, 24h volume, wallet history, developer behavior, and trading recommendations are not evaluated.
- If Helius, Jupiter, Supabase, or Groq fail, returned fields remain unavailable and warnings state which provider operation failed.

## Ecosystem discovery milestone

OwlScope now includes a modular server-only ingestion layer under `src/lib/server/providers`. Every provider implements the common `TokenDiscoveryProvider` contract from `providers/types.ts` and can be enabled, disabled, or replaced without coupling to another provider. Current adapters cover Helius lookup, Jupiter token list and price data, DexScreener listings/pairs, and Pump.fun launches.

### Worker architecture

`src/lib/server/discovery/token-discovery-service.ts` is the background-worker boundary. It runs each enabled provider independently, catches provider failures, persists real discoveries, queues scan jobs, and exposes helpers for queued analysis. The first API trigger is `POST /api/discover`; deployments can call it from a cron, queue worker, or Supabase Edge schedule.

### Database

The ecosystem schema is documented as SQL in `supabase/migrations/20260713000000_ecosystem_coverage.sql`. It adds:

- `tokens`
- `token_sources`
- `token_discovery_events`
- `token_scan_jobs`
- `token_metadata_cache`
- `scan_history`
- `watchlists`
- `alerts`

Existing `token_snapshots` and `risk_reports` remain the analysis-report tables.

### Search flow

The search bar accepts mint addresses, symbols, names, partial text, and provider-backed live lookups. `/api/search` queries Supabase first. If there is no local match, it attempts live lookup through providers and persists a real analysis result for mint-backed matches. If no source returns data, the UI returns a clear no-match message instead of fabricated results.

### Discovery flow

Discovery reads real public/authorized sources only. Each provider returns typed `DiscoveredToken` records with source metadata. Failures are isolated per provider, so one outage does not block other sources. New discoveries are written to `tokens`, `token_sources`, `token_discovery_events`, `token_metadata_cache`, and `token_scan_jobs`.

### Refresh flow

Queued jobs are represented in `token_scan_jobs`. `analyzeQueuedTokens()` runs the existing deterministic token pipeline for queued work. Future refresh workers can reuse the same job table for metadata, price, holders, AI, cleanup, and retry jobs.

### API routes

- `GET /api/token/[mint]` — run/persist analysis for a mint.
- `GET /api/search?q=` — search Supabase first, then live providers.
- `POST /api/discover` — run one discovery cycle.
- `GET /api/new` — newest persisted discoveries.

### UI pages

- `/` — Analyze/search.
- `/new` — Newest real discoveries.
- `/intelligence` — First-party OwlScope intelligence from persisted analyses and behavior events.
- `/trending` — Compatibility redirect to `/intelligence`.
- `/token/[mint]` — Token intelligence report.

### Remaining limitations

OwlScope Intelligence is intentionally conservative: it only exposes persisted token analyses and behavior events produced by the application. Alert delivery and authenticated watchlists have schema support but still require productized auth, notification channels, and dedicated worker scheduling.
