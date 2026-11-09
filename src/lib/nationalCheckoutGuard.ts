import { NextResponse } from "next/server";
import { NATIONAL_CHECKOUT_PAUSED, isNationalCatalogHost } from "@/lib/nationalCatalog";

/** Route-level backstop for the three new-payment endpoints. */
export function nationalCheckoutBlockedResponse(req: Request): NextResponse | null {
  const host = req.headers.get("host") || new URL(req.url).host;
  if (!NATIONAL_CHECKOUT_PAUSED || !isNationalCatalogHost(host)) return null;
  return NextResponse.json(
    { ok: false, error: "national_checkout_paused", detail: "Please contact Warehouse Tire Direct to place your order." },
    { status: 423, headers: { "cache-control": "no-store" } },
  );
}
