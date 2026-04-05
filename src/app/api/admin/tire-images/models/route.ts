/**
 * Admin API: Get all unique tire models from WheelPros database
 * Shows which ones have images and which don't
 */
import { NextResponse } from "next/server";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Missing POSTGRES_URL");
  pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 });
  return pool;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const brandFilter = url.searchParams.get("brand");
  const missingOnly = url.searchParams.get("missing") === "1";
  
  try {
    const db = getPool();
    
    // Get all unique brand + display_model_no combinations from WheelPros
    const { rows: models } = await db.query(`
      SELECT DISTINCT 
        brand_desc as brand,
        raw->>'display_model_no' as full_model,
        COUNT(*) as variant_count,
        MIN(image_url) as wheelpros_image
      FROM wp_tires 
      WHERE raw->>'display_model_no' IS NOT NULL
        ${brandFilter ? "AND LOWER(brand_desc) = LOWER($1)" : ""}
      GROUP BY brand_desc, raw->>'display_model_no'
      ORDER BY brand_desc, raw->>'display_model_no'
    `, brandFilter ? [brandFilter] : []);
    
    // Get existing image mappings
    const { rows: imgRows } = await db.query(`
      SELECT brand, model_pattern, image_url FROM tire_model_images
    `);
    
    // Create lookup map
    const imageMap = new Map<string, { pattern: string; url: string }>();
    imgRows.forEach(r => {
      const key = (r.brand + '|' + r.model_pattern).toLowerCase();
      imageMap.set(key, { pattern: r.model_pattern, url: r.image_url });
    });
    
    // Match models to images
    const results = models.map(m => {
      const exactKey = (m.brand + '|' + m.full_model).toLowerCase();
      let match = imageMap.get(exactKey);
      let matchType: 'exact' | 'partial' | 'none' = 'none';
      
      if (match) {
        matchType = 'exact';
      } else {
        // Check partial matches
        for (const [key, val] of imageMap) {
          const [mapBrand, mapModel] = key.split('|');
          if (mapBrand === m.brand.toLowerCase() && 
              m.full_model.toLowerCase().includes(mapModel)) {
            match = val;
            matchType = 'partial';
            break;
          }
        }
      }
      
      return {
        brand: m.brand,
        fullModel: m.full_model,
        variantCount: Number(m.variant_count),
        wheelprosImage: m.wheelpros_image,
        hasImage: !!match,
        matchType,
        matchedPattern: match?.pattern || null,
        imageUrl: match?.url || null,
      };
    });
    
    // Get unique brands for filter
    const brands = [...new Set(models.map(m => m.brand))].sort();
    
    // Filter if needed
    const filtered = missingOnly 
      ? results.filter(r => !r.hasImage)
      : results;
    
    return NextResponse.json({
      models: filtered,
      brands,
      stats: {
        total: results.length,
        withImage: results.filter(r => r.hasImage).length,
        missing: results.filter(r => !r.hasImage).length,
      },
    });
  } catch (err: any) {
    console.error("[admin/tire-images/models] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
