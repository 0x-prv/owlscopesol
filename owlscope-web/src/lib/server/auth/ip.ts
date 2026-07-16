import "server-only";
import type { NextRequest } from "next/server";
import { isIP } from "net";
export function requestIp(request: NextRequest) {
  const candidates = [request.headers.get("x-vercel-forwarded-for"), request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")]
    .flatMap((h) => h?.split(",") ?? []).map((s) => s.trim()).filter(Boolean);
  return candidates.find((ip) => isIP(ip)) ?? "0.0.0.0";
}
