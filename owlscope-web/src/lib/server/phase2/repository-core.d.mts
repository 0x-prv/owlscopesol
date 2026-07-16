import type { SupabaseClient } from "@supabase/supabase-js";
export type SavedAnalysisCore = { id:string; user_id:string; token_id:string|null; mint_address:string; risk_report_id:string|null; token_snapshot_id:string|null; idempotency_key?:string|null; risk_score:number|null; risk_level:string|null; confidence:number|null; reasons:unknown[]; ai_explanation:string|null; source_metadata:Record<string,unknown>; analyzed_at:string; created_at:string; tokens?: { name:string|null; symbol:string|null; logo_url:string|null } | null };
export type WatchlistItemCore = { id:string; user_id:string; token_id:string|null; mint_address:string; created_at:string; tokens?: { name:string|null; symbol:string|null; logo_url:string|null } | null };
export function createPhase2Repository(client: SupabaseClient | unknown, normalizeMintAddress: (value: unknown) => string | null, monitoring?: { safeEnrollTrackedToken(params:{tokenId:string;mintAddress:string;source:string}): Promise<void>; safeReconcileWatchlistTracking?(mintAddress:string): Promise<void> }): {
  loadCurrentReportSnapshot(mint: string): Promise<unknown | null>;
  createSavedAnalysis(userId: string, mint: string, idempotencyKey?: string | null): Promise<SavedAnalysisCore | null>;
  listSavedAnalyses(userId: string, from?: number, to?: number): Promise<{ rows: SavedAnalysisCore[]; count: number }>;
  getSavedAnalysis(userId: string, id: string): Promise<SavedAnalysisCore | null>;
  deleteSavedAnalysis(userId: string, id: string): Promise<void>;
  listWatchlist(userId: string): Promise<WatchlistItemCore[]>;
  addWatchlistItem(userId: string, mint: string): Promise<WatchlistItemCore | null>;
  removeWatchlistItem(userId: string, rawMint: string): Promise<boolean>;
  getLatestRiskByTokenIds(tokenIds: string[]): Promise<Map<string, { score:number|null; level:string|null; confidence:number|null; generated_at:string|null }>>;
  getDashboardData(userId: string): Promise<{ analyses: SavedAnalysisCore[]; watchlist: WatchlistItemCore[]; latestRisk: Map<string, { score:number|null; level:string|null; confidence:number|null; generated_at:string|null }>; counts: { savedAnalyses: number; watchlist: number; tokensAnalyzed: number; latestSavedAt: string | null } }>;
};
