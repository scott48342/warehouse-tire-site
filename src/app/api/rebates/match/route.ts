import { NextResponse } from "next/server";
import { 
  getPool, 
  listActiveRebates, 
  getBestMatchingRebate,
  type TireForRebateMatch,
  type SiteRebate,
} from "@/lib/rebates";

export const runtime = "nodejs";

// Cache active rebates for 5 minutes to reduce DB load
let rebatesCache: { data: SiteRebate[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getCachedActiveRebates(): Promise<SiteRebate[]> {
  if (rebatesCache && rebatesCache.expiresAt > Date.now()) {
    return rebatesCache.data;
  }
  
  const db = getPool();
  const rebates = await listActiveRebates(db);
  rebatesCache = { data: rebates, expiresAt: Date.now() + CACHE_TTL_MS };
  return rebates;
}

/**
 * POST /api/rebates/match
 * 
 * Match tires to available rebates. Accepts batch requests.
 * 
 * Request body:
 * {
 *   tires: [{ sku: string, brand: string, model: string, size: string }, ...]
 * }
 * 
 * Response:
 * {
 *   matches: {
 *     [sku]: {
 *       rebateId: string,
 *       amount: string | null,
 *       headline: string,
 *       formUrl: string | null,
 *       matchType: "sku" | "model" | "brand-wide"
 *     }
 *   }
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tires: TireForRebateMatch[] = body?.tires || [];
    
    if (!Array.isArray(tires) || tires.length === 0) {
      return NextResponse.json({ matches: {} }, { status: 200 });
    }
    
    // Limit batch size
    if (tires.length > 100) {
      return NextResponse.json(
        { error: "Batch size limited to 100 tires" },
        { status: 400 }
      );
    }
    
    const activeRebates = await getCachedActiveRebates();
    const matches: Record<string, {
      rebateId: string;
      amount: string | null;
      headline: string;
      formUrl: string | null;
      matchType: "sku" | "model" | "brand-wide";
      endsText: string | null;
    }> = {};
    
    for (const tire of tires) {
      if (!tire.sku) continue;
      
      const match = getBestMatchingRebate(tire, activeRebates);
      if (match) {
        matches[tire.sku] = {
          rebateId: match.rebate.id,
          amount: match.rebate.rebate_amount,
          headline: match.rebate.headline,
          formUrl: match.rebate.form_url,
          matchType: match.matchType,
          endsText: match.rebate.ends_text,
        };
      }
    }
    
    return NextResponse.json(
      { matches },
      { status: 200, headers: { "cache-control": "public, max-age=300" } }
    );
  } catch (e: any) {
    console.error("[rebates/match] Error:", e);
    return NextResponse.json(
      { error: e?.message || String(e), matches: {} },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rebates/match?sku=XXX&brand=YYY&model=ZZZ&size=WWW
 * 
 * Match a single tire to available rebates.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sku = url.searchParams.get("sku") || "";
    const brand = url.searchParams.get("brand") || "";
    const model = url.searchParams.get("model") || "";
    const size = url.searchParams.get("size") || "";
    
    if (!sku && !brand) {
      return NextResponse.json({ match: null }, { status: 200 });
    }
    
    const tire: TireForRebateMatch = { sku, brand, model, size };
    const activeRebates = await getCachedActiveRebates();
    const match = getBestMatchingRebate(tire, activeRebates);
    
    if (!match) {
      return NextResponse.json(
        { match: null },
        { status: 200, headers: { "cache-control": "public, max-age=300" } }
      );
    }
    
    return NextResponse.json(
      {
        match: {
          rebateId: match.rebate.id,
          amount: match.rebate.rebate_amount,
          headline: match.rebate.headline,
          formUrl: match.rebate.form_url,
          learnMoreUrl: match.rebate.learn_more_url,
          requirements: match.rebate.requirements,
          matchType: match.matchType,
          endsText: match.rebate.ends_text,
          brand: match.rebate.brand,
        },
      },
      { status: 200, headers: { "cache-control": "public, max-age=300" } }
    );
  } catch (e: any) {
    console.error("[rebates/match] GET Error:", e);
    return NextResponse.json(
      { error: e?.message || String(e), match: null },
      { status: 500 }
    );
  }
}
