/**
 * Admin API: OEM Package Choices
 * 
 * Manage customer-friendly package labels for multi-config trims.
 * 
 * GET - List package choices with optional filters
 * POST - Create or update a package choice
 * PATCH - Approve/reject a package choice
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllPackageChoices,
  updatePackageChoiceStatus,
  createPackageChoice,
  type OemPackageChoice,
} from "@/lib/fitment/oemPackageChoices";

// =============================================================================
// GET - List Package Choices
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get("status") as "pending" | "approved" | "rejected" | null;
    const year = searchParams.get("year");
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const limit = searchParams.get("limit");

    const choices = await getAllPackageChoices({
      status: status || undefined,
      year: year ? parseInt(year) : undefined,
      make: make || undefined,
      model: model || undefined,
      limit: limit ? parseInt(limit) : 100,
    });

    // Group by YMM/trim for easier display
    const grouped: Record<string, OemPackageChoice[]> = {};
    for (const choice of choices) {
      const key = `${choice.year}-${choice.make}-${choice.model}-${choice.trim}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(choice);
    }

    return NextResponse.json({
      success: true,
      total: choices.length,
      choices,
      grouped,
      summary: {
        pending: choices.filter(c => c.status === "pending").length,
        approved: choices.filter(c => c.status === "approved").length,
        rejected: choices.filter(c => c.status === "rejected").length,
      },
    });
  } catch (error) {
    console.error("[admin/oem-package-choices] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch package choices" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Package Choice
// =============================================================================

interface CreateRequest {
  year: number;
  make: string;
  model: string;
  trim: string;
  packageLabel: string;
  packageDescription?: string;
  wheelDiameter: number;
  rimWidth?: number;
  tireSize: string;
  tireSizeRear?: string;
  loadRating?: string;
  source?: string;
  confidence?: "low" | "medium" | "high";
  displayOrder?: number;
  notes?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as CreateRequest;

    // Validate required fields
    if (!body.year || !body.make || !body.model || !body.trim) {
      return NextResponse.json(
        { success: false, error: "year, make, model, and trim are required" },
        { status: 400 }
      );
    }
    if (!body.packageLabel || !body.wheelDiameter || !body.tireSize) {
      return NextResponse.json(
        { success: false, error: "packageLabel, wheelDiameter, and tireSize are required" },
        { status: 400 }
      );
    }

    const choice = await createPackageChoice(body);

    if (!choice) {
      return NextResponse.json(
        { success: false, error: "Failed to create package choice" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      choice,
      message: "Package choice created (pending approval)",
    });
  } catch (error) {
    console.error("[admin/oem-package-choices] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create package choice" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Status (Approve/Reject)
// =============================================================================

interface PatchRequest {
  id: string;
  action: "approve" | "reject";
  reviewedBy?: string;
  notes?: string;
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as PatchRequest;

    if (!body.id || !body.action) {
      return NextResponse.json(
        { success: false, error: "id and action are required" },
        { status: 400 }
      );
    }

    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json(
        { success: false, error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const status = body.action === "approve" ? "approved" : "rejected";
    const reviewedBy = body.reviewedBy || "admin";

    const success = await updatePackageChoiceStatus(
      body.id,
      status,
      reviewedBy,
      body.notes
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to update package choice" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Package choice ${status}`,
    });
  } catch (error) {
    console.error("[admin/oem-package-choices] PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update package choice" },
      { status: 500 }
    );
  }
}
