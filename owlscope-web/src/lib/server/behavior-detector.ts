import "server-only";
import { getAssetInfo, getTopHolders } from "./helius";
import { computeTopHolderPct, toUiSupply } from "./risk-engine";
import { supabaseAdmin } from "./supabase-admin";
import { authorityEventFingerprint, authorityState, holderEventFingerprint, shouldEmitHolderConcentration } from "./monitoring-core.mjs";
import { loadDueTrackedTokens, markTrackedTokenFailure, markTrackedTokenSuccess } from "./monitoring";

// Tuned conservatively for MVP scope — authority + holder concentration only.
const HOLDER_CONCENTRATION_DELTA_THRESHOLD = 10; // percentage points
const HOLDER_CONCENTRATION_SEVERITY = 4;
const AUTHORITY_CHANGE_SEVERITY = 3;

type WatchedToken = {
  id: string;
  mint_address: string;
  symbol: string | null;
};

async function insertEvent(params: {
  eventType: "authority_change" | "holder_concentration_spike";
  severity: number;
  confidence: number;
  tokenId: string;
  title: string;
  summary: string;
  evidence: { evidenceType: string; beforeValue: unknown; afterValue: unknown };
  fingerprint: string;
}) {
  const { data: event, error } = await supabaseAdmin
    .from("behavior_events")
    .upsert({
      event_type: params.eventType,
      severity: params.severity,
      confidence: params.confidence,
      token_id: params.tokenId,
      title: params.title,
      summary: params.summary,
      detected_at: new Date().toISOString(),
      occurred_at: new Date().toISOString(),
      event_fingerprint: params.fingerprint,
    }, { onConflict: "event_fingerprint", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[behavior-detector] failed to insert event:", error.message);
    return;
  }
  if (!event) return;

  const { error: evidenceError } = await supabaseAdmin.from("behavior_event_evidence").insert({
    event_id: event.id,
    evidence_type: params.evidence.evidenceType,
    before_value: params.evidence.beforeValue,
    after_value: params.evidence.afterValue,
    source: "helius",
  });

  if (evidenceError) {
    console.error("[behavior-detector] failed to insert evidence:", evidenceError.message);
  }
}

async function checkAuthorityChange(token: WatchedToken) {
  let assetInfo;
  try {
    assetInfo = await getAssetInfo(token.mint_address);
  } catch (error) {
    console.error(`[behavior-detector] getAssetInfo failed for ${token.mint_address}:`, error);
    return;
  }

  const { data: lastSnapshot } = await supabaseAdmin
    .from("authority_snapshots")
    .select("id, mint_authority, freeze_authority")
    .eq("token_id", token.id)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: currentSnapshot } = await supabaseAdmin.from("authority_snapshots").insert({
    token_id: token.id,
    mint_authority: assetInfo.mintAuthority,
    freeze_authority: assetInfo.freezeAuthority,
  }).select("id").single();

  if (!lastSnapshot) return; // first observation, nothing to compare yet

  const mintChanged = lastSnapshot.mint_authority !== assetInfo.mintAuthority;
  const freezeChanged = lastSnapshot.freeze_authority !== assetInfo.freezeAuthority;
  if (!mintChanged && !freezeChanged) return;

  const renounced =
    (mintChanged && assetInfo.mintAuthority === null) ||
    (freezeChanged && assetInfo.freezeAuthority === null);

  const symbol = token.symbol ? `$${token.symbol}` : token.mint_address;

  await insertEvent({
    eventType: "authority_change",
    severity: AUTHORITY_CHANGE_SEVERITY,
    confidence: 0.99,
    tokenId: token.id,
    title: renounced
      ? `Mint or freeze authority renounced on ${symbol}`
      : `Mint or freeze authority changed on ${symbol}`,
    summary: renounced
      ? "Authority state changed to null since the last check."
      : "Authority state changed to a different address since the last check.",
    fingerprint: authorityEventFingerprint({ tokenId: token.id, severity: AUTHORITY_CHANGE_SEVERITY, previousState: authorityState(lastSnapshot.mint_authority, lastSnapshot.freeze_authority), currentState: authorityState(assetInfo.mintAuthority, assetInfo.freezeAuthority), currentSnapshotId: currentSnapshot?.id ?? null }),
    evidence: {
      evidenceType: "account_state",
      beforeValue: { snapshot_id: lastSnapshot.id, mint_authority: lastSnapshot.mint_authority, freeze_authority: lastSnapshot.freeze_authority },
      afterValue: { snapshot_id: currentSnapshot?.id ?? null, mint_authority: assetInfo.mintAuthority, freeze_authority: assetInfo.freezeAuthority },
    },
  });
}

