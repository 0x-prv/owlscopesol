import "server-only";
import { getAssetInfo, getTopHolders } from "./helius";
import { supabaseAdmin } from "./supabase-admin";

// Tuned conservatively for MVP scope — authority + holder concentration only.
const HOLDER_CONCENTRATION_DELTA_THRESHOLD = 10; // percentage points
const HOLDER_CONCENTRATION_SEVERITY = 4;
const AUTHORITY_CHANGE_SEVERITY = 3;

type WatchedToken = {
  id: string;
  mint_address: string;
  symbol: string | null;
};

function toUiSupply(rawSupply: string | null, decimals: number | null): number | null {
  if (rawSupply === null || decimals === null || !Number.isFinite(decimals)) return null;
  try {
    const uiSupply = Number(BigInt(rawSupply)) / 10 ** decimals;
    return Number.isFinite(uiSupply) ? uiSupply : null;
  } catch {
    return null;
  }
}

function computeTop10Pct(
  topHolders: { address: string; amount: string }[],
  uiSupply: number | null
): number | null {
  if (uiSupply === null || uiSupply <= 0 || topHolders.length === 0) return null;
  const amounts = topHolders
    .map((h) => Number(h.amount))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  if (amounts.length === 0) return null;
  const top10Sum = amounts.slice(0, 10).reduce((sum, n) => sum + n, 0);
  return (top10Sum / uiSupply) * 100;
}

async function insertEvent(params: {
  eventType: "authority_change" | "holder_concentration_spike";
  severity: number;
  confidence: number;
  tokenId: string;
  title: string;
  summary: string;
  evidence: { evidenceType: string; beforeValue: unknown; afterValue: unknown };
}) {
  const { data: event, error } = await supabaseAdmin
    .from("behavior_events")
    .insert({
      event_type: params.eventType,
      severity: params.severity,
      confidence: params.confidence,
      token_id: params.tokenId,
      title: params.title,
      summary: params.summary,
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !event) {
    console.error("[behavior-detector] failed to insert event:", error?.message);
    return;
  }

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
    .select("mint_authority, freeze_authority")
    .eq("token_id", token.id)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabaseAdmin.from("authority_snapshots").insert({
    token_id: token.id,
    mint_authority: assetInfo.mintAuthority,
    freeze_authority: assetInfo.freezeAuthority,
  });

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
    evidence: {
      evidenceType: "account_state",
      beforeValue: lastSnapshot,
      afterValue: { mintAuthority: assetInfo.mintAuthority, freezeAuthority: assetInfo.freezeAuthority },
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
  const currentTop10 = computeTop10Pct(topHolders, uiSupply);
  if (currentTop10 === null) return; // insufficient data — do not guess

  const { data: lastSnapshot } = await supabaseAdmin
    .from("holder_snapshots")
    .select("top_10_pct")
    .eq("token_id", token.id)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabaseAdmin.from("holder_snapshots").insert({
    token_id: token.id,
    top_10_pct: currentTop10,
    top_holders: topHolders.slice(0, 10),
  });

  if (!lastSnapshot || lastSnapshot.top_10_pct === null) return;

  const delta = currentTop10 - lastSnapshot.top_10_pct;
  if (delta < HOLDER_CONCENTRATION_DELTA_THRESHOLD) return;

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
    evidence: {
      evidenceType: "snapshot_diff",
      beforeValue: { top_10_pct: lastSnapshot.top_10_pct },
      afterValue: { top_10_pct: currentTop10, top_holders: topHolders.slice(0, 10) },
    },
  });
}

export async function runDetectionCycle(): Promise<{ checked: number; errors: number }> {
  const { data: tokens, error } = await supabaseAdmin
    .from("tokens")
    .select("id, mint_address, symbol")
    .order("last_updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[behavior-detector] failed to load watched tokens:", error.message);
    return { checked: 0, errors: 1 };
  }

  let errors = 0;
  for (const token of (tokens ?? []) as WatchedToken[]) {
    try {
      await checkAuthorityChange(token);
      await checkHolderConcentration(token);
    } catch (err) {
      errors += 1;
      console.error(`[behavior-detector] error processing ${token.mint_address}:`, err);
    }
  }

  return { checked: tokens?.length ?? 0, errors };
}