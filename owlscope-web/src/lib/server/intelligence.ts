import "server-only";

import { supabaseAdmin } from "@/lib/supabase-server";

type TokenRecord = {
  mint_address?: string | null;
  name?: string | null;
  symbol?: string | null;
  logo_url?: string | null;
};

type TokenRelation = TokenRecord | TokenRecord[] | null;

type RiskReportRow = {
  id: string | null;
  token_id: string | null;
  overall_risk_score: number | string | null;
  overall_risk_label: string | null;
  confidence: number | string | null;
  generated_at: string | null;
  tokens?: TokenRelation;
};

type BehaviorEventRow = {
  id: string | null;
  event_type: string | null;
  severity: number | string | null;
  confidence: number | string | null;
  title: string | null;
  summary: string | null;
  detected_at: string | null;
  tokens?: TokenRelation;
};

export type IntelligenceToken = {
  reportId: string;
  tokenId: string;
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  logoUrl: string | null;
  riskScore: number | null;
  riskLabel: string | null;
  confidence: number | null;
  generatedAt: string;
};

export type IntelligenceEvent = {
  id: string;
  eventType: "authority_change" | "holder_concentration_spike";
  severity: number | null;
  confidence: number | null;
  title: string;
  summary: string;
  detectedAt: string;
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  logoUrl: string | null;
};

export type RiskChange = {
  token: IntelligenceToken;
  previousScore: number;
  latestScore: number;
  scoreChange: number;
  previousTimestamp: string;
  latestTimestamp: string;
};

export type IntelligenceMetrics = {
  tokensAnalyzed: number | null;
  completedRiskReports: number | null;
  behaviorEventsDetected: number | null;
  authorityChangesDetected: number | null;
  holderConcentrationChangesDetected: number | null;
  latestCompletedAnalysisTime: string | null;
};

export type IntelligenceData = {
  latestAnalyses: IntelligenceToken[];
  highestRisk: IntelligenceToken[];
  authorityEvents: IntelligenceEvent[];
  holderEvents: IntelligenceEvent[];
  improvedRisk: RiskChange[];
  increasedRisk: RiskChange[];
  metrics: IntelligenceMetrics;
};

function relationToken(tokens: TokenRelation): TokenRecord | null {
  return Array.isArray(tokens) ? tokens[0] : tokens;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRiskReport(row: RiskReportRow): IntelligenceToken | null {
  const token = relationToken(row.tokens ?? null);
  const reportId = nullableString(row.id);
  const tokenId = nullableString(row.token_id);
  const mintAddress = nullableString(token?.mint_address);
  const generatedAt = nullableString(row.generated_at);
  if (!reportId || !tokenId || !mintAddress || !generatedAt) return null;

  return {
    reportId,
    tokenId,
    mintAddress,
    name: nullableString(token?.name),
    symbol: nullableString(token?.symbol),
    logoUrl: nullableString(token?.logo_url),
    riskScore: nullableNumber(row.overall_risk_score),
    riskLabel: nullableString(row.overall_risk_label),
    confidence: nullableNumber(row.confidence),
    generatedAt,
  };
}

function latestPerToken(rows: IntelligenceToken[]) {
  const byMint = new Map<string, IntelligenceToken>();
  for (const row of rows) {
    const existing = byMint.get(row.mintAddress);
    if (!existing || row.generatedAt > existing.generatedAt || (row.generatedAt === existing.generatedAt && row.reportId > existing.reportId)) {
      byMint.set(row.mintAddress, row);
    }
  }
  return [...byMint.values()];
}

async function exactCount(table: "tokens" | "risk_reports" | "behavior_events", eventType?: IntelligenceEvent["eventType"]): Promise<number | null> {
  let query = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  if (table === "risk_reports") query = query.not("generated_at", "is", null);
  if (eventType && table === "behavior_events") query = query.eq("event_type", eventType);
  const { count, error } = await query;
  if (error) {
    console.error(`[intelligence] failed to count ${table}:`, error.message);
    return null;
  }
  return typeof count === "number" ? count : null;
}

async function loadRiskReports() {
  const { data, error } = await supabaseAdmin
    .from("risk_reports")
    .select("id,token_id,overall_risk_score,overall_risk_label,confidence,generated_at,tokens(mint_address,name,symbol,logo_url)")
    .not("generated_at", "is", null)
    .order("generated_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[intelligence] failed to load risk_reports:", error.message);
    return [];
  }

  return ((data ?? []) as RiskReportRow[]).flatMap((row) => mapRiskReport(row) ?? []);
}