async function checkHolderConcentration(token: WatchedToken) {
  let assetInfo;
  let topHolders;
  try {
    [assetInfo, topHolders] = await Promise.all([
      getAssetInfo(token.mint_address),
      getTopHolders(token.mint_address),
    ]);
  } catch (error) {
    console.error(`[behavior-detector] holder fetch failed for ${token.mint_address}:`, error);
    return;
  }

  const uiSupply = toUiSupply(assetInfo.rawSupply, assetInfo.decimals);
  const currentTop10 = computeTopHolderPct(topHolders, uiSupply, 10);
  if (currentTop10 === null) return; // insufficient data — do not guess

  const { data: lastSnapshot } = await supabaseAdmin
    .from("holder_snapshots")
    .select("id, top_10_pct")
    .eq("token_id", token.id)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: currentSnapshot } = await supabaseAdmin.from("holder_snapshots").insert({
    token_id: token.id,
    top_10_pct: currentTop10,
    top_holders: topHolders.slice(0, 10),
  }).select("id").single();

  if (!lastSnapshot || lastSnapshot.top_10_pct === null) return;

  const delta = currentTop10 - lastSnapshot.top_10_pct;
  if (delta < HOLDER_CONCENTRATION_DELTA_THRESHOLD || !shouldEmitHolderConcentration(lastSnapshot.top_10_pct, currentTop10)) return;

  const symbol = token.symbol ? `$${token.symbol}` : token.mint_address;

  await insertEvent({
    eventType: "holder_concentration_spike",
    severity: HOLDER_CONCENTRATION_SEVERITY,
    confidence: 0.9,
    tokenId: token.id,
    title: `Top 10 holders increased by ${delta.toFixed(1)}pp on ${symbol}`,
    summary: `Top 10 visible holder concentration moved from ${lastSnapshot.top_10_pct.toFixed(
      1
    )}% to ${currentTop10.toFixed(1)}% since the last check.`,
    fingerprint: holderEventFingerprint({ tokenId: token.id, severity: HOLDER_CONCENTRATION_SEVERITY, previousPct: lastSnapshot.top_10_pct, currentPct: currentTop10, currentSnapshotId: currentSnapshot?.id ?? null }),
    evidence: {
      evidenceType: "snapshot_diff",
      beforeValue: { snapshot_id: lastSnapshot.id, top_10_pct: lastSnapshot.top_10_pct },
      afterValue: { snapshot_id: currentSnapshot?.id ?? null, top_10_pct: currentTop10, top_holders: topHolders.slice(0, 10) },
    },
  });
}

export async function runDetectionCycle(): Promise<{ checked: number; errors: number }> {
  const tracked = await loadDueTrackedTokens();
  let errors = 0;
  for (const row of tracked as Array<{ id:string; token_id:string; mint_address:string; priority:number; scan_failures:number; tokens?: WatchedToken | WatchedToken[] | null }>) {
    const relation = Array.isArray(row.tokens) ? row.tokens[0] : row.tokens;
    const token: WatchedToken = { id: row.token_id, mint_address: row.mint_address, symbol: relation?.symbol ?? null };
    try {
      await checkAuthorityChange(token);
      await checkHolderConcentration(token);
      await markTrackedTokenSuccess(row.id, row.priority ?? 0);
    } catch (err) {
      errors += 1;
      await markTrackedTokenFailure(row.id, row.scan_failures ?? 0);
      console.error(`[behavior-detector] error processing ${token.mint_address}:`, err);
    }
  }
  return { checked: tracked.length, errors };
}
