import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { getCachedSearch, setCachedSearch } from "@/lib/tires/searchCache";

const ENDPOINT = "https://east.tireworkshd.com:55551/TDWebServices/Service.asmx";
const INVENTORY_CACHE_MS = 5 * 60_000;
const INVENTORY_FALLBACK_MS = 24 * 60 * 60_000;
const PRICED_FALLBACK_MS = 10 * 60_000;
const PRICED_FRESH_MS = 2 * 60_000;
const MAX_SKUS_PER_SEARCH = 40;
const EMPTY_SOURCES = { wheelpros: 0, tireweb: 0, km: 0 };

let inventoryCache: { key: string; expiresAt: number; skuIds: Array<{ id: string; size: string }> } | null = null;
let inventoryLoad: Promise<Array<{ id: string; size: string }>> | null = null;
const pricedCache = new Map<string, { expiresAt: number; items: CapitalTireItem[] }>();

function cacheKey(kind: string, size = ""): string {
  const account = [process.env.CAPITAL_TIRE_APPLICATION_UID, process.env.CAPITAL_TIRE_COMPANY_ID, process.env.CAPITAL_TIRE_LOCATION_ID].join(":");
  const accountHash = createHash("sha256").update(account).digest("hex").slice(0, 16);
  return `capital:${kind}:${accountHash}${size ? `:${normalizedSize(size)}` : ""}`;
}

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

function normalizedSize(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(/^P(?=\d{3}\/)/, "").replace(/ZR(?=\d{2})/, "R");
}

function soapRows(response: string, method: string, table: string): Record<string, unknown>[] {
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true }).parse(response);
  const body = parsed?.Envelope?.Body;
  if (body?.Fault) throw new Error(`Capital Tire ${method} request failed`);
  const result = body?.[`${method}Response`]?.[`${method}Result`];
  const raw = method === "InventorySearch" ? result?.InventorySearch?.[table] : result?.NewDataSet?.[table];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function soapRequest(method: string, fields: Record<string, string>, maxResponseLength: number, timeoutMs = 12_000): Promise<string> {
  const inner = Object.entries(fields).map(([key, value]) => `<${key}>${xml(value)}</${key}>`).join("");
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method} xmlns="http://tempuri.org/">${inner}</${method}></soap:Body></soap:Envelope>`;
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"http://tempuri.org/${method}"` },
      body: envelope,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`Capital Tire ${method} request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`Capital Tire ${method} HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > maxResponseLength) throw new Error(`Capital Tire ${method} response too large`);
  return text;
}

async function getInventorySkuIds(): Promise<Array<{ id: string; size: string }>> {
  const key = [process.env.CAPITAL_TIRE_APPLICATION_UID, process.env.CAPITAL_TIRE_COMPANY_ID, process.env.CAPITAL_TIRE_LOCATION_ID].join(":");
  if (inventoryCache?.key === key && inventoryCache.expiresAt > Date.now()) return inventoryCache.skuIds;
  if (inventoryLoad) return inventoryLoad;
  inventoryLoad = (async () => {
    const sharedKey = cacheKey("sku-list");
    const cached = await getCachedSearch<Array<{ id: string; size: string }>>(sharedKey);
    if (cached && !cached.isStale) {
      inventoryCache = { key, expiresAt: Date.now() + INVENTORY_CACHE_MS, skuIds: cached.data };
      return cached.data;
    }
    try {
      const response = await soapRequest("GetInventory", {
        ApplicationUid: process.env.CAPITAL_TIRE_APPLICATION_UID!,
        CompanyID: process.env.CAPITAL_TIRE_COMPANY_ID!,
        LocationID: process.env.CAPITAL_TIRE_LOCATION_ID!,
        SkuTypeId: "", NonZeroQtyOnly: "true",
      }, 8_000_000, 20_000);
      const skuIds = soapRows(response, "GetInventory", "IC_INVENTORY").flatMap(row => {
        const id = String(row.IC_SKU_ID || "").trim();
        const size = String(row.Description || "").split("~")[0].trim();
        const quantity = Number(row.QtyAvailable || 0);
        return id && size && quantity > 0 ? [{ id, size }] : [];
      });
      inventoryCache = { key, expiresAt: Date.now() + INVENTORY_CACHE_MS, skuIds };
      if (skuIds.length) await setCachedSearch(sharedKey, skuIds, EMPTY_SOURCES, INVENTORY_FALLBACK_MS, INVENTORY_CACHE_MS);
      return skuIds;
    } catch (error) {
      const fallback = cached?.data || (inventoryCache?.key === key ? inventoryCache.skuIds : null);
      if (!fallback) throw error;
      console.warn("[capital] Using last successful SKU list after GetInventory failure");
      inventoryCache = { key, expiresAt: Date.now() + INVENTORY_CACHE_MS, skuIds: fallback };
      return fallback;
    }
  })();
  try {
    return await inventoryLoad;
  } finally {
    inventoryLoad = null;
  }
}

