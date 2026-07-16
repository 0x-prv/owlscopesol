import "server-only";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { normalizeMintAddress } from "./validation";
import { createPhase2Repository } from "./repository-core.mjs";
export type SavedAnalysis = { id:string; user_id:string; token_id:string|null; mint_address:string; risk_report_id:string|null; token_snapshot_id:string|null; idempotency_key?:string|null; risk_score:number|null; risk_level:string|null; confidence:number|null; reasons:unknown[]; ai_explanation:string|null; source_metadata:Record<string,unknown>; analyzed_at:string; created_at:string; tokens?: { name:string|null; symbol:string|null; logo_url:string|null } | null };
export type WatchlistItem = { id:string; user_id:string; token_id:string|null; mint_address:string; created_at:string; tokens?: { name:string|null; symbol:string|null; logo_url:string|null } | null };
const repository = createPhase2Repository(supabaseAdmin, normalizeMintAddress);
export const { loadCurrentReportSnapshot, createSavedAnalysis, listSavedAnalyses, getSavedAnalysis, deleteSavedAnalysis, listWatchlist, addWatchlistItem, removeWatchlistItem, getLatestRiskByTokenIds, getDashboardData } = repository;
