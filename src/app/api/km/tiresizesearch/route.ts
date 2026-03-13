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
  const debug = (url.searchParams.get("debug") || "").trim() === "1";

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

  function pick(it: any, keys: string[]) {
    for (const k of keys) {
      const v = it?.[k];
      if (v == null) continue;
      const cdata = typeof v === "object" && v?.__cdata != null ? v.__cdata : null;
      return cdata != null ? cdata : v;
    }
    return undefined;
  }

  function toBool(v: unknown): boolean | undefined {
    if (v == null) return undefined;
    const s = String(v).trim().toLowerCase();
    if (["y", "yes", "true", "1"].includes(s)) return true;
    if (["n", "no", "false", "0"].includes(s)) return false;
    return undefined;
  }

  const items = (Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : []).map((it) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyIt = it as any;
    const qty = anyIt?.Quantity || {};
    const brand = pick(anyIt, ["BrandName", "VendorName", "Brand", "Vendor"]);
    const desc = pick(anyIt, ["Description", "Desc"]);

    const season = pick(anyIt, ["Season", "TireType", "Category"]);
    const speedRating = pick(anyIt, ["SpeedRating", "Speed_Rating", "Speed"]);
    const loadRange = pick(anyIt, ["LoadRange", "Load_Range", "LoadRangeCode"]);
    const runFlat = toBool(pick(anyIt, ["RunFlat", "Runflat", "IsRunFlat", "RunFlatIndicator"]));
    const snowRated = toBool(pick(anyIt, ["SnowRated", "Snow_Rated", "ThreePeak", "3PMSF", "Is3PMSF"]));
    const allWeather = toBool(pick(anyIt, ["AllWeather", "All_Weather", "IsAllWeather"]));

    const utqgTreadwear = pick(anyIt, ["UTQGTreadwear", "UTQG_Treadwear", "Treadwear"]);
    const utqgTraction = pick(anyIt, ["UTQGTraction", "UTQG_Traction", "Traction"]);
    const utqgTemperature = pick(anyIt, ["UTQGTemperature", "UTQG_Temperature", "Temperature"]);

    const mileageWarranty = pick(anyIt, ["MileageWarranty", "Mileage_Warranty", "WarrantyMiles"]);
    const rebate = toBool(pick(anyIt, ["Rebate", "RebateAvailable", "HasRebate"]));
    const special = toBool(pick(anyIt, ["Special", "OnSpecial", "Promo"]));

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

      // Extended merchandising/fitment fields (best-effort; keys depend on K&M schema)
      season: season != null ? String(season).trim() : undefined,
      speedRating: speedRating != null ? String(speedRating).trim() : undefined,
      loadRange: loadRange != null ? String(loadRange).trim() : undefined,
      runFlat,
      snowRated,
      allWeather,
      utqg: {
        treadwear: utqgTreadwear != null ? String(utqgTreadwear).trim() : undefined,
        traction: utqgTraction != null ? String(utqgTraction).trim() : undefined,
        temperature: utqgTemperature != null ? String(utqgTemperature).trim() : undefined,
      },
      mileageWarranty: mileageWarranty != null ? String(mileageWarranty).trim() : undefined,
      rebateAvailable: rebate,
      special,

      ...(debug
        ? {
            _debugKeys: Object.keys(anyIt || {}).slice(0, 200),
          }
        : null),
    };
  });

  return NextResponse.json({
    tireSize,
    resultCode: resp?.ResultCode != null ? String(resp.ResultCode) : undefined,
    resultMessage: resp?.ResultMessage != null ? String(resp.ResultMessage) : undefined,
    items,
    ...(debug
      ? {
          debug: {
            itemCount: items.length,
            firstItemKeys: items[0] && (items[0] as any)._debugKeys ? (items[0] as any)._debugKeys : [],
          },
        }
      : null),
  });
}