async function loadEvents(eventType: IntelligenceEvent["eventType"]): Promise<IntelligenceEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("behavior_events")
    .select("id,event_type,severity,confidence,title,summary,detected_at,tokens(mint_address,name,symbol,logo_url)")
    .eq("event_type", eventType)
    .order("detected_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(`[intelligence] failed to load ${eventType}:`, error.message);
    return [];
  }

  return ((data ?? []) as BehaviorEventRow[]).flatMap((row) => {
    const token = relationToken(row.tokens ?? null);
    const id = nullableString(row.id);
    const title = nullableString(row.title);
    const summary = nullableString(row.summary);
    const detectedAt = nullableString(row.detected_at);
    const mintAddress = nullableString(token?.mint_address);
    if (!id || !title || !summary || !detectedAt || !mintAddress || row.event_type !== eventType) return [];
    return [{
      id,
      eventType,
      severity: nullableNumber(row.severity),
      confidence: nullableNumber(row.confidence),
      title,
      summary,
      detectedAt,
      mintAddress,
      name: nullableString(token?.name),
      symbol: nullableString(token?.symbol),
      logoUrl: nullableString(token?.logo_url),
    }];
  });
}

function riskChanges(reports: IntelligenceToken[]) {
  const grouped = new Map<string, IntelligenceToken[]>();
  for (const report of reports) grouped.set(report.mintAddress, [...(grouped.get(report.mintAddress) ?? []), report]);
  const changes: RiskChange[] = [];
  for (const rows of grouped.values()) {
    const ordered = rows.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.reportId.localeCompare(a.reportId));
    const [latest, previous] = ordered;
    if (!latest || !previous || latest.riskScore === null || previous.riskScore === null) continue;
    if (latest.riskScore === previous.riskScore) continue;
    changes.push({ token: latest, previousScore: previous.riskScore, latestScore: latest.riskScore, scoreChange: Math.round((latest.riskScore - previous.riskScore) * 100) / 100, previousTimestamp: previous.generatedAt, latestTimestamp: latest.generatedAt });
  }
  return changes.sort((a, b) => b.latestTimestamp.localeCompare(a.latestTimestamp) || a.token.mintAddress.localeCompare(b.token.mintAddress));
}

export async function getIntelligenceData(): Promise<IntelligenceData> {
  const [reports, authorityEvents, holderEvents, tokensAnalyzed, completedRiskReports, behaviorEventsDetected, authorityChangesDetected, holderConcentrationChangesDetected] = await Promise.all([
    loadRiskReports(),
    loadEvents("authority_change"),
    loadEvents("holder_concentration_spike"),
    exactCount("tokens"),
    exactCount("risk_reports"),
    exactCount("behavior_events"),
    exactCount("behavior_events", "authority_change"),
    exactCount("behavior_events", "holder_concentration_spike"),
  ]);

  const latestAnalyses = latestPerToken(reports).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || a.mintAddress.localeCompare(b.mintAddress));
  const changes = riskChanges(reports);

  return {
    latestAnalyses: latestAnalyses.slice(0, 10),
    highestRisk: latestAnalyses.filter((report) => report.riskScore !== null).sort((a, b) => (b.riskScore ?? -Infinity) - (a.riskScore ?? -Infinity) || b.generatedAt.localeCompare(a.generatedAt) || a.mintAddress.localeCompare(b.mintAddress)).slice(0, 10),
    authorityEvents,
    holderEvents,
    improvedRisk: changes.filter((change) => change.scoreChange < 0).slice(0, 10),
    increasedRisk: changes.filter((change) => change.scoreChange > 0).slice(0, 10),
    metrics: { tokensAnalyzed, completedRiskReports, behaviorEventsDetected, authorityChangesDetected, holderConcentrationChangesDetected, latestCompletedAnalysisTime: latestAnalyses[0]?.generatedAt ?? null },
  };
}