export function parseCapitalInventory(response: string, requestedSize: string): CapitalTireItem[] {
  const rows = soapRows(response, "InventorySearch", "PriceData");
  const requested = normalizedSize(requestedSize);

  return rows.flatMap((row: Record<string, unknown>) => {
    const size = String(row.TIRE_SIZE || "").trim().toUpperCase();
    if (normalizedSize(size) !== requested) return [];
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
      size: requestedSize.toUpperCase(),
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

/** Read-only GetInventory finds the full stocked catalog; InventorySearch prices matching SKUs. */
export async function searchCapitalTires(size: string): Promise<CapitalTireItem[]> {
  if (!isCapitalConfigured()) return [];
  const match = normalizedSize(size).match(/^(?:LT|ST)?\d{3}\/\d{2,3}R\d{2}(?:\.5)?$/);
  if (!match) return [];
  const resultKey = cacheKey("priced", size);
  const previous = pricedCache.get(resultKey);
  const sharedPrevious = await getCachedSearch<CapitalTireItem[]>(resultKey);
  if (sharedPrevious && !sharedPrevious.isStale) return sharedPrevious.data;
  try {
    const matchingSkus = (await getInventorySkuIds()).filter(item => normalizedSize(item.size) === normalizedSize(size));
    if (!matchingSkus.length) return [];
    const baseFields: Record<string, string> = {
      ApplicationUID: process.env.CAPITAL_TIRE_APPLICATION_UID!,
      CompanyID: process.env.CAPITAL_TIRE_COMPANY_ID!,
      LocationID: process.env.CAPITAL_TIRE_LOCATION_ID!,
      CustomerID: process.env.CAPITAL_TIRE_CUSTOMER_ID!,
      CustomerAddressID: process.env.CAPITAL_TIRE_ADDRESS_ID!,
      VehicleTypeID: "", CatLookup: "", UserSKU: "", Description: "", SkuID: "",
      Width: "", Aspect: "", Rim: "", Speed: "", MfgList: "",
      SkuCommaDelim: "", UserSkuCommaDelim: "", MfgSkuCommaDelim: "",
      ShowASLQtys: "false", SortId: "",
    };
    const chunks: Array<Array<{ id: string; size: string }>> = [];
    for (let i = 0; i < matchingSkus.length; i += MAX_SKUS_PER_SEARCH) chunks.push(matchingSkus.slice(i, i + MAX_SKUS_PER_SEARCH));
    const responses = await Promise.all(chunks.map(chunk => soapRequest("InventorySearch", {
      ...baseFields, SkuCommaDelim: chunk.map(item => item.id).join(","),
    }, 2_000_000, 15_000)));
    const items = responses.flatMap(response => parseCapitalInventory(response, size));
    pricedCache.set(resultKey, { expiresAt: Date.now() + PRICED_FALLBACK_MS, items });
    await setCachedSearch(resultKey, items, EMPTY_SOURCES, PRICED_FALLBACK_MS, PRICED_FRESH_MS);
    return items;
  } catch (error) {
    const fallback = previous?.expiresAt && previous.expiresAt > Date.now() ? previous.items : sharedPrevious?.data;
    if (!fallback) throw error;
    console.warn(`[capital] Using recent ${size} prices after supplier timeout`);
    return fallback;
  }
}
