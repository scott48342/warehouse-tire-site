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

function toTireSizeCompact(size: string) {
  // Accept formats like:
  // - 245/50R18
  // - 245/40ZR20 95Y
  // - 2455018
  const s = String(size || "").trim();
  const m = s.match(/(\d{3})\s*\/?\s*(\d{2})\s*[A-Z]*\s*R\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const m2 = s.match(/^(\d{7})$/);
  if (m2) return m2[1];
  return "";
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

  const tireSizeRaw = url.searchParams.get("tireSize") || url.searchParams.get("size") || "";
  const tireSize = toTireSizeCompact(tireSizeRaw);
  const minQty = url.searchParams.get("minQty") || "";

  if (!tireSize) {
    return NextResponse.json(
      { error: "tireSize_required", hint: "Example: 245/50R18 or 2455018" },
      { status: 400 }
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<InventoryRequest>` +
    `<Credentials><APIKey>${apiKey}</APIKey></Credentials>` +
    `<Item>` +
    `<TireSize>${tireSize}</TireSize>` +
    (minQty ? `<MinQty>${minQty}</MinQty>` : ``) +
    `</Item>` +
    `</InventoryRequest>`;

  const upstream = "https://api.kmtire.com/v1/tiresizesearch";
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
  if (!res.ok) {
    return NextResponse.json(
      { error: "km_upstream_error", status: res.status, body: text.slice(0, 2000) },
      { status: 502 }
    );
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    // K&M wraps some strings in CDATA
    cdataPropName: "__cdata",
  });

  let data: unknown;
  try {
    data = parser.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      { error: "km_xml_parse_error", body: text.slice(0, 2000) },
      { status: 502 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const resp = d?.InventoryResponse || d?.inventoryresponse || d;
  const itemsRaw = resp?.Item;
  const items = (Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : []).map((it) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyIt = it as any;
    const qty = anyIt?.Quantity || {};
    const brand = anyIt?.BrandName?.__cdata || anyIt?.VendorName?.__cdata || anyIt?.VendorName || anyIt?.BrandName;
    const desc = anyIt?.Description?.__cdata || anyIt?.Description;

    return {
      partNumber: anyIt?.PartNumber,
      mfgPartNumber: anyIt?.MfgPartNumber,
      brand: brand != null ? String(brand).trim() : undefined,
      description: desc != null ? String(desc).trim() : undefined,
      size: anyIt?.Size,
      cost: anyIt?.Cost != null ? Number(anyIt.Cost) : undefined,
      fet: anyIt?.FET != null ? Number(anyIt.FET) : undefined,
      quantity: {
        primary: qty?.Primary != null ? Number(qty.Primary) : undefined,
        alternate: qty?.Alternate != null ? Number(qty.Alternate) : undefined,
        national: qty?.National != null ? Number(qty.National) : undefined,
      },
      code: anyIt?.Code != null ? String(anyIt.Code) : undefined,
    };
  });

  return NextResponse.json({
    tireSize,
    resultCode: resp?.ResultCode != null ? String(resp.ResultCode) : undefined,
    resultMessage: resp?.ResultMessage != null ? String(resp.ResultMessage) : undefined,
    items,
  });
}
