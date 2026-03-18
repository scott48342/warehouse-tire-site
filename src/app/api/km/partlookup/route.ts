import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";

function getKmApiKey() {
  return (
    process.env.KM_API_KEY ||
    process.env.KMTIRE_API_KEY ||
    process.env.KM_TIRE_API_KEY ||
    ""
  ).trim();
}

function pickNode<T = any>(root: any, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = root?.[k];
    if (v != null) return v as T;
  }
  return undefined;
}

function coerceArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function getMarkupAmount() {
  const raw = (process.env.ACCESSORIES_TPMS_MARKUP_AMOUNT || process.env.TPMS_MARKUP_AMOUNT || "45").trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 45;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const apiKey = getKmApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing KM_API_KEY (or KMTIRE_API_KEY)" },
      { status: 500 }
    );
  }

  const partNumberRaw = url.searchParams.get("partNumber") || url.searchParams.get("pn") || "";
  const partNumber = String(partNumberRaw || "").trim();
  const vendorName = String(url.searchParams.get("vendor") || url.searchParams.get("vendorName") || "").trim();
  const vendorFallback = String(url.searchParams.get("vendorFallback") || "Hamaton").trim();
  const minQty = String(url.searchParams.get("minQty") || "").trim();
  const debug = (url.searchParams.get("debug") || "").trim() === "1";

  if (!partNumber) {
    return NextResponse.json(
      { error: "partNumber_required", hint: "Example: /api/km/partlookup?partNumber=HTS-A78ED" },
      { status: 400 }
    );
  }

  // KM confirmed TPMS lookup works via the inventory endpoint using PartNumber.
  // Example (from Scott's Postman): POST https://api.kmtire.com/v1/inventory
  const candidates = [
    "https://api.kmtire.com/v1/inventory",
  ];

  const parser = new XMLParser({
    ignoreAttributes: false,
    cdataPropName: "__cdata",
  });

  function buildXml(vendor: string) {
    return (
      `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n` +
      `<InventoryRequest>` +
      `<Credentials><APIKey>${apiKey}</APIKey></Credentials>` +
      `<Item>` +
      `<PartNumber>${partNumber}</PartNumber>` +
      (vendor ? `<VendorName>${vendor}</VendorName>` : ``) +
      (minQty ? `<MinQty>${minQty}</MinQty>` : ``) +
      `</Item>` +
      `</InventoryRequest>`
    );
  }

  const attempts: any[] = [];

  async function postXml(upstream: string, vendor: string) {
    const res = await fetch(upstream, {
      method: "POST",
      headers: {
        "content-type": "application/xml",
        accept: "application/xml, text/xml, */*",
      },
      body: buildXml(vendor),
      cache: "no-store",
    });
    const text = await res.text();
    return { res, text };
  }

  function isVendorRequiredBug(text: string) {
    return String(text || "").includes("str_repeat(): Argument #2");
  }

  for (const upstream of candidates) {
    try {
      // First attempt: use provided vendorName (may be blank)
      let usedVendor = vendorName;
      let { res, text } = await postXml(upstream, usedVendor);

      // KM bug/workaround: inventory endpoint may 500 when VendorName is omitted.
      // If that happens, retry with a fallback vendor.
      if (!usedVendor && res.status === 500 && isVendorRequiredBug(text)) {
        usedVendor = vendorFallback;
        const retry = await postXml(upstream, usedVendor);
        res = retry.res;
        text = retry.text;
      }

      attempts.push({
        upstream,
        status: res.status,
        ok: res.ok,
        vendor: usedVendor || undefined,
        sample: text.slice(0, 240),
      });

      if (!res.ok) continue;

      let data: unknown;
      try {
        data = parser.parse(text) as unknown;
      } catch {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = data as any;
      const resp = pickNode(d, ["InventoryResponse", "inventoryresponse"]) ?? d;
      const itemsRaw = pickNode(resp, ["Item", "Items", "item", "items"]);
      const items = coerceArray(itemsRaw);

      // Best-effort normalization. We don't know TPMS schema yet.
      function unwrap(v: any) {
        if (v == null) return undefined;
        if (typeof v === "object" && v.__cdata != null) return v.__cdata;
        return v;
      }

      const markup = getMarkupAmount();

      const normalized = items.map((it: any) => {
        const qty = it?.Quantity || it?.quantity || {};
        const qPrimary = qty?.Primary != null ? Number(qty.Primary) : 0;
        const qAlternate = qty?.Alternate != null ? Number(qty.Alternate) : 0;
        const qNational = qty?.National != null ? Number(qty.National) : 0;
        const inStock = [qPrimary, qAlternate, qNational].some((n) => Number.isFinite(n) && n > 0);

        const vendor = String(unwrap(it?.VendorName ?? it?.vendorName) || "");
        const isHamaton = /hamaton/i.test(vendor);

        const cost = it?.Cost != null ? Number(it.Cost) : undefined;
        const price = typeof cost === "number" && Number.isFinite(cost) ? Number((cost + markup).toFixed(2)) : undefined;

        const base = {
          partNumber: unwrap(it?.PartNumber ?? it?.partNumber),
          mfgPartNumber: unwrap(it?.MfgPartNumber ?? it?.mfgPartNumber),
          size: unwrap(it?.Size ?? it?.size),
          description: unwrap(it?.Description ?? it?.description),
          inStock,
          price,
          isHamaton,
        };

        if (!debug) return base;

        return {
          ...base,
          // debug-only supplier fields
          vendorName: vendor || undefined,
          cost,
          fet: it?.FET != null ? Number(it.FET) : undefined,
          quantity: {
            primary: qPrimary,
            alternate: qAlternate,
            national: qNational,
          },
          code: unwrap(it?.Code ?? it?.code),
          _raw: it,
        };
      });

      return NextResponse.json({
        partNumber,
        count: normalized.length,
        items: normalized,
        ...(debug ? { upstream, vendor: usedVendor || undefined, attempts } : null),
      });
    } catch (e: any) {
      attempts.push({ upstream, error: String(e?.message || e) });
      continue;
    }
  }

  return NextResponse.json(
    {
      error: "km_partlookup_failed",
      partNumber,
      attempts,
      hint: "KM portal may use a different endpoint name/schema for TPMS lookup. Enable ?debug=1 to inspect responses.",
    },
    { status: 502 }
  );
}
