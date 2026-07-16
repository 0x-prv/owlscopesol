"use client";
import { useEffect, useState } from "react";

type Provider = { publicKey?: { toString(): string }; isPhantom?: boolean; connect?: () => Promise<{ publicKey?: { toString(): string } }>; disconnect?: () => Promise<void>; signMessage?: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>; on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void };
const getProvider = (): Provider | null => (typeof window !== "undefined" ? ((window as unknown as { solana?: Provider }).solana ?? null) : null);
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export function WalletAuthButton() {
  const [wallet, setWallet] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function refresh() { const res = await fetch("/api/auth/me", { cache: "no-store" }); const data = await res.json().catch(() => ({})); setWallet(data.user?.walletAddress ?? null); }
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); const p = getProvider(); const reset = () => { setWallet(null); void refresh(); }; p?.on?.("disconnect", reset); p?.on?.("accountChanged", reset); return () => { window.clearTimeout(timer); p?.off?.("disconnect", reset); p?.off?.("accountChanged", reset); }; }, []);
  async function connect() {
    setBusy(true); setMessage(null);
    try {
      const provider = getProvider();
      if (!provider?.connect || !provider?.signMessage) { setMessage("No compatible injected Solana wallet with message signing was found."); return; }
      const connected = await provider.connect(); const walletAddress = connected.publicKey?.toString() ?? provider.publicKey?.toString();
      if (!walletAddress) { setMessage("Wallet did not provide a public key."); return; }
      const nonceRes = await fetch("/api/auth/nonce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress }) });
      if (!nonceRes.ok) { setMessage("Unable to start wallet authentication."); return; }
      const challenge = await nonceRes.json();
      if ((provider.publicKey?.toString() ?? walletAddress) !== walletAddress) { setMessage("Wallet account changed. Please try again."); return; }
      const signed = await provider.signMessage(new TextEncoder().encode(challenge.message), "utf8");
      if ((provider.publicKey?.toString() ?? walletAddress) !== walletAddress) { setMessage("Wallet account changed. Please try again."); return; }
      const verifyRes = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress, nonce: challenge.nonce, message: challenge.message, signature: b64(signed.signature) }) });
      if (!verifyRes.ok) { setMessage("Wallet authentication failed."); return; }
      await refresh();
    } catch { setMessage("Wallet request was cancelled or failed."); } finally { setBusy(false); }
  }
  async function logout() { setBusy(true); await fetch("/api/auth/logout", { method: "POST" }); try { await getProvider()?.disconnect?.(); } catch {} setWallet(null); setBusy(false); }
  return <div className="flex items-center gap-2"><button onClick={wallet ? logout : connect} disabled={busy} className="rounded-lg border border-accent/30 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-60">{wallet ? "Disconnect" : "Connect Solana Wallet"}</button>{message ? <span className="max-w-48 text-xs text-muted">{message}</span> : null}</div>;
}
