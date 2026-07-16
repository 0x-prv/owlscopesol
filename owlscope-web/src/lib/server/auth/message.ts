import "server-only";
import { getTrustedAppUrl } from "./config";

export type AuthMessageFields = { walletAddress: string; nonce: string; issuedAt: string; expiresAt: string };

function normalizeAuthTimestamp(value: string, fieldName: "issuedAt" | "expiresAt") {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new Error(`Invalid auth message ${fieldName}`);
  return timestamp.toISOString();
}

export function buildAuthMessage(fields: AuthMessageFields) {
  const appUrl = getTrustedAppUrl();
  const issuedAt = normalizeAuthTimestamp(fields.issuedAt, "issuedAt");
  const expiresAt = normalizeAuthTimestamp(fields.expiresAt, "expiresAt");
  return [`${appUrl.host} wants you to sign in with your Solana wallet:`, fields.walletAddress, "", "Sign in to OwlScope.", "", `URI: ${appUrl.origin}`, "Version: 1", `Nonce: ${fields.nonce}`, `Issued At: ${issuedAt}`, `Expiration Time: ${expiresAt}`].join("\n");
}
