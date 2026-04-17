/**
 * Google Shopping Product Feed API - Wheels + Tires
 * @created 2026-04-17
 */

import { NextResponse } from "next/server";
import pg from "pg";
import { getTechfeedWheelBySku, warmTechfeedWheelCache, type TechfeedWheel } from "@/lib/techfeed/wheels";
import { getInventoryBulk, type CachedInventory } from "@/lib/inventoryCache";
import { calculateWheelSellPrice } from "@/lib/pricing/pricingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_URL = "https://shop.warehousetiredirect.com";
const STORE_NAME = "Warehouse Tire Direct";
const MIN_INVENTORY_QTY = 4;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface GoogleProduct {
  id: string;
  title: string;
  description: string;
  link: string;
  image_link: string;
  price: string;
  availability: "in_stock" | "out_of_stock";
  brand: string;
  mpn: string;
  condition: "new";
  product_type?: string;
  google_product_category?: string;
  item_group_id?: string;
}

interface TireRow {
  sku: string;
  brand_desc: string | null;
  tire_description: string | null;
  tire_size: string | null;
  image_url: string | null;
  map_usd: number | null;
  msrp_usd: number | null;
  qoh: number;
  terrain: string | null;
  load_index: string | null;
  speed_rating: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

const { Pool } = pg;

let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (pool) return pool;
  const DATABASE_URL = process.env.POSTGRES_URL;
  if (!DATABASE_URL) throw new Error("Missing POSTGRES_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

// ═══════════════════════════════════════════════════════════════════════════════
// XML HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function productToXml(p: GoogleProduct): string {
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
      <g:condition>${p.condition}</g:condition>
      ${p.product_type ? `<g:product_type>${escapeXml(p.product_type)}</g:product_type>` : ""}
      ${p.google_product_category ? `<g:google_product_category>${p.google_product_category}</g:google_product_category>` : ""}
      ${p.item_group_id ? `<g:item_group_id>${escapeXml(p.item_group_id)}</g:item_group_id>` : ""}
    </item>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL TRANSFORMATION
// ═══════════════════════════════════════════════════════════════════════════════

function transformWheel(wheel: TechfeedWheel, inventory: CachedInventory | null): GoogleProduct | null {
  if (!wheel.sku) return null;

  // Get pricing
  const mapPrice = inventory?.mapPrice ?? (Number(wheel.map_price) || null);
  const msrp = inventory?.msrp ?? (Number(wheel.msrp) || null);
  const cost = msrp ? msrp * 0.75 : null;

  const sellPrice = calculateWheelSellPrice({ cost, map: mapPrice, msrp, sku: wheel.sku });
  if (!sellPrice || sellPrice <= 0) return null;

  // Build title
  const brand = wheel.brand_desc || wheel.brand_cd || "Wheel";
  const style = wheel.product_desc || wheel.style || wheel.display_style_no || "Wheel";
  const specs = [
    wheel.diameter ? `${wheel.diameter}"` : null,
    wheel.width ? `${wheel.width}" Wide` : null,
    wheel.fancy_finish_desc,
  ].filter(Boolean).join(" ");

  const title = `${brand} ${style} ${specs}`.trim().slice(0, 150);

  // Build description
  const descParts = [
    style,
    wheel.fancy_finish_desc ? `Finish: ${wheel.fancy_finish_desc}` : null,
    wheel.diameter && wheel.width ? `Size: ${wheel.diameter}x${wheel.width}` : null,
    wheel.bolt_pattern_metric ? `Bolt Pattern: ${wheel.bolt_pattern_metric}` : null,
    wheel.offset ? `Offset: ${wheel.offset}mm` : null,
    wheel.centerbore ? `Centerbore: ${wheel.centerbore}mm` : null,
  ];
  const description = descParts.filter(Boolean).join(". ").slice(0, 5000);

  // Get image
  const imageUrl = wheel.images?.[0];
  if (!imageUrl) return null;

  // Check inventory
  const qty = inventory?.totalQty ?? 0;
  if (qty < MIN_INVENTORY_QTY) return null;

  return {
    id: `wheel-${wheel.sku}`,
    title,
    description,
    link: `${BASE_URL}/wheels/${encodeURIComponent(wheel.sku)}`,
    image_link: imageUrl.startsWith("http") ? imageUrl : `https:${imageUrl}`,
    price: `${sellPrice.toFixed(2)} USD`,
    availability: "in_stock",
    brand,
    mpn: wheel.sku,
    condition: "new",
    product_type: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Rims & Wheels",
    google_product_category: "6092",
    item_group_id: wheel.display_style_no || wheel.style,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL LOADER - Get SKUs from Redis inventory, details from techfeed
// ═══════════════════════════════════════════════════════════════════════════════

async function loadWheels(offset: number, limit: number): Promise<GoogleProduct[]> {
  // First, warm the techfeed cache to get all wheel SKUs
  const warmResult = await warmTechfeedWheelCache();
  if (!warmResult.loaded) {
    console.log("[google-shopping] Techfeed wheels not available");
    return [];
  }

  // Load SKUs from techfeed cache (we need to iterate through them)
  // Since warmTechfeedWheelCache populates the cache, we can use getTechfeedWheelBySku
  // But we need a way to get all SKUs... Let's read the file directly for the feed
  
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const zlib = await import("node:zlib");
  
  try {
    const filePath = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
    const buf = await fs.readFile(filePath);
    const json = zlib.gunzipSync(buf).toString("utf8");
    const data = JSON.parse(json) as { bySku: Record<string, TechfeedWheel> };
    
    const allSkus = Object.keys(data.bySku || {});
    const skuSlice = allSkus.slice(offset, offset + limit);
    
    // Get inventory for these SKUs
    const inventoryMap = await getInventoryBulk(skuSlice);
    
    const products: GoogleProduct[] = [];
    for (const sku of skuSlice) {
      const wheel = data.bySku[sku];
      if (!wheel) continue;
      
      const inventory = inventoryMap.get(sku) || null;
      const product = transformWheel(wheel, inventory);
      if (product) {
        products.push(product);
      }
    }
    
    return products;
  } catch (err) {
    console.error("[google-shopping] Failed to load wheels:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE LOADER
// ═══════════════════════════════════════════════════════════════════════════════

async function loadTires(db: pg.Pool, offset: number, limit: number): Promise<GoogleProduct[]> {
  const { rows } = await db.query<TireRow>(`
    SELECT
      t.sku,
      t.brand_desc,
      t.tire_description,
      t.tire_size,
      t.image_url,
      t.map_usd,
      t.msrp_usd,
      COALESCE(i.qoh, 0) as qoh,
      t.terrain,
      t.load_index,
      t.speed_rating
    FROM wp_tires t
    LEFT JOIN wp_inventory i
      ON i.sku = t.sku
      AND i.product_type = 'tire'
      AND i.location_id = 'TOTAL'
    WHERE t.sku IS NOT NULL
      AND COALESCE(i.qoh, 0) >= $1
      AND t.image_url IS NOT NULL
      AND t.image_url != ''
    ORDER BY t.sku
    OFFSET $2
    LIMIT $3
  `, [MIN_INVENTORY_QTY, offset, limit]);

  const products: GoogleProduct[] = [];

  for (const tire of rows) {
    if (!tire.sku) continue;

    const msrp = tire.msrp_usd && tire.msrp_usd > 0 ? tire.msrp_usd : null;
    const map = tire.map_usd && tire.map_usd > 0 ? tire.map_usd : null;

    let sellPrice: number | null = null;
    if (msrp) {
      sellPrice = (msrp * 0.85) + 50;
    } else if (map) {
      sellPrice = map;
    }

    if (!sellPrice || sellPrice <= 0) continue;

    const brand = tire.brand_desc || "Tire";
    const description = tire.tire_description || tire.tire_size || "Tire";
    const title = `${brand} ${description}`.trim().slice(0, 150);

    let imageUrl = tire.image_url;
    if (!imageUrl) continue;
    if (!imageUrl.startsWith("http")) {
      imageUrl = `https:${imageUrl}`;
    }
    const lowerUrl = imageUrl.toLowerCase();
    if (lowerUrl.includes("noimage") || lowerUrl.includes("placeholder") || lowerUrl.includes("no-image")) {
      continue;
    }

    const descParts = [
      description,
      tire.tire_size ? `Size: ${tire.tire_size}` : null,
      tire.terrain ? `Type: ${tire.terrain}` : null,
      tire.load_index ? `Load Index: ${tire.load_index}` : null,
      tire.speed_rating ? `Speed Rating: ${tire.speed_rating}` : null,
    ];

    products.push({
      id: `tire-${tire.sku}`,
      title,
      description: descParts.filter(Boolean).join(". ").slice(0, 5000),
      link: `${BASE_URL}/tires/${encodeURIComponent(tire.sku)}`,
      image_link: imageUrl,
      price: `${sellPrice.toFixed(2)} USD`,
      availability: tire.qoh >= MIN_INVENTORY_QTY ? "in_stock" : "out_of_stock",
      brand,
      mpn: tire.sku,
      condition: "new",
      product_type: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Tires",
      google_product_category: "5614",
    });
  }

  return products;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: Request): Promise<Response> {
  const t0 = Date.now();
  const url = new URL(req.url);

  const type = url.searchParams.get("type") || "all"; // "all", "wheels", "tires"
  const format = url.searchParams.get("format") || "xml";
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const limit = Math.min(50000, Math.max(1, parseInt(url.searchParams.get("limit") || "10000", 10)));

  const products: GoogleProduct[] = [];
  const stats = { wheels: 0, tires: 0, total: 0, offset, limit };

  try {
    const db = getPool();

    // Load wheels
    if (type === "all" || type === "wheels") {
      const wheels = await loadWheels(type === "wheels" ? offset : 0, type === "wheels" ? limit : Math.floor(limit / 2));
      products.push(...wheels);
      stats.wheels = wheels.length;
    }

    // Load tires
    if (type === "all" || type === "tires") {
      const tireOffset = type === "tires" ? offset : 0;
      const tireLimit = type === "tires" ? limit : limit - products.length;
      const tires = await loadTires(db, tireOffset, tireLimit);
      products.push(...tires);
      stats.tires = tires.length;
    }

    stats.total = products.length;
    const durationMs = Date.now() - t0;

    console.log(`[google-shopping] Generated feed: ${stats.total} products (${stats.wheels} wheels, ${stats.tires} tires) in ${durationMs}ms`);

    if (format === "json") {
      return NextResponse.json({ products, stats, timing: { durationMs } });
    }

    const items = products.map(productToXml).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(STORE_NAME)}</title>
    <link>${BASE_URL}</link>
    <description>Wheels and Tires from ${escapeXml(STORE_NAME)}</description>
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[google-shopping] Feed error:", err);
    return NextResponse.json(
      { error: "Feed generation failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
