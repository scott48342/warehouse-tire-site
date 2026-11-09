import { XMLParser } from "fast-xml-parser";

const ENDPOINT = "https://east.tireworkshd.com:55551/TDWebServices/Service.asmx";

export interface CapitalTireItem {
  itemNumber: string;
  manufacturerSku: string;
  brand: string;
  model: string;
  description: string;
  size: string;
  quantity: number;
  /** Dealer purchase cost, including separately reported FET when present. */
  cost: number;
  fet: number;
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] || character);
}

function positiveMoney(value: unknown): number | null {
  const amount = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function nonnegativeMoney(value: unknown): number {
  const amount = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function parseCapitalInventory(response: string, requestedSize: string): CapitalTireItem[] {
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true }).parse(response);
  const body = parsed?.Envelope?.Body;
  if (body?.Fault) throw new Error("Capital Tire inventory request failed");
  const inventory = body?.InventorySearchResponse?.InventorySearchResult?.InventorySearch;
  const raw = inventory?.PriceData;
  if (!raw) return [];
  const rows = Array.isArray(raw) ? raw : [raw];
  const requested = requestedSize.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return rows.flatMap((row: Record<string, unknown>) => {
    const size = String(row.TIRE_SIZE || "").trim().toUpperCase();
    if (size.replace(/[^A-Z0-9]/g, "") !== requested) return [];
    const price = positiveMoney(row.Price);
    const quantity = Math.max(0, Math.trunc(Number(row.QtyAvail) || 0));
    const manufacturerSku = String(row.MANUFACTURER_SKU_CODE || "").trim();
    const itemNumber = String(row.ItemNumber || "").trim();
    if (!price || !quantity || !manufacturerSku || !itemNumber) return [];
    const fet = nonnegativeMoney(row.FET);
    const description = String(row.Description || "").trim();
    const parts = description.split("~");
    return [{
      itemNumber,
      manufacturerSku,
      brand: String(row.Manufacturer || "").trim(),
      model: (parts[2] || description).trim(),
      description: description.replace(/~/g, " "),
      size,
      quantity,
      cost: Math.round((price + fet) * 100) / 100,
      fet,
    }];
  });
}

export function isCapitalConfigured(): boolean {
  return Boolean(
    process.env.CAPITAL_TIRE_APPLICATION_UID &&
    process.env.CAPITAL_TIRE_COMPANY_ID &&
    process.env.CAPITAL_TIRE_LOCATION_ID &&
    process.env.CAPITAL_TIRE_CUSTOMER_ID &&
    process.env.CAPITAL_TIRE_ADDRESS_ID,
  );
}

/** Read-only InventorySearch. No order methods are used. */
export async function searchCapitalTires(size: string): Promise<CapitalTireItem[]> {
  if (!isCapitalConfigured()) return [];
  const match = size.trim().toUpperCase().match(/^(?:P|LT)?(\d{3})\/(\d{2,3})R(\d{2}(?:\.5)?)$/);
  if (!match) return [];

  const fields: Record<string, string> = {
    ApplicationUID: process.env.CAPITAL_TIRE_APPLICATION_UID!,
    CompanyID: process.env.CAPITAL_TIRE_COMPANY_ID!,
    LocationID: process.env.CAPITAL_TIRE_LOCATION_ID!,
    CustomerID: process.env.CAPITAL_TIRE_CUSTOMER_ID!,
    CustomerAddressID: process.env.CAPITAL_TIRE_ADDRESS_ID!,
    VehicleTypeID: "", CatLookup: "", UserSKU: "", Description: "", SkuID: "",
    Width: match[1], Aspect: match[2], Rim: match[3], Speed: "", MfgList: "",
    SkuCommaDelim: "", UserSkuCommaDelim: "", MfgSkuCommaDelim: "",
    ShowASLQtys: "false", SortId: "",
  };
  const inner = Object.entries(fields).map(([key, value]) => `<${key}>${xml(value)}</${key}>`).join("");
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><InventorySearch xmlns="http://tempuri.org/">${inner}</InventorySearch></soap:Body></soap:Envelope>`;

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '"http://tempuri.org/InventorySearch"' },
    body: envelope,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Capital Tire inventory HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("Capital Tire inventory response too large");
  return parseCapitalInventory(text, size);
}
