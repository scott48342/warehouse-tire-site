import { NextResponse } from "next/server";
import { searchAccessories } from "@/lib/wheelprosAccessory";
import { threadKeyFromRaw, titleNeedleForThread, type LugThreadKey } from "@/lib/accessories/gorillaLugKits";
import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";

export const runtime = "nodejs";

const EXCLUDE = ["BULK", "FRGD", "FORGED"]; // also excludes premium/forged kits by default
const REQUIRE = ["KIT", "-20", "ACORN", "BULGE", "5-LUG"]; // tighten later if needed

function hasAll(title: string, words: string[]) {
  const t = title.toUpperCase();
  return words.every((w) => t.includes(w));
}

function hasAny(title: string, needles: string[]) {
  const t = title.toUpperCase();
  return needles.some((n) => t.includes(n.toUpperCase()));
}

export type LugKitChoice = {
  threadKey: LugThreadKey;
  sku: string;
  title: string;
  brandCode?: string;
  nip: number;
  msrp?: number;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const threadSizeRaw = url.searchParams.get("threadSize");
  const seatTypeRaw = url.searchParams.get("seatType");
  const seatType = seatTypeRaw ? String(seatTypeRaw).toUpperCase() : "";
  const threadKey = threadKeyFromRaw(threadSizeRaw);

  if (!threadKey) {
    return NextResponse.json({ ok: false, error: "unsupported_thread", threadSizeRaw }, { status: 400 });
  }

  // Get supplier credentials from admin settings (with fallback to env/hardcoded)
  const wpCreds = await getSupplierCredentials("wheelpros");
  // company = sales org (1500=USD), customer = account number for pricing
  const company = "1500"; // USD sales org - always use this for US pricing
  const customer = wpCreds.customerNumber || "1022165";

  // Pull a page of lug nut accessories (we filter client-side).
  const res = await searchAccessories({
    filter: "lug nut",
    fields: "inventory,price",
    priceType: "msrp,map,nip",
    company,
    customer,
    page: 1,
    pageSize: 200,
  });

  const results = (res.results || []).filter((r) => {
    const title = String(r.title || "");
    if (!title) return false;
    const brandCode = String(r.brand?.code || "");
    if (brandCode !== "GO") return false; // Gorilla only

    const t = title.toUpperCase();
    if (EXCLUDE.some((x) => t.includes(x))) return false;

    // Require thread match
    const needles = titleNeedleForThread(threadKey);
    if (!hasAny(t, needles)) return false;

    // Seat type (optional): tighten selection when known.
    if (seatType) {
      if (seatType.includes("BALL")) {
        if (!(t.includes("BALL") || t.includes("RADIUS") || t.includes("SPHERICAL"))) return false;
      } else if (seatType.includes("MAG") || seatType.includes("SHANK") || seatType.includes("FLAT")) {
        if (!(t.includes("MAG") || t.includes("SHANK") || t.includes("FLAT") || t.includes("WASHER"))) return false;
      } else {
        // default conical/acorn: most Gorilla "standard" kits are ACORN/BULGE.
        if (!(t.includes("ACORN") || t.includes("BULGE") || t.includes("CONICAL") || t.includes("TAPER"))) return false;
      }
    }

    // Require some standard-kit markers
    if (!hasAll(t, REQUIRE)) return false;

    return true;
  });

  // Rank: prefer lowest NIP (cost) among valid standard kits
  const parsed = results
    .map((r) => {
      const nip = Number(r.prices?.nip?.[0]?.currencyAmount || 0);
      const msrp = Number(r.prices?.msrp?.[0]?.currencyAmount || 0);
      return {
        threadKey,
        sku: String(r.sku || ""),
        title: String(r.title || ""),
        brandCode: r.brand?.code,
        nip,
        msrp: msrp || undefined,
      } satisfies LugKitChoice;
    })
    .filter((x) => x.sku && x.nip > 0);

  const best = parsed.sort((a, b) => a.nip - b.nip)[0];

  if (!best) {
    return NextResponse.json(
      { ok: false, error: "no_standard_kit_found", threadKey, sampleCount: (res.results || []).length },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, choice: best }, { status: 200, headers: { "cache-control": "no-store" } });
}
