import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { sha256Hex } from "./crypto";

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };
const LIMITS = { nonce: { max: 5, windowSeconds: 60 }, verify: { max: 5, windowSeconds: 300 }, save_analysis: { max: 20, windowSeconds: 600 }, watchlist_mutation: { max: 30, windowSeconds: 600 } } as const;
export async function checkRateLimit(operation: keyof typeof LIMITS, parts: string[]): Promise<RateLimitResult> {
  const limit = LIMITS[operation];
  const key = sha256Hex(parts.join("|"));
  const since = new Date(Date.now() - limit.windowSeconds * 1000).toISOString();
  const { count, error } = await supabaseAdmin.from("auth_rate_limits").select("id", { count: "exact", head: true }).eq("operation", operation).eq("key", key).gte("created_at", since);
  if (error) { console.error("rate limit check failed", { operation, code: error.code }); return { allowed: false, retryAfter: 60 }; }
  if ((count ?? 0) >= limit.max) return { allowed: false, retryAfter: limit.windowSeconds };
  const { error: insertError } = await supabaseAdmin.from("auth_rate_limits").insert({ operation, key });
  if (insertError) console.error("rate limit insert failed", { operation, code: insertError.code });
  return { allowed: true };
}
export const rateLimitPolicy = { nonce: "5/minute per IP+wallet", verify: "5/5 minutes per IP+wallet+nonce", save_analysis: "20/10 minutes per user+IP", watchlist_mutation: "30/10 minutes per user+IP" };
