import Image from "next/image";
import Link from "next/link";
import { getIntelligenceData, type IntelligenceEvent, type IntelligenceToken } from "@/lib/server/intelligence";
import { formatNumber, formatRelativeTime, truncateAddress } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 30;

function value(value: number | string | null | undefined, suffix = "") {
  return value === null || value === undefined || value === "" ? "Unavailable" : `${value}${suffix}`;
}

function tokenTitle(item: { name: string | null; symbol: string | null; mintAddress: string }) {
  return item.name ?? item.symbol ?? truncateAddress(item.mintAddress);
}

function TokenLogo({ src, alt }: { src: string | null; alt: string }) {
  return src ? <Image src={src} alt={alt} width={44} height={44} className="rounded-xl border border-border bg-background object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-sm font-semibold text-accent">OS</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-surface p-4"><dt className="text-xs uppercase tracking-[0.16em] text-muted">{label}</dt><dd className="mt-2 text-xl font-semibold text-foreground">{value}</dd></div>;
}

function eventPriority(severity: number | null) {
  if (severity === null) return "Unavailable";
  if (severity >= 3) return "High Priority";
  if (severity === 2) return "Medium Priority";
  return "Low Priority";
}

function eventTitle(event: IntelligenceEvent) {
  return event.eventType === "authority_change" ? "Authority Configuration Changed" : "Holder Concentration Increased";
}

function eventSummary(event: IntelligenceEvent) {
  return event.eventType === "authority_change" ? "Authority configuration changed." : event.summary;
}

function whyItMatters(event: IntelligenceEvent) {
  return event.eventType === "authority_change"
    ? "Authority configuration can affect future token administration."
    : "A larger percentage of the supply may now be controlled by fewer wallets.";
}

function AnalysisCard({ token, compact = false }: { token: IntelligenceToken; compact?: boolean }) {
  return <article className="rounded-2xl border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><TokenLogo src={token.logoUrl} alt={tokenTitle(token)} /><div className="min-w-0"><h3 className="font-semibold text-foreground">{tokenTitle(token)}</h3><p className="text-sm text-muted">{value(token.symbol)} · {truncateAddress(token.mintAddress)}</p></div></div><Link href={`/token/${token.mintAddress}`} className="rounded-lg border border-accent/30 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/10">Analyze →</Link></div><dl className={`mt-4 grid gap-3 text-sm ${compact ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}><div><dt className="text-muted">Risk Score</dt><dd className="font-medium text-foreground">{value(token.riskScore)}</dd></div><div><dt className="text-muted">Risk Level</dt><dd className="font-medium text-foreground">{value(token.riskLabel)}</dd></div>{compact ? null : <div><dt className="text-muted">Confidence</dt><dd className="font-medium text-foreground">{value(token.confidence, "%")}</dd></div>}<div><dt className="text-muted">{compact ? "Last Analyzed" : "Analyzed"}</dt><dd className="font-medium text-foreground">{formatRelativeTime(token.generatedAt)}</dd></div></dl></article>;
}

function AlertCard({ event }: { event: IntelligenceEvent }) {
  return <Link href={`/token/${event.mintAddress}`} className="block rounded-2xl border border-border bg-surface p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><TokenLogo src={event.logoUrl} alt={tokenTitle(event)} /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eventPriority(event.severity)}</p><h3 className="mt-1 font-display text-xl font-semibold text-foreground">{eventTitle(event)}</h3><p className="mt-1 text-sm text-muted">{event.symbol ?? truncateAddress(event.mintAddress)} · Detected {formatRelativeTime(event.detectedAt)}</p></div></div><span className="rounded-lg border border-accent/30 px-3 py-2 text-sm font-medium text-accent transition group-hover:bg-accent/10">Open Token Analysis →</span></div><div className="mt-5 grid gap-4 text-sm md:grid-cols-[1fr_1fr_auto]"><div><h4 className="font-semibold text-foreground">What happened?</h4><p className="mt-1 leading-6 text-muted">{eventSummary(event)}</p></div><div><h4 className="font-semibold text-foreground">Why it matters</h4><p className="mt-1 leading-6 text-muted">{whyItMatters(event)}</p></div><div><h4 className="font-semibold text-foreground">What should you review?</h4><p className="mt-1 leading-6 text-muted">Open the token analysis to review Risk Assessment, AI Interpretation, and data provenance. Confidence: {event.confidence === null ? "Unavailable" : `${Math.round(event.confidence * 100)}%`}.</p></div></div></Link>;
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center"><h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>{body ? <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{body}</p> : null}</div>;
}

