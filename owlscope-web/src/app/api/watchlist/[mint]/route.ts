import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/server/auth/session";
import { checkRateLimit } from "@/lib/server/auth/rate-limit";
import { requestIp } from "@/lib/server/auth/ip";
import { removeWatchlistItem } from "@/lib/server/phase2/repositories";
import { normalizeMintAddress } from "@/lib/server/phase2/validation";
const noStore = { "Cache-Control":"no-store" };
type Ctx = { params: Promise<{ mint:string }> };
export async function DELETE(request:NextRequest, ctx:Ctx) { const session = await validateSession(request); if (!session) return NextResponse.json({ error:"Unauthenticated" }, { status:401, headers:noStore }); const limited = await checkRateLimit("watchlist_mutation", [requestIp(request), session.userId]); if (!limited.allowed) return NextResponse.json({ error:"Too many requests" }, { status:429, headers:{ ...noStore, "Retry-After": String(limited.retryAfter) } }); const { mint: raw } = await ctx.params; const mint = normalizeMintAddress(raw); if (!mint) return NextResponse.json({ error:"Invalid mint address" }, { status:400, headers:noStore }); try { await removeWatchlistItem(session.userId, mint); return NextResponse.json({ success:true }, { headers:noStore }); } catch { return NextResponse.json({ error:"Unable to remove watchlist item" }, { status:500, headers:noStore }); } }
