import { NextResponse } from "next/server";
import { cookieName, signAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";

function s(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  const body: any = ct.includes("application/json")
    ? await req.json().catch(() => ({} as any))
    : Object.fromEntries(await req.formData());

  const password = s(body.password);
  const next = s(body.next) || "/admin";

  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected || password !== expected) {
    const u = new URL("/admin/login", req.url);
    u.searchParams.set("err", "1");
    if (next) u.searchParams.set("next", next);
    return NextResponse.redirect(u, { status: 303 });
  }

  const token = await signAdminToken();
  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(cookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
