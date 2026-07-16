import { createHash, randomBytes, verify as nodeVerify, createPublicKey } from "crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const MAP = new Map([...ALPHABET].map((c, i) => [c, i]));
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export type SolanaSignatureVerificationFailure =
  | "invalid_wallet"
  | "malformed_signature"
  | "signature_verification_failed";
export type SolanaSignatureVerificationResult = { ok: true } | { ok: false; reason: SolanaSignatureVerificationFailure };

export function sha256Hex(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function randomToken(bytes = 32) { return randomBytes(bytes).toString("base64url"); }
export function base58Decode(value: string): Uint8Array | null {
  if (!value) return null;
  const bytes = [0];
  for (const char of value) {
    const val = MAP.get(char); if (val === undefined) return null;
    let carry = val;
    for (let j = 0; j < bytes.length; ++j) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  let leadingZeroes = 0;
  for (const char of value) { if (char === "1") leadingZeroes += 1; else break; }
  const decoded = bytes.reverse();
  if (decoded.length === 1 && decoded[0] === 0) return Uint8Array.from(new Array(leadingZeroes).fill(0));
  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...decoded]);
}
export function isValidSolanaPublicKey(value: string) { return base58Decode(value)?.length === 32; }

export function decodeSignature(signature: string): Buffer | null {
  const normalized = signature.trim();
  const isBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized);
  const isBase64Url = /^[A-Za-z0-9_-]+={0,2}$/.test(normalized) && !/[+/]/.test(normalized);
  if (!isBase64 && !isBase64Url) return null;
  try {
    const sig = Buffer.from(normalized, isBase64Url && !isBase64 ? "base64url" : "base64");
    const roundTrip = sig.toString(isBase64Url && !isBase64 ? "base64url" : "base64").replace(/=+$/u, "");
    if (roundTrip !== normalized.replace(/=+$/u, "")) return null;
    return sig;
  } catch { return null; }
}

export function verifySolanaSignatureDetailed(message: string, signatureBase64: string, wallet: string): SolanaSignatureVerificationResult {
  const publicKey = base58Decode(wallet);
  if (publicKey?.length !== 32) return { ok: false, reason: "invalid_wallet" };
  const sig = decodeSignature(signatureBase64);
  if (sig?.length !== 64) return { ok: false, reason: "malformed_signature" };
  try {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey)]), format: "der", type: "spki" });
    return nodeVerify(null, new TextEncoder().encode(message), key, sig) ? { ok: true } : { ok: false, reason: "signature_verification_failed" };
  } catch { return { ok: false, reason: "signature_verification_failed" }; }
}
export function verifySolanaSignature(message: string, signatureBase64: string, wallet: string) { return verifySolanaSignatureDetailed(message, signatureBase64, wallet).ok; }
