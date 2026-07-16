import "server-only";
import { getTrustedAppUrl } from "./config";

export type AuthMessageFields = { walletAddress: string; nonce: string; issuedAt: string; expiresAt: string };
export function buildAuthMessage(fields: AuthMessageFields) {
  const host = getTrustedAppUrl().host;
  return [`${host} wants you to sign in with your Solana wallet:`, fields.walletAddress, "", "Sign in to OwlScope.", "", `URI: ${getTrustedAppUrl().origin}`, "Version: 1", `Nonce: ${fields.nonce}`, `Issued At: ${fields.issuedAt}`, `Expiration Time: ${fields.expiresAt}`].join("\n");
}
