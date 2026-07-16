import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, revokeSession } from "@/lib/server/auth/session";
export async function POST(request: NextRequest) { await revokeSession(request); const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } }); clearSessionCookie(response); return response; }