export default async function IntelligencePage() {
  const data = await getIntelligenceData();
  const alerts = [...data.authorityEvents, ...data.holderEvents].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, 10);
  return <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:py-14"><section className="rounded-2xl border border-border bg-surface px-5 py-9 sm:px-8 sm:py-12"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Solana intelligence platform</p><h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">OwlScope Intelligence</h1><p className="mt-4 max-w-3xl text-base leading-7 text-muted sm:text-lg">Real on-chain intelligence generated from deterministic analysis of Solana token activity.</p><p className="mt-4 max-w-3xl text-sm leading-6 text-muted">OwlScope continuously analyzes tokens, detects meaningful blockchain events, calculates deterministic risk, and explains findings using AI.</p></section><section aria-labelledby="system-overview"><h2 id="system-overview" className="font-display text-2xl font-semibold text-foreground">System Overview</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Tokens Analyzed" value={formatNumber(data.metrics.tokensAnalyzed)} /><Metric label="Risk Reports Generated" value={formatNumber(data.metrics.completedRiskReports)} /><Metric label="On-Chain Events Detected" value={formatNumber(data.metrics.behaviorEventsDetected)} /><Metric label="Authority Changes" value={formatNumber(data.metrics.authorityChangesDetected)} /><Metric label="Holder Changes" value={formatNumber(data.metrics.holderConcentrationChangesDetected)} /><Metric label="Latest Analysis" value={formatRelativeTime(data.metrics.latestCompletedAnalysisTime)} /></dl></section><section aria-labelledby="recent-alerts" className="rounded-3xl border border-border bg-background p-4 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Latest Intelligence</p><h2 id="recent-alerts" className="mt-2 font-display text-3xl font-semibold text-foreground">Recent Intelligence Alerts</h2><p className="mt-2 text-sm leading-6 text-muted">Meaningful on-chain changes detected from persisted blockchain data.</p></div><div className="mt-5 grid gap-4">{alerts.length ? alerts.map((event) => <AlertCard key={event.id} event={event} />) : <EmptyState title="No significant on-chain activity has been detected yet." body="OwlScope will show intelligence alerts here when persisted token data reveals meaningful authority or holder changes." />}</div></section><section id="highest-risk"><h2 className="font-display text-2xl font-semibold text-foreground">Highest Current Risk</h2><p className="mt-2 text-sm leading-6 text-muted">These are the highest deterministic risk assessments currently stored by OwlScope.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{data.highestRisk.length ? data.highestRisk.map((token) => <AnalysisCard key={token.reportId} token={token} compact />) : <EmptyState title="No completed analyses yet." body="Completed deterministic reports will appear here after tokens are analyzed." />}</div></section><section id="token-analyses"><h2 className="font-display text-2xl font-semibold text-foreground">Latest Token Analyses</h2><div className="mt-4 grid gap-4">{data.latestAnalyses.length ? data.latestAnalyses.map((token) => <AnalysisCard key={token.reportId} token={token} />) : <EmptyState title="No completed analyses yet." body="Analyze a Solana token to generate the first deterministic risk report." />}</div></section>{!data.authorityEvents.length || !data.holderEvents.length ? <section aria-label="Alert type empty state copy" className="grid gap-4 md:grid-cols-2">{!data.authorityEvents.length ? <EmptyState title="No authority configuration changes detected." /> : null}{!data.holderEvents.length ? <EmptyState title="No holder concentration increases detected." /> : null}</section> : null}<section aria-labelledby="how-it-works" className="rounded-2xl border border-border bg-surface p-6 sm:p-8"><h2 id="how-it-works" className="font-display text-2xl font-semibold text-foreground">How OwlScope Works</h2><div className="mt-5 grid gap-3 text-center text-sm font-medium text-foreground sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]"><div className="rounded-xl border border-border bg-background p-4">Blockchain Data</div><div className="hidden items-center text-muted sm:flex">→</div><div className="rounded-xl border border-border bg-background p-4">Deterministic Risk Engine</div><div className="hidden items-center text-muted sm:flex">→</div><div className="rounded-xl border border-border bg-background p-4">Behavior Detection</div><div className="hidden items-center text-muted sm:flex">→</div><div className="rounded-xl border border-border bg-background p-4">AI Explanation</div></div><div className="mt-5 grid gap-3 text-sm leading-6 text-muted md:grid-cols-2"><p>Blockchain provides the facts.</p><p>OwlScope calculates deterministic risk from measurable on-chain properties.</p><p>Behavior detection identifies meaningful token changes over time.</p><p>AI explains the findings but never changes the calculated risk score.</p></div></section></main>;
}
