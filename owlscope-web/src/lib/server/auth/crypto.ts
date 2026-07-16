import { createHash, randomBytes, verify as nodeVerify, createPublicKey } from "crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const MAP = new Map([...ALPHABET].map((c, i) => [c, i]));
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

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
  for (const char of value) { if (char === "1") bytes.push(0); else break; }
  return Uint8Array.from(bytes.reverse());
}
export function isValidSolanaPublicKey(value: string) { return base58Decode(value)?.length === 32; }
export function verifySolanaSignature(message: string, signatureBase64: string, wallet: string) {
  const publicKey = base58Decode(wallet);
  if (publicKey?.length !== 32) return false;
  let sig: Buffer;
  try { sig = Buffer.from(signatureBase64, "base64"); } catch { return false; }
  if (sig.length !== 64) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey)]), format: "der", type: "spki" });
    return nodeVerify(null, Buffer.from(message), key, sig);
  } catch { return false; }
}
