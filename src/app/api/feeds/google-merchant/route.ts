/**
 * Google Merchant Center Product Feed — wheels (WheelPros + Wheel-1 + WSI) and tires (WheelPros).
 *
 * Formats: TSV (default, Google "text feed"), XML (RSS 2.0 g: namespace), JSON (debug).
 *
 * Brand policy:
 *  - PIRELLI is EXCLUDED entirely (no eCommerce allowed).
 *  - BRIDGESTONE / GOODYEAR / MICHELIN are included (own-site feed is not a
 *    3rd-party marketplace) but counted in stats for review.
 *  - MAP is respected: tire prices are floored at MAP; wheel pricing goes
 *    through the site pricing services (MAP-aware).
 *
 * Inventory rule: only items with >= MIN_INVENTORY_QTY units are included.
 * WheelPros wheel quantities come from the Redis inventory cache (production);
 * when Redis is unavailable (local preview) the wp_inventory Postgres snapshot
 * is used as a fallback and flagged in stats.
 *
 * @created 2026-10-27 (groundwork — not yet registered in Merchant Center)
 */

import { NextResponse } from "next/server";
import pg from "pg";
import { calculateWheelSellPriceSafe } from "@/lib/pricing/pricingService";
import { computeWSISellPrice } from "@/lib/wsi/catalog";
import { computeWheel1SellPrice } from "@/lib/wheel1/catalog";
import { getInventoryBulk, type CachedInventory } from "@/lib/inventoryCache";
import type { TechfeedWheel } from "@/lib/techfeed/wheels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shop.warehousetiredirect.com";
const STORE_NAME = "Warehouse Tire Direct";
const MIN_INVENTORY_QTY = 4;

/** Brands excluded from ALL feeds (Pirelli: no eCommerce allowed). */
const EXCLUDED_BRAND_RE = /PIRELLI/i;
/** Brands allowed on our own-site feed but flagged for owner review. */
const FLAGGED_BRAND_RES: Array<{ name: string; re: RegExp }> = [
  { name: "bridgestone", re: /BRIDGESTONE/i },
  { name: "goodyear", re: /GOODYEAR/i },
  { name: "michelin", re: /MICHELIN/i },
];

const CATEGORY_WHEELS = "6092"; // Motor Vehicle Rims & Wheels
const CATEGORY_TIRES = "5614"; // Motor Vehicle Tires
const PRODUCT_TYPE_WHEELS =
  "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Rims & Wheels";
const PRODUCT_TYPE_TIRES =
  "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Tires";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface FeedItem {
  id: string;
  title: string;
  description: string;
  link: string;
  image_link: string;
  price: string; // "123.45 USD"
  availability: "in_stock";
  brand: string;
  mpn: string;
  gtin?: string;
  condition: "new";
  google_product_category: string;
  product_type: string;
  item_group_id?: string;
  /** country:region:service:price — only set when truly determinable (Wheel-1 landed cost). */
  shipping?: string;
}

