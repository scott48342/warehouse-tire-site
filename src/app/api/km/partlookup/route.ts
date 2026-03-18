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
  const minQty = String(url.searchParams.get("minQty") || "").trim();
  const debug = (url.searchParams.get("debug") || "").trim() === "1";

  if (!partNumber) {
    return NextResponse.json(
      { error: "partNumber_required", hint: "Example: /api/km/partlookup?partNumber=HTS-A78ED" },
      { status: 400 }
    );
  }

  // KM told Scott TPMS can be looked up by part number.
  // The portal docs vary; to keep us unblocked, we try a small set of plausible endpoints.
  const candidates = [
    "https://api.kmtire.com/v1/partnumbersearch",
    "https://api.kmtire.com/v1/partsearch",
    "https://api.kmtire.com/v1/itemsearch",
    "https://api.kmtire.com/v1/accessorysearch",
    "https://api.kmtire.com/v1/tpmssearch",
  ];

  const parser = new XMLParser({
    ignoreAttributes: false,
    cdataPropName: "__cdata",
  });

  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n` +
    `<InventoryRequest>` +
    `<Credentials><APIKey>${apiKey}</APIKey></Credentials>` +
    `<Item>` +
    `<PartNumber>${partNumber}</PartNumber>` +
    (minQty ? `<MinQty>${minQty}</MinQty>` : ``) +
    `</Item>` +
    `</InventoryRequest>`;

  const attempts: any[] = [];

  for (const upstream of candidates) {
    try {
      const res = await fetch(upstream, {
        method: "POST",
        headers: {
          "content-type": "application/xml",
          accept: "application/xml, text/xml, */*",
        },
        body: xml,
        cache: "no-store",
      });

      const text = await res.text();

      attempts.push({
        upstream,
        status: res.status,
        ok: res.ok,
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
      const normalized = items.map((it: any) => {
        const qty = it?.Quantity || it?.quantity || {};
        return {
          partNumber: it?.PartNumber ?? it?.partNumber,
          description: it?.Description ?? it?.description,
          brand: it?.BrandName ?? it?.brand,
          cost: it?.Cost != null ? Number(it.Cost) : undefined,
          quantity: {
            primary: qty?.Primary != null ? Number(qty.Primary) : undefined,
            alternate: qty?.Alternate != null ? Number(qty.Alternate) : undefined,
            national: qty?.National != null ? Number(qty.National) : undefined,
          },
          _raw: debug ? it : undefined,
        };
      });

      return NextResponse.json({
        partNumber,
        upstream,
        count: normalized.length,
        items: normalized,
        ...(debug ? { attempts } : null),
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
