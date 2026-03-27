import { NextResponse } from "next/server";
import { refreshToken, getCredentialsConfigured } from "@/lib/wheelprosProxyAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!getCredentialsConfigured()) {
    return NextResponse.json(
      { error: "WheelPros credentials not configured" },
      { status: 500 }
    );
  }

  try {
    const result = await refreshToken();
    return NextResponse.json({
      ok: true,
      expiresIn: result.expiresIn,
      tokenType: "Bearer",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Auth failed" },
      { status: 403 }
    );
  }
}
