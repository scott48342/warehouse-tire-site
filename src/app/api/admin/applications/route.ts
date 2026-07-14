import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { employmentApplications } from "@/lib/fitment-db/schema";
import { desc, eq, ilike, or, and, sql, count } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "";
    const position = url.searchParams.get("position")?.trim() || "";
    const store = url.searchParams.get("store")?.trim() || "";

    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(employmentApplications.firstName, `%${search}%`),
          ilike(employmentApplications.lastName, `%${search}%`),
          ilike(employmentApplications.email, `%${search}%`)
        )
      );
    }

    if (status) {
      conditions.push(eq(employmentApplications.status, status));
    }

    if (position) {
      conditions.push(eq(employmentApplications.positionApplyingFor, position));
    }

    if (store) {
      conditions.push(eq(employmentApplications.preferredStore, store));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(employmentApplications)
      .where(whereClause);

    // Get applications
    const applications = await db
      .select()
      .from(employmentApplications)
      .where(whereClause)
      .orderBy(desc(employmentApplications.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      ok: true,
      applications,
      total: Number(total),
      page,
      limit,
      pages: Math.ceil(Number(total) / limit),
    });
  } catch (e: unknown) {
    console.error("[admin/applications] Error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
