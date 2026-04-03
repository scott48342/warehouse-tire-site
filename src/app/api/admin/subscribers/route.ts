/**
 * Admin Subscribers API
 * 
 * GET /api/admin/subscribers
 * List subscribers with filters and stats
 * 
 * @created 2026-04-03
 */

import { NextResponse } from "next/server";
import {
  getStats,
  getMarketingList,
  getByEmail,
  type EmailSource,
} from "@/lib/email/subscriberService";

export const runtime = "nodejs";

const VALID_SOURCES: EmailSource[] = ["exit_intent", "cart_save", "checkout", "newsletter", "quote"];

/**
 * GET /api/admin/subscribers
 * 
 * Query params:
 * - stats: "1" to get stats only
 * - email: lookup specific email
 * - source: filter by source
 * - hasVehicle: "1" to filter to subscribers with vehicle info
 * - limit: number (default 100)
 * - offset: number (default 0)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeStats = url.searchParams.get("stats") === "1";
    const emailLookup = url.searchParams.get("email");
    const sourceFilter = url.searchParams.get("source") as EmailSource | null;
    const hasVehicle = url.searchParams.get("hasVehicle") === "1";
    const limit = Math.min(500, Number(url.searchParams.get("limit") || "100") || 100);
    const offset = Number(url.searchParams.get("offset") || "0") || 0;

    // Stats only
    if (includeStats && !emailLookup) {
      const stats = await getStats();
      return NextResponse.json({ stats });
    }

    // Single email lookup
    if (emailLookup) {
      const records = await getByEmail(emailLookup);
      return NextResponse.json({
        email: emailLookup,
        records: records.map(r => ({
          id: r.id,
          source: r.source,
          vehicle: r.vehicleYear ? {
            year: r.vehicleYear,
            make: r.vehicleMake,
            model: r.vehicleModel,
            trim: r.vehicleTrim,
          } : null,
          cartId: r.cartId,
          marketingConsent: r.marketingConsent,
          unsubscribed: r.unsubscribed,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      });
    }

    // Validate source filter
    if (sourceFilter && !VALID_SOURCES.includes(sourceFilter)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}` },
        { status: 400 }
      );
    }

    // List subscribers
    const { subscribers, total } = await getMarketingList({
      source: sourceFilter || undefined,
      hasVehicle,
      limit,
      offset,
    });

    // Format for admin display
    const formatted = subscribers.map(s => ({
      id: s.id,
      email: s.email,
      source: s.source,
      vehicle: s.vehicleYear ? {
        year: s.vehicleYear,
        make: s.vehicleMake,
        model: s.vehicleModel,
        trim: s.vehicleTrim,
      } : null,
      cartId: s.cartId,
      createdAt: s.createdAt,
    }));

    const response: any = {
      subscribers: formatted,
      total,
      limit,
      offset,
    };

    // Include stats if requested along with list
    if (includeStats) {
      response.stats = await getStats();
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[admin/subscribers] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}
