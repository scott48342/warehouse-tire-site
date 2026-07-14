import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { employmentApplications } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// GET single application
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [application] = await db
      .select()
      .from(employmentApplications)
      .where(eq(employmentApplications.id, id))
      .limit(1);

    if (!application) {
      return NextResponse.json(
        { ok: false, error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, application });
  } catch (e: unknown) {
    console.error("[admin/applications/[id]] Error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update application status/notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.status) {
      updates.status = body.status;
      updates.reviewedAt = new Date();
      // Could add reviewedBy if auth is implemented
    }

    if (body.reviewNotes !== undefined) {
      updates.reviewNotes = body.reviewNotes;
    }

    if (body.status === "archived") {
      updates.archivedAt = new Date();
    }

    const [updated] = await db
      .update(employmentApplications)
      .set(updates)
      .where(eq(employmentApplications.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, application: updated });
  } catch (e: unknown) {
    console.error("[admin/applications/[id]] PATCH Error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

// DELETE - Remove application (soft delete by archiving, or hard delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const hard = url.searchParams.get("hard") === "true";

    if (hard) {
      // Hard delete
      const [deleted] = await db
        .delete(employmentApplications)
        .where(eq(employmentApplications.id, id))
        .returning();

      if (!deleted) {
        return NextResponse.json(
          { ok: false, error: "Application not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true, deleted: true });
    } else {
      // Soft delete (archive)
      const [archived] = await db
        .update(employmentApplications)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(employmentApplications.id, id))
        .returning();

      if (!archived) {
        return NextResponse.json(
          { ok: false, error: "Application not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true, archived: true, application: archived });
    }
  } catch (e: unknown) {
    console.error("[admin/applications/[id]] DELETE Error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