interface FeedStats {
  wheels: { wheelpros: number; wheel1: number; wsi: number };
  tires: number;
  total: number;
  excluded: { pirelli: number; noImage: number; noPrice: number; duplicateSku: number };
  flaggedBrands: Record<string, number>;
  wheelInventorySource: "redis" | "postgres_snapshot" | "none";
  offset: number;
  limit: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DB
// ═══════════════════════════════════════════════════════════════════════════

const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (pool) return pool;
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing POSTGRES_URL");
  pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 });
  return pool;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function clean(text: unknown, max: number): string {
  return String(text ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
}

function money(n: number): string {
  return `${n.toFixed(2)} USD`;
}

function fullImageUrl(url: string): string {
  return url.startsWith("http") ? url : `https:${url}`;
}

function isBadImage(url: string | null | undefined): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  return u.includes("noimage") || u.includes("placeholder") || u.includes("no-image");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ═══════════════════════════════════════════════════════════════════════════
// TIRES (WheelPros wp_tires + wp_inventory)
// ═══════════════════════════════════════════════════════════════════════════

interface TireRow {
  sku: string;
  brand_desc: string | null;
  tire_description: string | null;
  tire_size: string | null;
  image_url: string | null;
  map_usd: number | null;
  msrp_usd: number | null;
  terrain: string | null;
  load_index: string | null;
  speed_rating: string | null;
}

async function loadTires(db: pg.Pool, stats: FeedStats): Promise<FeedItem[]> {
  const { rows } = await db.query<TireRow>(
    `SELECT t.sku, t.brand_desc, t.tire_description, t.tire_size, t.image_url,
            t.map_usd::float8 AS map_usd, t.msrp_usd::float8 AS msrp_usd,
            t.terrain, t.load_index, t.speed_rating
     FROM wp_tires t
     JOIN wp_inventory i
       ON i.sku = t.sku AND i.product_type = 'tire' AND i.location_id = 'TOTAL'
     WHERE t.sku IS NOT NULL
       AND i.qoh >= $1
       AND t.image_url IS NOT NULL AND t.image_url != ''
     ORDER BY t.sku`,
    [MIN_INVENTORY_QTY]
  );

  const items: FeedItem[] = [];
  for (const t of rows) {
    const brand = (t.brand_desc || "").trim() || "Tire";
    if (EXCLUDED_BRAND_RE.test(brand)) { stats.excluded.pirelli++; continue; }
    if (isBadImage(t.image_url)) { stats.excluded.noImage++; continue; }

    const msrp = t.msrp_usd && t.msrp_usd > 0 ? t.msrp_usd : null;
    const map = t.map_usd && t.map_usd > 0 ? t.map_usd : null;

    // PDP formula: (MSRP × 0.85) + $50, fall back to MAP — floored at MAP so the
    // feed can never advertise below MAP.
    let sell: number | null = null;
    if (msrp) sell = msrp * 0.85 + 50;
    else if (map) sell = map;
    if (sell !== null && map && sell < map) sell = map;
    if (!sell || sell <= 0) { stats.excluded.noPrice++; continue; }

    for (const f of FLAGGED_BRAND_RES) {
      if (f.re.test(brand)) stats.flaggedBrands[f.name] = (stats.flaggedBrands[f.name] || 0) + 1;
    }

    const titleCore = t.tire_description || t.tire_size || "Tire";
    const desc = [
      titleCore,
      t.tire_size ? `Size: ${t.tire_size}` : null,
      t.terrain ? `Type: ${t.terrain}` : null,
      t.load_index ? `Load Index: ${t.load_index}` : null,
      t.speed_rating ? `Speed Rating: ${t.speed_rating}` : null,
    ].filter(Boolean).join(". ");

    items.push({
      id: `tire-${t.sku}`,
      title: clean(`${brand} ${titleCore}`, 150),
      description: clean(desc, 5000),
      link: `${BASE_URL}/tires/${encodeURIComponent(t.sku)}`,
      image_link: fullImageUrl(t.image_url!),
      price: money(Math.round(sell * 100) / 100),
      availability: "in_stock",
      brand: clean(brand, 70),
      mpn: t.sku,
      condition: "new",
      google_product_category: CATEGORY_TIRES,
      product_type: PRODUCT_TYPE_TIRES,
    });
  }
  stats.tires = items.length;
  return items;
}

// ═══════════════════════════════════════════════════════════════════════════
// WHEELPROS WHEELS (techfeed file + Redis inventory, Postgres snapshot fallback)
// ═══════════════════════════════════════════════════════════════════════════

async function loadWheelProsWheels(
  db: pg.Pool,
  stats: FeedStats,
  seenSkus: Set<string>
): Promise<FeedItem[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const zlib = await import("node:zlib");

  let bySku: Record<string, TechfeedWheel>;
  try {
    const filePath = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
    const buf = await fs.readFile(filePath);
    bySku = (JSON.parse(zlib.gunzipSync(buf).toString("utf8")) as { bySku: Record<string, TechfeedWheel> }).bySku || {};
  } catch (err) {
    console.error("[google-merchant] techfeed read failed:", err);
    return [];
  }

  const allSkus = Object.keys(bySku);

  // Inventory: Redis first (live), Postgres wp_inventory snapshot as fallback.
  const qtyBySku = new Map<string, { qty: number; msrp: number | null; map: number | null }>();
  let redisHits = 0;
  try {
    const CHUNK = 500;
    for (let i = 0; i < allSkus.length; i += CHUNK) {
      const chunk = allSkus.slice(i, i + CHUNK);
      const invMap: Map<string, CachedInventory> = await getInventoryBulk(chunk);
      for (const [sku, inv] of invMap) {
        redisHits++;
        qtyBySku.set(sku, { qty: inv.totalQty, msrp: inv.msrp, map: inv.mapPrice });
      }
      if (i === 0 && invMap.size === 0) break; // Redis absent/empty — don't burn 80+ round trips
    }
  } catch (err) {
    console.warn("[google-merchant] Redis inventory unavailable:", err);
  }

  if (redisHits > 0) {
    stats.wheelInventorySource = "redis";
  } else {
    const { rows } = await db.query<{ sku: string; qoh: number }>(
      `SELECT sku, qoh FROM wp_inventory
       WHERE product_type = 'wheel' AND location_id = 'TOTAL' AND qoh >= $1`,
      [MIN_INVENTORY_QTY]
    );
    for (const r of rows) qtyBySku.set(r.sku, { qty: r.qoh, msrp: null, map: null });
    stats.wheelInventorySource = rows.length > 0 ? "postgres_snapshot" : "none";
  }

  const items: FeedItem[] = [];
  for (const [sku, inv] of qtyBySku) {
    if (inv.qty < MIN_INVENTORY_QTY) continue;
    const w = bySku[sku];
    if (!w) continue;

    const brand = (w.brand_desc || w.brand_cd || "").trim() || "Wheel";
    if (EXCLUDED_BRAND_RE.test(brand)) { stats.excluded.pirelli++; continue; }

    const imageUrl = (w.images || [])[0];
    if (!imageUrl || isBadImage(imageUrl)) { stats.excluded.noImage++; continue; }

    const msrp = inv.msrp ?? (Number(w.msrp) || null);
    const map = inv.map ?? (Number(w.map_price) || null);
    const sell = calculateWheelSellPriceSafe({
      sku,
      brandCd: w.brand_cd,
      diameter: w.diameter,
      cost: null,
      map,
      msrp,
    });
    if (!sell || sell <= 0) { stats.excluded.noPrice++; continue; }

    const style = w.product_desc || w.style || w.display_style_no || "Wheel";
    const specs = [
      w.diameter ? `${w.diameter}x${w.width || "?"}` : null,
      w.fancy_finish_desc,
    ].filter(Boolean).join(" ");
    const desc = [
      style,
      w.fancy_finish_desc ? `Finish: ${w.fancy_finish_desc}` : null,
      w.diameter && w.width ? `Size: ${w.diameter}x${w.width}` : null,
      w.bolt_pattern_metric ? `Bolt Pattern: ${w.bolt_pattern_metric}` : null,
      w.offset ? `Offset: ${w.offset}mm` : null,
      w.centerbore ? `Centerbore: ${w.centerbore}mm` : null,
    ].filter(Boolean).join(". ");

    seenSkus.add(sku);
    items.push({
      id: `wheel-${sku}`,
      title: clean(`${brand} ${style} ${specs}`, 150),
      description: clean(desc, 5000),
      link: `${BASE_URL}/wheels/${encodeURIComponent(sku)}`,
      image_link: fullImageUrl(imageUrl),
      price: money(sell),
      availability: "in_stock",
      brand: clean(brand, 70),
      mpn: sku,
      condition: "new",
      google_product_category: CATEGORY_WHEELS,
      product_type: PRODUCT_TYPE_WHEELS,
      item_group_id: w.display_style_no || w.style || undefined,
    });
  }
  stats.wheels.wheelpros = items.length;
  return items;
}

// ═══════════════════════════════════════════════════════════════════════════
// WHEEL-1 WHEELS (wheel1_products — landed cost, free shipping)
// ═══════════════════════════════════════════════════════════════════════════

interface Wheel1FeedRow {
  sku: string;
  brand: string | null;
  name: string | null;
  style_number: string | null;
  diameter: string | null;
  wheel_width: string | null;
  pcd1: string | null;
  pcd2: string | null;
  offset_mm: string | null;
  finish: string | null;
  color: string | null;
  msrp: string | null;
  map_price: string | null;
  dealer_cost: string | null;
  inventory_qty: number | null;
  image1: string | null;
  upc: string | null;
}

async function loadWheel1Wheels(db: pg.Pool, stats: FeedStats, seenSkus: Set<string>): Promise<FeedItem[]> {
  const { rows } = await db.query<Wheel1FeedRow>(
    `SELECT sku, brand, name, style_number, diameter::text, wheel_width::text,
            pcd1, pcd2, offset_mm::text, finish, color,
            msrp::text, map_price::text, dealer_cost::text,
            inventory_qty, image1, upc
     FROM wheel1_products
     WHERE is_discontinued = FALSE
       AND COALESCE(inventory_qty, 0) >= $1
       AND image1 IS NOT NULL AND image1 != ''
     ORDER BY sku`,
    [MIN_INVENTORY_QTY]
  );

  const items: FeedItem[] = [];
  for (const r of rows) {
    if (seenSkus.has(r.sku)) { stats.excluded.duplicateSku++; continue; }
    const brand = (r.brand || "").trim() || "Wheel";
    if (EXCLUDED_BRAND_RE.test(brand)) { stats.excluded.pirelli++; continue; }
    if (isBadImage(r.image1)) { stats.excluded.noImage++; continue; }

    const msrp = r.msrp ? parseFloat(r.msrp) : null;
    const map = r.map_price && parseFloat(r.map_price) > 0 ? parseFloat(r.map_price) : null;
    const cost = r.dealer_cost ? parseFloat(r.dealer_cost) : null;
    const diameter = r.diameter ? parseFloat(r.diameter) : 0;
    const sell = computeWheel1SellPrice({ msrp, mapPrice: map, dealerCost: cost, diameter });
    if (!sell || sell <= 0) { stats.excluded.noPrice++; continue; }

    const style = r.name || r.style_number || "Wheel";
    const finish = [r.finish, r.color].filter(Boolean).join(" ");
    const size = r.diameter && r.wheel_width ? `${r.diameter}x${r.wheel_width}` : null;
    const desc = [
      style,
      finish ? `Finish: ${finish}` : null,
      size ? `Size: ${size}` : null,
      r.pcd1 ? `Bolt Pattern: ${[r.pcd1, r.pcd2].filter(Boolean).join(" / ")}` : null,
      r.offset_mm ? `Offset: ${r.offset_mm}mm` : null,
      "Free shipping included.",
    ].filter(Boolean).join(". ");

    seenSkus.add(r.sku);
    items.push({
      id: `wheel-${r.sku}`,
      title: clean(`${brand} ${style} ${[size, finish].filter(Boolean).join(" ")}`, 150),
      description: clean(desc, 5000),
      link: `${BASE_URL}/wheels/${encodeURIComponent(r.sku)}`,
      image_link: fullImageUrl(r.image1!),
      price: money(sell),
      availability: "in_stock",
      brand: clean(brand, 70),
      mpn: r.sku,
      gtin: r.upc && /^\d{8,14}$/.test(r.upc.trim()) ? r.upc.trim() : undefined,
      condition: "new",
      google_product_category: CATEGORY_WHEELS,
      product_type: PRODUCT_TYPE_WHEELS,
      item_group_id: r.style_number || undefined,
      shipping: "US:::0.00 USD", // freight baked into landed-cost price
    });
  }
  stats.wheels.wheel1 = items.length;
  return items;
}

// ═══════════════════════════════════════════════════════════════════════════
// WSI WHEELS (wsi_wheels)
// ═══════════════════════════════════════════════════════════════════════════

interface WSIFeedRow {
  sku: string;
  brand: string | null;
  style: string | null;
  finish: string | null;
  diameter: string | null;
  width: string | null;
  bp1: string | null;
  bp2: string | null;
  offset_mm: string | null;
  centerbore: string | null;
  catalog_price: string | null;
  dealer_cost: string | null;
  image_url: string | null;
}

async function loadWSIWheels(db: pg.Pool, stats: FeedStats, seenSkus: Set<string>): Promise<FeedItem[]> {
  const { rows } = await db.query<WSIFeedRow>(
    `SELECT sku, brand, style, finish, diameter::text, width::text,
            bp1, bp2, offset_mm::text, centerbore::text,
            catalog_price::text, dealer_cost::text, image_url
     FROM wsi_wheels
     WHERE (COALESCE(wsi_stock, 0) + COALESCE(alt_stock, 0)) >= $1
       AND image_url IS NOT NULL AND image_url != ''
     ORDER BY sku`,
    [MIN_INVENTORY_QTY]
  );

  const items: FeedItem[] = [];
  for (const r of rows) {
    if (seenSkus.has(r.sku)) { stats.excluded.duplicateSku++; continue; }
    const brand = (r.brand || "").trim() || "Wheel";
    if (EXCLUDED_BRAND_RE.test(brand)) { stats.excluded.pirelli++; continue; }
    if (isBadImage(r.image_url)) { stats.excluded.noImage++; continue; }

    const dealerCost = r.dealer_cost ? parseFloat(r.dealer_cost) : null;
    const catalogPrice = r.catalog_price ? parseFloat(r.catalog_price) : null;
    const sell = computeWSISellPrice({ dealerCost, catalogPrice });
    if (!sell || sell <= 0) { stats.excluded.noPrice++; continue; }

    const style = r.style || "Wheel";
    const size = r.diameter && r.width ? `${r.diameter}x${r.width}` : null;
    const desc = [
      style,
      r.finish ? `Finish: ${r.finish}` : null,
      size ? `Size: ${size}` : null,
      r.bp1 ? `Bolt Pattern: ${[r.bp1, r.bp2].filter(Boolean).join(" / ")}` : null,
      r.offset_mm ? `Offset: ${r.offset_mm}mm` : null,
      r.centerbore ? `Centerbore: ${r.centerbore}mm` : null,
    ].filter(Boolean).join(". ");

    seenSkus.add(r.sku);
    items.push({
      id: `wheel-${r.sku}`,
      title: clean(`${brand} ${style} ${[size, r.finish].filter(Boolean).join(" ")}`, 150),
      description: clean(desc, 5000),
      link: `${BASE_URL}/wheels/${encodeURIComponent(r.sku)}`,
      image_link: fullImageUrl(r.image_url!),
      price: money(sell),
      availability: "in_stock",
      brand: clean(brand, 70),
      mpn: r.sku,
      condition: "new",
      google_product_category: CATEGORY_WHEELS,
      product_type: PRODUCT_TYPE_WHEELS,
      item_group_id: r.style || undefined,
    });
  }
  stats.wheels.wsi = items.length;
  return items;
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT FORMATS
// ═══════════════════════════════════════════════════════════════════════════

const TSV_COLUMNS: Array<keyof FeedItem> = [
  "id", "title", "description", "link", "image_link", "availability", "price",
  "brand", "mpn", "gtin", "condition", "google_product_category", "product_type",
  "item_group_id", "shipping",
];

function toTsv(items: FeedItem[]): string {
  const lines = [TSV_COLUMNS.join("\t")];
  for (const it of items) {
    lines.push(TSV_COLUMNS.map((c) => clean(it[c] ?? "", 5000)).join("\t"));
  }
  return lines.join("\n") + "\n";
}

function itemToXml(p: FeedItem): string {
  const opt = (tag: string, v?: string) => (v ? `      <g:${tag}>${escapeXml(v)}</g:${tag}>\n` : "");
  return `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.title)}</g:title>
      <g:description>${escapeXml(p.description)}</g:description>
      <g:link>${escapeXml(p.link)}</g:link>
      <g:image_link>${escapeXml(p.image_link)}</g:image_link>
      <g:price>${escapeXml(p.price)}</g:price>
      <g:availability>${p.availability}</g:availability>
      <g:brand>${escapeXml(p.brand)}</g:brand>
      <g:mpn>${escapeXml(p.mpn)}</g:mpn>
${opt("gtin", p.gtin)}      <g:condition>${p.condition}</g:condition>
      <g:google_product_category>${p.google_product_category}</g:google_product_category>
      <g:product_type>${escapeXml(p.product_type)}</g:product_type>
${opt("item_group_id", p.item_group_id)}${p.shipping ? `      <g:shipping><g:country>US</g:country><g:price>0.00 USD</g:price></g:shipping>\n` : ""}    </item>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: Request): Promise<Response> {
  const t0 = Date.now();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "all"; // all | wheels | tires
  const format = url.searchParams.get("format") || "tsv"; // tsv | xml | json
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const limit = Math.min(100000, Math.max(1, parseInt(url.searchParams.get("limit") || "100000", 10)));

  const stats: FeedStats = {
    wheels: { wheelpros: 0, wheel1: 0, wsi: 0 },
    tires: 0,
    total: 0,
    excluded: { pirelli: 0, noImage: 0, noPrice: 0, duplicateSku: 0 },
    flaggedBrands: {},
    wheelInventorySource: "none",
    offset,
    limit,
  };

  try {
    const db = getPool();
    const items: FeedItem[] = [];
    const seenSkus = new Set<string>();

    if (type === "all" || type === "wheels") {
      // PDP resolution order: WheelPros techfeed → Wheel-1 → WSI
      items.push(...(await loadWheelProsWheels(db, stats, seenSkus)));
      items.push(...(await loadWheel1Wheels(db, stats, seenSkus)));
      items.push(...(await loadWSIWheels(db, stats, seenSkus)));
    }
    if (type === "all" || type === "tires") {
      items.push(...(await loadTires(db, stats)));
    }

    const page = items.slice(offset, offset + limit);
    stats.total = page.length;
    const durationMs = Date.now() - t0;
    console.log(
      `[google-merchant] ${stats.total} products (wp:${stats.wheels.wheelpros} w1:${stats.wheels.wheel1} wsi:${stats.wheels.wsi} tires:${stats.tires}) ` +
      `invSource=${stats.wheelInventorySource} excl=${JSON.stringify(stats.excluded)} flagged=${JSON.stringify(stats.flaggedBrands)} in ${durationMs}ms`
    );

    const headers: Record<string, string> = {
      "Cache-Control": "public, max-age=3600",
      "X-Feed-Stats": JSON.stringify(stats),
    };

    if (format === "json") {
      return NextResponse.json({ stats, timing: { durationMs }, products: page }, { headers });
    }

    if (format === "xml") {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(STORE_NAME)}</title>
    <link>${BASE_URL}</link>
    <description>Wheels and Tires from ${escapeXml(STORE_NAME)}</description>
${page.map(itemToXml).join("\n")}
  </channel>
</rss>`;
      return new Response(xml, {
        status: 200,
        headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" },
      });
    }

    return new Response(toTsv(page), {
      status: 200,
      headers: { ...headers, "Content-Type": "text/tab-separated-values; charset=utf-8" },
    });
  } catch (err) {
    console.error("[google-merchant] Feed error:", err);
    return NextResponse.json(
      { error: "Feed generation failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
