import "server-only";

export const SESSION_COOKIE_NAME = "owlscope_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const NONCE_TTL_SECONDS = 5 * 60;
export const LAST_SEEN_REFRESH_SECONDS = 10 * 60;

export function getTrustedAppUrl(): URL {
  const raw = process.env.OWLSCOPE_APP_URL;
  if (!raw) throw new Error("Missing OWLSCOPE_APP_URL for wallet authentication");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid OWLSCOPE_APP_URL for wallet authentication"); }
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !localhost) {
    throw new Error("OWLSCOPE_APP_URL must use HTTPS in production");
  }
  return url;
}
