# OwlScope

**Deterministic Solana Token Intelligence**

OwlScope is a Solana intelligence platform that transforms raw blockchain data into deterministic risk intelligence and human-readable explanations.

Instead of relying on AI to decide whether a token is risky, OwlScope evaluates measurable on-chain properties using deterministic rules, then uses AI only to explain the findings.

---

# Vision

Blockchain data is transparent but difficult to interpret.

Wallet explorers show transactions.

Market trackers show prices.

OwlScope explains what is happening on-chain and why it matters.

Our goal is to help Solana users understand token behavior through deterministic blockchain analysis rather than speculation.

---

# Current MVP

The current MVP focuses on deterministic token intelligence.

Users can:

- Analyze any supported Solana token
- Generate deterministic risk reports
- View AI explanations
- Monitor meaningful on-chain behavior
- Browse recent intelligence detected by OwlScope

Everything shown inside the product is generated from real blockchain data and persisted analysis.

No mock data.

No demo data.

No seeded intelligence.

---

# Core Features

## Token Analysis

Analyze a Solana token using its mint address.

The analysis includes:

- Risk Assessment
- AI Interpretation
- Current Assessment
- Top Holders
- Data Provenance
- Known Limitations

---

## Deterministic Risk Engine

Risk is calculated using measurable blockchain properties.

Current evaluation includes:

- Mint Authority
- Freeze Authority
- Holder Concentration
- Metadata Integrity

The Risk Engine produces:

- Risk Score
- Risk Level
- Confidence
- Supporting Findings
- Limitations

Risk is deterministic.

The same blockchain state always produces the same result.

---

## AI Interpretation

Artificial Intelligence never calculates the score.

Instead AI explains:

- why the score was produced
- what the findings mean
- what users should understand
- important limitations

This makes the platform easier to understand without changing deterministic results.

---

## Intelligence Dashboard

The Intelligence page displays real persisted findings including:

- Recent Intelligence Alerts
- Highest Current Risk
- Latest Token Analyses
- Authority Configuration Changes
- Holder Concentration Increases

Only persisted blockchain intelligence is displayed.

No synthetic alerts are generated.

---

## Behavior Detection

OwlScope continuously compares persisted blockchain snapshots.

Currently detected events include:

- Authority Configuration Changes
- Holder Concentration Increases

Each event stores:

- Severity
- Confidence
- Summary
- Detection Time

These events become Intelligence Alerts.

---

# How OwlScope Works

Blockchain Data

↓

Deterministic Risk Engine

↓

Behavior Detection

↓

AI Interpretation

Blockchain provides the facts.

OwlScope calculates deterministic intelligence.

AI explains the results.

---

# Product Philosophy

OwlScope is NOT:

- a trading bot
- a prediction engine
- a memecoin ranking website
- a market manipulation detector
- investment advice

OwlScope IS:

- deterministic
- explainable
- measurable
- transparent
- blockchain-first

---

# Technology Stack

Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

Backend

- Next.js Server Components
- Server Actions

Database

- Supabase PostgreSQL

Blockchain

- Solana

Data Providers

- Helius
- Jupiter Price API (where applicable)
- DexScreener (market enrichment where applicable)

AI

- Groq
- Llama 3.1

---

# Architecture

User

↓

Analyze Token

↓

Blockchain Data

↓

Deterministic Risk Engine

↓

Risk Report

↓

Behavior Detection

↓

Persisted Database

↓

AI Interpretation

↓

User Interface

---

# Database

Current tables include:

tokens

Stores token metadata.

token_snapshots

Stores blockchain snapshots.

risk_reports

Stores deterministic risk reports.

behavior_events

Stores meaningful on-chain events.

---

# Deterministic Principles

OwlScope never:

- fabricates scores
- fabricates intelligence
- fabricates rankings
- fabricates blockchain activity

Every displayed result must originate from:

- blockchain data
- deterministic calculations
- persisted reports

---

# Security

- Server-side Supabase access
- No service-role secrets exposed
- AI never receives privileged credentials
- Risk calculations remain deterministic
- No client-side privileged queries

---

# Current Roadmap

## Phase 1 — MVP ✅

- Deterministic Risk Assessment
- AI Interpretation
- Intelligence Dashboard
- Behavior Detection
- Authority Monitoring
- Holder Concentration Detection
- Top Holder Analysis
- Data Provenance

---

## Phase 2 — Personal Intelligence

Planned features:

- Wallet Sign In
- Saved Analyses
- Personal Dashboard
- Recent Searches
- Favorite Tokens

---

## Phase 3 — Monitoring

Planned features:

- Watchlists
- Smart Alerts
- Email Notifications
- Telegram Notifications
- Discord Notifications
- Historical Risk Timeline

---

## Phase 4 — Advanced Intelligence

Planned features:

- Developer Wallet Intelligence
- Liquidity Monitoring
- Smart Money Tracking
- Wallet Relationship Graph
- Historical Behavior Explorer

---

## Phase 5 — Enterprise

Planned features:

- Portfolio Intelligence
- Team Workspaces
- Enterprise Dashboard
- API Access
- Organization Management
- Custom Intelligence Rules

---

# Why OwlScope?

Blockchain explorers show transactions.

Market trackers show prices.

OwlScope explains observable blockchain behavior through deterministic intelligence.

---

# Development

Install

```bash
npm install
```

Run

```bash
npm run dev
```

Lint

```bash
npm run lint
```

Type Check

```bash
npm run typecheck
```

Production Build

```bash
npm run build
```

---

# Environment Variables

Required environment variables depend on the configured providers and deployment.

Typical configuration includes:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

HELIUS_API_KEY

GROQ_API_KEY

CRON_SECRET
```

Never expose server secrets to the browser.

---

# Contributing

Contributions should preserve OwlScope's core principles.

Do not introduce:

- mock data
- seeded intelligence
- fabricated blockchain events
- non-deterministic risk calculations

All new intelligence should remain measurable, reproducible, and explainable.

---

# License

MIT License

---

Built with ❤️ for the Solana ecosystem.
