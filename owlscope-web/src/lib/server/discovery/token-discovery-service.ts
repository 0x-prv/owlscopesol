import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { runTokenPipeline } from "../token-pipeline";
import { tokenProviders, type DiscoveredToken, type MarketSnapshot } from "../providers";

type SourceResult = { provider: string; discovered: number; error: string | null };
export type DiscoveryRunResult = { discovered: DiscoveredToken[]; sourceResults: SourceResult[] };

async function persistDiscovery(token: DiscoveredToken) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("tokens").upsert({ mint_address: token.mintAddress, name: token.name, symbol: token.symbol, decimals: token.decimals, logo_url: token.logoUrl, first_seen_at: token.firstSeenAt ?? now, discovery_time: token.discoveredAt, last_updated_at: now, metadata: { source: token.source, source_kind: token.sourceKind, raw: token.raw } }, { onConflict: "mint_address" }).select("id").single();
  if (error) throw new Error(`token upsert failed: ${error.message}`);
  const tokenId = String(data.id);
  await supabaseAdmin.from("token_sources").upsert({ token_id: tokenId, provider: token.source, source_kind: token.sourceKind, source_id: token.sourceId, first_seen_at: token.firstSeenAt ?? now, last_seen_at: now, raw: token.raw }, { onConflict: "token_id,provider,source_kind,source_id" });
  await supabaseAdmin.from("token_discovery_events").insert({ token_id: tokenId, provider: token.source, event_type: token.sourceKind, discovered_at: token.discoveredAt, payload: token.raw });
  await supabaseAdmin.from("token_scan_jobs").insert({ token_id: tokenId, job_type: "analysis", status: "queued", priority: 50, scheduled_at: now });
  await supabaseAdmin.from("token_metadata_cache").upsert({ token_id: tokenId, provider: token.source, name: token.name, symbol: token.symbol, logo_url: token.logoUrl, decimals: token.decimals, fetched_at: now, raw: token.raw }, { onConflict: "token_id,provider" });
}

export async function discoverTokens(): Promise<DiscoveryRunResult> {
  const discovered = new Map<string, DiscoveredToken>();
  const sourceResults: SourceResult[] = [];
  for (const provider of tokenProviders.filter((candidate) => candidate.enabled())) {
    try {
      const tokens = await provider.discoverNewTokens();
      tokens.forEach((token) => discovered.set(`${token.mintAddress}:${token.source}:${token.sourceKind}`, token));
      sourceResults.push({ provider: provider.id, discovered: tokens.length, error: null });
    } catch (error) {
      sourceResults.push({ provider: provider.id, discovered: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const tokens = Array.from(discovered.values());
  for (const token of tokens) {
    try { await persistDiscovery(token); } catch (error) { console.error("[discovery] persist failed", token.mintAddress, error); }
  }
  return { discovered: tokens, sourceResults };
}

export async function analyzeQueuedTokens(limit = 5) {
  const { data } = await supabaseAdmin.from("token_scan_jobs").select("id, token_id, tokens(mint_address)").eq("status", "queued").order("priority", { ascending: false }).limit(limit);
  const jobs = Array.isArray(data) ? data : [];
  for (const job of jobs) {
    const id = String((job as { id: unknown }).id);
    const token = (job as { tokens?: { mint_address?: string } | { mint_address?: string }[] }).tokens;
    const mint = Array.isArray(token) ? token[0]?.mint_address : token?.mint_address;
    if (!mint) continue;
    await supabaseAdmin.from("token_scan_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", id);
    try { await runTokenPipeline(mint); await supabaseAdmin.from("token_scan_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id); }
    catch (error) { await supabaseAdmin.from("token_scan_jobs").update({ status: "failed", error: error instanceof Error ? error.message : String(error), attempts: 1 }).eq("id", id); }
  }
}

export async function getProviderMarket(mint: string): Promise<MarketSnapshot | null> {
  for (const provider of tokenProviders.filter((item) => item.enabled() && item.getMarketSnapshot)) {
    try { const market = await provider.getMarketSnapshot?.(mint); if (market) return market; } catch { /* continue */ }
  }
  return null;
}
