import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../supabase-admin";
import { LAST_SEEN_REFRESH_SECONDS, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "./config";
import { sha256Hex } from "./crypto";

export function setSessionCookie(response: NextResponse, token: string, expires: Date) {
  response.cookies.set(SESSION_COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires, maxAge: SESSION_TTL_SECONDS });
}
export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}
export async function validateSession(request: NextRequest, response?: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token || token.length < 32 || token.length > 256) { if (token && response) clearSessionCookie(response); return null; }
  const hash = sha256Hex(token);
  const { data, error } = await supabaseAdmin.from("wallet_sessions").select("id,user_id,expires_at,revoked_at,last_seen_at,created_at,wallet_users(id,wallet_address)").eq("session_token_hash", hash).maybeSingle();
  if (error) { console.error("session lookup failed", { code: error.code }); return null; }
  const user = Array.isArray(data?.wallet_users) ? data?.wallet_users[0] : data?.wallet_users;
  if (!data || !user || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) { if (response) clearSessionCookie(response); return null; }
  if (Date.now() - new Date(data.last_seen_at).getTime() > LAST_SEEN_REFRESH_SECONDS * 1000) {
    const { error: refreshError } = await supabaseAdmin.from("wallet_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
    if (refreshError) console.error("last_seen refresh failed", { code: refreshError.code });
  }
  return { sessionId: data.id as string, userId: data.user_id as string, walletAddress: user.wallet_address as string, expiresAt: data.expires_at as string };
}
export async function revokeSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;
  const { error } = await supabaseAdmin.from("wallet_sessions").update({ revoked_at: new Date().toISOString() }).eq("session_token_hash", sha256Hex(token)).is("revoked_at", null);
  if (error) console.error("logout revoke failed", { code: error.code });
}
