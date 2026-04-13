/**
 * POST /api/admin/classic-fitment/seed
 * 
 * ⛔ DISABLED - Initial seed completed 2026-04-13
 * 
 * This endpoint seeded 8 platform records:
 * - SN95 (Ford Mustang 1994-1998)
 * - GMT400 (Chevy C1500, GMC Sierra 1988-1998)
 * - F-BODY-4 (Camaro, Firebird 1993-2002)
 * - EG-CIVIC (Honda Civic 1992-1995)
 * - EK-CIVIC (Honda Civic 1996-2000)
 * - XJ (Jeep Cherokee 1984-2001)
 * 
 * Batch tag: 1990s-initial-seed-2026-04
 * 
 * To add more platforms:
 * 1. Create a new versioned seed script in scripts/classic-fitment/
 * 2. Run via server-side script or temporary endpoint
 * 3. Disable endpoint after use
 * 
 * DO NOT re-enable this endpoint without review.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Endpoint permanently disabled after initial seed
const SEED_COMPLETED = true;
const SEED_DATE = "2026-04-13";
const SEED_BATCH = "1990s-initial-seed-2026-04";
const SEED_COUNT = 8;

export async function POST() {
  return NextResponse.json(
    {
      error: "Endpoint disabled",
      message: "Classic fitment seed completed. Endpoint permanently disabled for security.",
      seedInfo: {
        completedAt: SEED_DATE,
        batchTag: SEED_BATCH,
        platformsSeeded: SEED_COUNT,
      },
      action: "To add more platforms, create a new versioned seed script.",
    },
    { status: 410 } // 410 Gone - resource no longer available
  );
}

export async function GET() {
  return NextResponse.json(
    {
      status: "disabled",
      message: "Classic fitment seed endpoint. POST disabled after initial seed.",
      seedInfo: {
        completedAt: SEED_DATE,
        batchTag: SEED_BATCH,
        platformsSeeded: SEED_COUNT,
      },
    },
    { status: 200 }
  );
}
