import { NextResponse } from "next/server";
import { getCredentialsConfigured } from "@/lib/wheelprosAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: getCredentialsConfigured(),
    timestamp: new Date().toISOString(),
  });
}
