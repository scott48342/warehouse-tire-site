/**
 * Google Shopping Product Feed API
 * 
 * Generates a Google Merchant Center compatible product feed (RSS 2.0 / Atom with g: namespace).
 * 
 * Endpoints:
 * - GET /api/feeds/google-shopping            - Full feed (default: first 1000 products)
 * - GET /api/feeds/google-shopping?type=wheels - Wheels only
 * - GET /api/feeds/google-shopping?type=tires  - Tires only
 * - GET /api/feeds/google-shopping?offset=1000&limit=1000 - Pagination
 * - GET /api/feeds/google-shopping?format=json - JSON format (for debugging)
 * 
 * Google Merchant Center Required Fields:
 * - id, title, description, link, image_link, price, availability, brand, condition
 * - gtin OR mpn (we use mpn since most products don't have GTIN/UPC)
 * 
 * Feed Registration:
 * 1. Go to Google Merchant Center → Products → Feeds
 * 2. Add new feed → Scheduled fetch
 * 3. URL: https://warehousetiredirect.com/api/feeds/google-shopping
 * 4. Schedule: Daily (recommended)
 * 
 * @created 2026-04-17
 */

import { NextResponse } from "next/server";
import pg from "pg";
import zlib from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";
import { calculateWheelSellPrice } from "@/lib/pricing/pricingService";
import { getInventoryBulk, type CachedInventory } from "@/lib/inventoryCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow longer execution for large feeds

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://warehousetiredirect.com";
const STORE_NAME = "Warehouse Tire Direct";
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const MIN_INVENTORY_QTY = 4; // Minimum quantity to show as in_stock

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface GoogleProduct {
  id: string;
  title: string;
  description: string;
  link: string;
  image_link: string;
  price: string; // e.g., "199.99 USD"
  availability: "in_stock" | "out_of_stock" | "preorder";
  brand: string;
  mpn: string; // Manufacturer Part Number
  condition: "new" | "refurbished" | "used";
  product_type?: string; // Category path
  google_product_category?: string; // Google taxonomy ID
  item_group_id?: string; // For variant grouping
}

type TechfeedWheel = {
  sku: string;
  product_desc?: string;
  brand_cd?: string;
  brand_desc?: string;
  style?: string;
  display_style_no?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  centerbore?: string;
  bolt_pattern_metric?: string;
  fancy_finish_desc?: string;
  msrp?: string;
  map_price?: string;
  images?: string[];
};

