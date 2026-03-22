import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Simple password auth for admin portal
 * Set ADMIN_PASSWORD in environment variables
 */
export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error("[admin/auth] ADMIN_PASSWORD not configured");
      return NextResponse.json(
        { error: "Admin not configured" },
        { status: 500 }
      );
    }
    
    if (password === adminPassword) {
      return NextResponse.json({ ok: true });
    }
    
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 }
    );
  } catch (err) {
    console.error("[admin/auth] Error:", err);
    return NextResponse.json(
      { error: "Auth failed" },
      { status: 500 }
    );
  }
}
