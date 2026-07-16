import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/server/auth/session";
export async function GET(request: NextRequest) { const response = NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } }); const session = await validateSession(request, response); if (!session) return response; return NextResponse.json({ user: { id: session.userId, walletAddress: session.walletAddress }, session: { expiresAt: session.expiresAt } }, { headers: { "Cache-Control": "no-store" } }); }
