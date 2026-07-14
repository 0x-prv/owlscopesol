import "server-only";
import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/server/env";
import { runDetectionCycle } from "@/lib/server/behavior-detector";

export async function POST(request: Request) {
  const CRON_SECRET = getCronSecret();
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDetectionCycle();
  return NextResponse.json({ success: true, ...result });
}

// Allow GET too, since some free external cron services only support GET.
export async function GET(request: Request) {
  return POST(request);
}