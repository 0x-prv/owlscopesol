import Image from "next/image";
import Link from "next/link";
import { getTrendingTokens, type TrendingToken } from "@/lib/server/trending";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(value: number | null) { return value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 6 : 2 }).format(value); }
function numberValue(value: number | null) { return value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value); }
function pct(value: number | null) { return value === null ? "Unavailable" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }
function mint(m: string) { return `${m.slice(0, 4)}…${m.slice(-4)}`; }
function when(iso: string | null) { return iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Unavailable"; }
function risk(token: TrendingToken) { return token.risk ? `${token.risk.score ?? "Unavailable"} · ${token.risk.label ?? "Unlabeled"}` : "Not yet analyzed"; }

function TokenCard({ token }: { token: TrendingToken }) {
  return <article className={`rounded-2xl border bg-surface/60 p-4 shadow-sm ${token.rank <= 3 ? "border-accent/40" : "border-border"}`}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/10 text-sm font-semibold">#{token.rank}</div>
        <Image src={token.tokenLogoUrl || "/owlslogo.jpg"} alt="" width={40} height={40} className="rounded-full bg-background" />
        <div className="min-w-0"><h2 className="truncate font-display text-lg font-semibold">{token.tokenName ?? "Unnamed token"}</h2><p className="text-sm text-muted">{token.tokenSymbol ?? "Unknown"} · {mint(token.mintAddress)}</p></div>
      </div>
      <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted">{token.tokenCategory ?? "Unclassified"}</span>
    </div>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6"><Metric label="Price" value={money(token.priceUsd)} /><Metric label={`Change ${token.priceChangeTimeframe}`} value={pct(token.priceChangePercent)} /><Metric label={`Volume ${token.volumeTimeframe}`} value={money(token.volumeUsd)} /><Metric label="Liquidity" value={money(token.liquidityUsd)} /><Metric label="Trades 24h" value={numberValue(token.tradeCount)} /><Metric label="Trending Score" value={token.trendingScore.toFixed(2)} /></div>
    <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm md:grid-cols-[1fr_auto]"><p className="text-muted">{token.rankingReason}</p><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-background px-2 py-1 text-xs text-muted">Risk: {risk(token)}</span><Link href={`/token/${token.mintAddress}`} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-background">Analyze Risk</Link></div></div>
    <p className="mt-3 text-xs text-muted">Source: {token.source} · Source timestamp: {when(token.sourceTimestamp)}</p>
  </article>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-background p-3"><div className="text-xs uppercase tracking-wide text-muted">{label}</div><div className="mt-1 break-words font-medium text-foreground">{value}</div></div>; }

export default async function TrendingPage() {
  const result = await getTrendingTokens();
  return <main className="mx-auto max-w-6xl px-4 py-10">
    <section className="mb-8 grid gap-5 lg:grid-cols-[1fr_22rem]"><div><h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Trending Across Solana</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">The ten Solana tokens currently receiving the strongest measurable market attention, ranked using verified market activity, trading volume, liquidity, and available participation data.</p><p className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm text-muted">Trending activity measures market attention. It does not represent token safety, project quality, or investment potential.</p></div><aside className="rounded-2xl border border-border bg-surface p-4 text-sm"><h2 className="font-semibold">Market snapshot status</h2><dl className="mt-3 grid gap-2 text-muted"><div><dt className="text-xs uppercase">Provider</dt><dd className="text-foreground">{result.provider}</dd></div><div><dt className="text-xs uppercase">Ranking timeframe</dt><dd className="text-foreground">{result.rankingTimeframe}</dd></div><div><dt className="text-xs uppercase">Source timestamp</dt><dd className="text-foreground">{when(result.sourceTimestamp)}</dd></div><div><dt className="text-xs uppercase">Last successful refresh</dt><dd className="text-foreground">{when(result.lastSuccessfulRefresh)}</dd></div><div><dt className="text-xs uppercase">Status</dt><dd className="text-foreground">{result.status === "current" ? "Updated from current provider data" : result.status === "cached" ? "Cached market snapshot" : "Unavailable"}</dd></div></dl></aside></section>
    <section className="mb-6 rounded-2xl border border-border bg-surface p-4 text-sm text-muted"><h2 className="font-semibold text-foreground">Deterministic score formula</h2><p className="mt-2">OwlScope normalizes each available provider field against the eligible provider set, then applies: 35% 24h volume or volume growth, 25% 24h trade activity, 20% liquidity, 10% participant activity, and 10% absolute 24h price movement. Missing components are omitted and remaining weights are redistributed proportionally. Risk Score is separate and is only shown from existing completed risk reports.</p></section>
    {result.tokens.length ? <div className="grid gap-4">{result.tokens.map((token) => <TokenCard key={token.mintAddress} token={token} />)}</div> : <div className="rounded-2xl border border-border bg-surface p-8 text-center"><h2 className="font-display text-xl font-semibold">Trending data is temporarily unavailable.</h2><p className="mx-auto mt-3 max-w-2xl text-sm text-muted">OwlScope could not retrieve a verified Solana market snapshot. No demo or substitute ranking is being shown.</p>{result.error ? <p className="mt-3 text-xs text-muted">Provider detail: {result.error}</p> : null}</div>}
  </main>;
}