type TechfeedWheelsFile = {
  generatedAt?: string;
  rows?: number;
  bySku: Record<string, TechfeedWheel>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════

const { Pool } = pg;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (pool) return pool;
  const DATABASE_URL = required("POSTGRES_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TECHFEED WHEEL LOADER
// ═══════════════════════════════════════════════════════════════════════════════

async function loadTechfeedWheels(): Promise<TechfeedWheel[]> {
  try {
    const filePath = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
    const buf = await fs.readFile(filePath);
    const json = zlib.gunzipSync(buf).toString("utf8");
    const data = JSON.parse(json) as TechfeedWheelsFile;
    return Object.values(data.bySku || {});
  } catch (err) {
    console.error("[google-shopping] Failed to load techfeed wheels:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL PRODUCT TRANSFORMATION
// ═══════════════════════════════════════════════════════════════════════════════

function transformWheel(
  wheel: TechfeedWheel,
  inventory: CachedInventory | null
): GoogleProduct | null {
  if (!wheel.sku) return null;

  // Get pricing from inventory cache (SFTP feed) or fallback to techfeed
  const mapPrice = inventory?.mapPrice ?? (Number(wheel.map_price) || null);
  const msrp = inventory?.msrp ?? (Number(wheel.msrp) || null);

  // Calculate sell price using pricingService
  // Inventory cost is derived: MSRP × 0.75
  const cost = msrp ? msrp * 0.75 : null;
  const sellPrice = calculateWheelSellPrice({
    cost,
    map: mapPrice,
    msrp,
    sku: wheel.sku,
  });

  // Skip products without valid pricing
  if (!sellPrice || sellPrice <= 0) return null;

  // Build title
  const brand = wheel.brand_desc || wheel.brand_cd || "Wheel";
  const style = wheel.product_desc || wheel.style || wheel.display_style_no || "Wheel";
  const specs = [
    wheel.diameter ? `${wheel.diameter}"` : null,
    wheel.width ? `${wheel.width}" Wide` : null,
    wheel.fancy_finish_desc,
  ]
    .filter(Boolean)
    .join(" ");

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

  // Get primary image
  const imageUrl = wheel.images?.[0];
  if (!imageUrl) return null; // Google requires an image

  // Determine availability
  const qty = inventory?.totalQty ?? 0;
  const availability: GoogleProduct["availability"] =
    qty >= MIN_INVENTORY_QTY ? "in_stock" : "out_of_stock";

  // Skip out of stock items from feed (optional - can be changed to include them)
  if (availability === "out_of_stock") return null;

  return {
    id: `wheel-${wheel.sku}`,
    title,
    description,
    link: `${BASE_URL}/wheels/${encodeURIComponent(wheel.sku)}`,
    image_link: imageUrl.startsWith("http") ? imageUrl : `https:${imageUrl}`,
    price: `${sellPrice.toFixed(2)} USD`,
    availability,
    brand,
    mpn: wheel.sku,
    condition: "new",
    product_type: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Rims & Wheels",
    google_product_category: "6092", // Motor Vehicle Rims & Wheels
    item_group_id: wheel.display_style_no || wheel.style,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE PRODUCT TRANSFORMATION
// ═══════════════════════════════════════════════════════════════════════════════

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

async function loadTires(db: pg.Pool, offset: number, limit: number): Promise<TireRow[]> {
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

  return rows;
}

async function getTireTotalCount(db: pg.Pool): Promise<number> {
  const { rows } = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM wp_tires t
    LEFT JOIN wp_inventory i
      ON i.sku = t.sku
      AND i.product_type = 'tire'
      AND i.location_id = 'TOTAL'
    WHERE t.sku IS NOT NULL
      AND COALESCE(i.qoh, 0) >= $1
      AND t.image_url IS NOT NULL
      AND t.image_url != ''
  `, [MIN_INVENTORY_QTY]);

  return parseInt(rows[0]?.count || "0", 10);
}

function transformTire(tire: TireRow): GoogleProduct | null {
  if (!tire.sku) return null;

  // Calculate sell price: (MSRP × 0.85) + $50, fallback to MAP
  const msrp = tire.msrp_usd && tire.msrp_usd > 0 ? tire.msrp_usd : null;
  const map = tire.map_usd && tire.map_usd > 0 ? tire.map_usd : null;

  let sellPrice: number | null = null;
  if (msrp) {
    sellPrice = (msrp * 0.85) + 50;
  } else if (map) {
    sellPrice = map;
  }

  if (!sellPrice || sellPrice <= 0) return null;

  const brand = tire.brand_desc || "Tire";
  const description = tire.tire_description || tire.tire_size || "Tire";
  const size = tire.tire_size || "";

  // Build title
  const title = `${brand} ${description}`.trim().slice(0, 150);

  // Build extended description
  const descParts = [
    description,
    size ? `Size: ${size}` : null,
    tire.terrain ? `Type: ${tire.terrain}` : null,
    tire.load_index ? `Load Index: ${tire.load_index}` : null,
    tire.speed_rating ? `Speed Rating: ${tire.speed_rating}` : null,
  ];
  const fullDescription = descParts.filter(Boolean).join(". ").slice(0, 5000);

  // Get image URL
  let imageUrl = tire.image_url;
  if (!imageUrl) return null;
  if (!imageUrl.startsWith("http")) {
    imageUrl = `https:${imageUrl}`;
  }

  // Check for placeholder/invalid images
  const lowerUrl = imageUrl.toLowerCase();
  if (
    lowerUrl.includes("noimage") ||
    lowerUrl.includes("placeholder") ||
    lowerUrl.includes("no-image")
  ) {
    return null;
  }

  const availability: GoogleProduct["availability"] =
    tire.qoh >= MIN_INVENTORY_QTY ? "in_stock" : "out_of_stock";

  return {
    id: `tire-${tire.sku}`,
    title,
    description: fullDescription,
    link: `${BASE_URL}/tires/${encodeURIComponent(tire.sku)}`,
    image_link: imageUrl,
    price: `${sellPrice.toFixed(2)} USD`,
    availability,
    brand,
    mpn: tire.sku,
    condition: "new",
    product_type: "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Tires",
    google_product_category: "5614", // Motor Vehicle Tires
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// XML FEED GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function productToXml(product: GoogleProduct): string {
  return `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.title)}</g:title>
      <g:description>${escapeXml(product.description)}</g:description>
      <g:link>${escapeXml(product.link)}</g:link>
      <g:image_link>${escapeXml(product.image_link)}</g:image_link>
      <g:price>${escapeXml(product.price)}</g:price>
      <g:availability>${product.availability}</g:availability>
      <g:brand>${escapeXml(product.brand)}</g:brand>
      <g:mpn>${escapeXml(product.mpn)}</g:mpn>
      <g:condition>${product.condition}</g:condition>
      ${product.product_type ? `<g:product_type>${escapeXml(product.product_type)}</g:product_type>` : ""}
      ${product.google_product_category ? `<g:google_product_category>${product.google_product_category}</g:google_product_category>` : ""}
      ${product.item_group_id ? `<g:item_group_id>${escapeXml(product.item_group_id)}</g:item_group_id>` : ""}
    </item>`;
}

function generateXmlFeed(products: GoogleProduct[]): string {
  const items = products.map(productToXml).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(STORE_NAME)}</title>
    <link>${BASE_URL}</link>
    <description>Wheels and Tires from ${escapeXml(STORE_NAME)}</description>
${items}
  </channel>
</rss>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: Request): Promise<Response> {
  const t0 = Date.now();
  const url = new URL(req.url);

  // Parse parameters
  const type = url.searchParams.get("type") || "all"; // "all", "wheels", "tires"
  const format = url.searchParams.get("format") || "xml"; // "xml" or "json"
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10)));

  const products: GoogleProduct[] = [];
  const stats = {
    wheelsProcessed: 0,
    wheelsIncluded: 0,
    tiresProcessed: 0,
    tiresIncluded: 0,
    totalProducts: 0,
    offset,
    limit,
    hasMore: false,
  };

  try {
    const db = getPool();

    // ═══════════════════════════════════════════════════════════════════════════
    // LOAD WHEELS
    // ═══════════════════════════════════════════════════════════════════════════
    if (type === "all" || type === "wheels") {
      const allWheels = await loadTechfeedWheels();
      stats.wheelsProcessed = allWheels.length;

      // Get inventory data for all wheel SKUs
      const wheelSkus = allWheels.map((w) => w.sku).filter(Boolean);
      const inventoryData = await getInventoryBulk(wheelSkus);

      // Filter and transform wheels (apply offset/limit for wheels-only requests)
      let wheelsToProcess = allWheels;
      if (type === "wheels") {
        wheelsToProcess = allWheels.slice(offset, offset + limit);
        stats.hasMore = offset + limit < allWheels.length;
      }

      for (const wheel of wheelsToProcess) {
        const inv = inventoryData.get(wheel.sku) || null;
        const product = transformWheel(wheel, inv);
        if (product) {
          products.push(product);
          stats.wheelsIncluded++;
        }
        // Stop if we've reached the limit
        if (products.length >= limit) break;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LOAD TIRES
    // ═══════════════════════════════════════════════════════════════════════════
    if ((type === "all" || type === "tires") && products.length < limit) {
      const remainingLimit = limit - products.length;
      const tireOffset = type === "tires" ? offset : 0;

      const tires = await loadTires(db, tireOffset, remainingLimit);
      stats.tiresProcessed = tires.length;

      for (const tire of tires) {
        const product = transformTire(tire);
        if (product) {
          products.push(product);
          stats.tiresIncluded++;
        }
        if (products.length >= limit) break;
      }

      // Check if there are more tires
      if (type === "tires") {
        const totalTires = await getTireTotalCount(db);
        stats.hasMore = offset + tires.length < totalTires;
      }
    }

    stats.totalProducts = products.length;
    const durationMs = Date.now() - t0;

    console.log(
      `[google-shopping] Generated feed: ${stats.totalProducts} products ` +
        `(${stats.wheelsIncluded} wheels, ${stats.tiresIncluded} tires) in ${durationMs}ms`
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // RETURN RESPONSE
    // ═══════════════════════════════════════════════════════════════════════════
    if (format === "json") {
      return NextResponse.json({
        products,
        stats,
        timing: { durationMs },
      });
    }

    // XML response
    const xmlFeed = generateXmlFeed(products);
    return new Response(xmlFeed, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Feed-Stats": JSON.stringify(stats),
      },
    });
  } catch (err) {
    console.error("[google-shopping] Feed generation failed:", err);
    return NextResponse.json(
      {
        error: "Feed generation failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
