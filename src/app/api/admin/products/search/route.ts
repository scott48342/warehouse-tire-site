import { NextResponse } from "next/server";
import pg from "pg";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";

const { Pool } = pg;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Search K&M tires by part number
 * Uses /v1/inventory endpoint (same as partlookup route)
 */
async function searchKmTiresByPartNumber(partNumber: string): Promise<any[]> {
  const apiKey = (
    process.env.KM_API_KEY ||
    process.env.KMTIRE_API_KEY ||
    process.env.KM_TIRE_API_KEY ||
    ""
  ).trim();
  
  if (!apiKey) return [];
  
  // K&M inventory endpoint may require VendorName to avoid 500 error
  // Use "Hamaton" as fallback (works for tires too based on testing)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<InventoryRequest>
<Credentials><APIKey>${apiKey}</APIKey></Credentials>
<Item>
<PartNumber>${partNumber}</PartNumber>
<VendorName>Hamaton</VendorName>
</Item>
</InventoryRequest>`;
  
  try {
    const res = await fetch("https://api.kmtire.com/v1/inventory", {
      method: "POST",
      headers: {
        "content-type": "application/xml",
        accept: "application/xml, text/xml, */*",
      },
      body: xml,
      cache: "no-store",
    });
    
    if (!res.ok) return [];
    
    const text = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: "__cdata" });
    const data = parser.parse(text) as any;
    const resp = data?.InventoryResponse || data?.inventoryresponse || data;
    const itemsRaw = resp?.Item;
    return Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];
  } catch {
    return [];
  }
}

function pickKmField(it: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = it?.[k];
    if (v == null) continue;
    const cdata = typeof v === "object" && v?.__cdata != null ? v.__cdata : null;
    return cdata != null ? String(cdata) : String(v);
  }
  return null;
}

/**
 * Search actual products (wheels/tires) from cache tables
 * Returns products with their flag status
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";
  const productType = url.searchParams.get("type") || "wheel";
  const supplier = url.searchParams.get("supplier");
  const brand = url.searchParams.get("brand");
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50", 10));

  const pool = getPool();
  
  try {
    // Ensure columns exist
    await pool.query(`
      ALTER TABLE admin_product_flags ADD COLUMN IF NOT EXISTS image_url TEXT
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE admin_product_flags ADD COLUMN IF NOT EXISTS supplier TEXT
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE admin_product_flags ADD COLUMN IF NOT EXISTS brand TEXT
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE admin_product_flags ADD COLUMN IF NOT EXISTS display_name TEXT
    `).catch(() => {});

    // If no/short query, return just the filters (for pre-populating dropdowns)
    if (!query || query.length < 2) {
      if (productType === "wheel") {
        const { rows: brandRows } = await pool.query(`
          SELECT DISTINCT brand FROM wheel_cache WHERE brand IS NOT NULL ORDER BY brand LIMIT 100
        `);
        const { rows: supplierRows } = await pool.query(`
          SELECT DISTINCT supplier FROM wheel_cache WHERE supplier IS NOT NULL ORDER BY supplier
        `);
        return NextResponse.json({ 
          products: [], 
          message: "Enter at least 2 characters to search",
          filters: {
            brands: brandRows.map(r => r.brand),
            suppliers: supplierRows.map(r => r.supplier),
          },
        });
      } else {
        // Tires - get brands from multiple sources:
        // 1. WheelPros DB (wp_tires)
        // 2. Admin flags (admin_product_flags) 
        // 3. Brand cache (tire_brands_cache) - includes K&M
        const [wpBrands, flagBrands, cacheBrands] = await Promise.all([
          pool.query(`
            SELECT DISTINCT brand_desc as brand FROM wp_tires 
            WHERE brand_desc IS NOT NULL 
            ORDER BY brand_desc LIMIT 100
          `),
          pool.query(`
            SELECT DISTINCT brand FROM admin_product_flags 
            WHERE product_type = 'tire' AND brand IS NOT NULL
            ORDER BY brand LIMIT 100
          `),
          pool.query(`
            SELECT DISTINCT brand FROM tire_brands_cache 
            ORDER BY brand LIMIT 100
          `).catch(() => ({ rows: [] })), // Table might not exist yet
        ]);
        
        // Combine and dedupe brands from all sources
        const allBrands = new Set<string>();
        for (const r of wpBrands.rows) {
          if (r.brand) allBrands.add(r.brand);
        }
        for (const r of flagBrands.rows) {
          if (r.brand) allBrands.add(r.brand);
        }
        for (const r of cacheBrands.rows) {
          if (r.brand) allBrands.add(r.brand);
        }
        
        return NextResponse.json({ 
          products: [], 
          message: "Enter at least 2 characters to search",
          filters: {
            brands: Array.from(allBrands).sort(),
            suppliers: ["K&M", "WheelPros"],
          },
        });
      }
    }

    if (productType === "wheel") {
      // Search wheel_cache for wheels
      const { rows } = await pool.query(`
        SELECT 
          wc.sku,
          wc.upc,
          wc.style_description as name,
          wc.brand,
          wc.finish as finish_desc,
          wc.diameter,
          wc.width,
          wc.bolt_pattern,
          wc.offset,
          wc.image_url,
          wc.supplier,
          pf.id as flag_id,
          pf.hidden,
          pf.flagged,
          pf.flag_reason,
          pf.image_url as override_image_url,
          pf.display_name as override_display_name
        FROM wheel_cache wc
        LEFT JOIN admin_product_flags pf ON pf.sku = wc.sku AND pf.product_type = 'wheel'
        WHERE (
          wc.sku ILIKE $1 
          OR wc.upc ILIKE $1
          OR wc.style_description ILIKE $1
          OR wc.brand ILIKE $1
        )
        ${supplier ? `AND wc.supplier = $3` : ""}
        ${brand ? `AND wc.brand ILIKE ${supplier ? "$4" : "$3"}` : ""}
        ORDER BY wc.brand, wc.style_description
        LIMIT $2
      `, supplier && brand 
        ? [`%${query}%`, limit, supplier, `%${brand}%`]
        : supplier 
          ? [`%${query}%`, limit, supplier]
          : brand 
            ? [`%${query}%`, limit, `%${brand}%`]
            : [`%${query}%`, limit]
      );

      // Get distinct brands/suppliers for filters
      const { rows: brandRows } = await pool.query(`
        SELECT DISTINCT brand FROM wheel_cache WHERE brand IS NOT NULL ORDER BY brand LIMIT 100
      `);
      const { rows: supplierRows } = await pool.query(`
        SELECT DISTINCT supplier FROM wheel_cache WHERE supplier IS NOT NULL ORDER BY supplier
      `);

      return NextResponse.json({
        products: rows.map(r => ({
          sku: r.sku,
          upc: r.upc,
          name: r.name,
          displayName: r.override_display_name || null,
          brand: r.brand,
          finish: r.finish_desc,
          size: r.diameter && r.width ? `${r.diameter}x${r.width}` : null,
          boltPattern: r.bolt_pattern,
          offset: r.offset,
          imageUrl: r.override_image_url || r.image_url,
          supplier: r.supplier,
          // Flag status
          flagId: r.flag_id,
          hidden: r.hidden || false,
          flagged: r.flagged || false,
          flagReason: r.flag_reason,
        })),
        filters: {
          brands: brandRows.map(r => r.brand),
          suppliers: supplierRows.map(r => r.supplier),
        },
        total: rows.length,
      });
    } else {
      // Search wp_tires table AND unified tire API (includes K&M with descriptions)
      // WheelPros: search local DB by sku, description, brand
      // K&M/Unified: query tire search API which searches descriptions
      
      const wpQuery = pool.query(`
        SELECT 
          t.sku,
          t.brand_desc as brand,
          t.tire_description as name,
          t.tire_size as size,
          t.image_url,
          t.terrain,
          t.construction_type,
          pf.id as flag_id,
          pf.hidden,
          pf.flagged,
          pf.flag_reason,
          pf.image_url as override_image_url,
          pf.display_name as override_display_name
        FROM wp_tires t
        LEFT JOIN admin_product_flags pf ON pf.sku = t.sku AND pf.product_type = 'tire'
        WHERE (
          t.sku ILIKE $1 
          OR t.tire_description ILIKE $1
          OR t.brand_desc ILIKE $1
        )
        ORDER BY t.brand_desc, t.tire_description
        LIMIT $2
      `, [`%${query}%`, limit]);
      
      // Search unified API for K&M results (query common sizes to find model matches)
      // This catches model names like "LXHT-206" that aren't in our local DB
      const unifiedResults: any[] = [];
      const commonSizes = ["225/65R17", "265/70R17", "275/55R20", "245/45R18", "205/55R16"];
      
      // Only search unified API if query looks like a model name (not a SKU)
      const looksLikeModel = query.length >= 3 && !/^\d+$/.test(query) && !query.match(/^[A-Z]\d{6,}$/i);
      
      if (looksLikeModel) {
        try {
          // Search a couple common sizes to find model matches
          const sizesToSearch = commonSizes.slice(0, 2);
          for (const size of sizesToSearch) {
            const res = await fetch(
              `${getBaseUrl()}/api/tires/search?size=${encodeURIComponent(size)}&minQty=1`,
              { cache: "no-store" }
            );
            if (res.ok) {
              const data = await res.json();
              const results = data.results || [];
              // Filter to matching descriptions
              const matches = results.filter((t: any) => {
                const desc = String(t.description || "").toUpperCase();
                const name = String(t.displayName || t.prettyName || "").toUpperCase();
                const q = query.toUpperCase();
                return desc.includes(q) || name.includes(q);
              });
              unifiedResults.push(...matches);
            }
          }
        } catch (err) {
          console.error("[admin/products/search] Unified search error:", err);
        }
      }
      
      // Also try K&M part number search for SKU-like queries
      const kmItems = await searchKmTiresByPartNumber(query);
      
      const [wpResult] = await Promise.all([wpQuery]);

      const { rows } = wpResult;

      // Get flag status for K&M items
      const kmSkus = kmItems.map((it: any) => it?.PartNumber).filter(Boolean);
      let kmFlags: Record<string, any> = {};
      if (kmSkus.length > 0) {
        const { rows: flagRows } = await pool.query(`
          SELECT sku, id as flag_id, hidden, flagged, flag_reason, image_url as override_image_url, display_name as override_display_name
          FROM admin_product_flags 
          WHERE sku = ANY($1) AND product_type = 'tire'
        `, [kmSkus]);
        for (const f of flagRows) {
          kmFlags[f.sku] = f;
        }
      }

      // Format K&M results
      const kmProducts = kmItems.map((it: any) => {
        const sku = it?.PartNumber || "";
        const flag = kmFlags[sku] || {};
        const brand = pickKmField(it, ["BrandName", "VendorName", "Brand", "Vendor"]);
        const desc = pickKmField(it, ["Description", "Desc"]);
        return {
          sku,
          name: desc || sku,
          displayName: flag.override_display_name || null,
          brand: brand?.trim() || null,
          size: it?.Size || null,
          terrain: null,
          construction: pickKmField(it, ["LoadRange", "Load_Range"]),
          imageUrl: flag.override_image_url || null,
          supplier: "K&M",
          flagId: flag.flag_id || null,
          hidden: flag.hidden || false,
          flagged: flag.flagged || false,
          flagReason: flag.flag_reason || null,
        };
      });

      // Format WheelPros results
      const wpProducts = rows.map(r => ({
        sku: r.sku,
        name: r.name || r.sku,
        displayName: r.override_display_name || null,
        brand: r.brand,
        size: r.size,
        terrain: r.terrain,
        construction: r.construction_type,
        imageUrl: r.override_image_url || r.image_url,
        supplier: "WheelPros",
        flagId: r.flag_id,
        hidden: r.hidden || false,
        flagged: r.flagged || false,
        flagReason: r.flag_reason,
      }));

      // Format unified API results (K&M tires found by model name search)
      // Get flag status for these items
      const unifiedSkus = unifiedResults.map((t: any) => t.partNumber).filter(Boolean);
      let unifiedFlags: Record<string, any> = {};
      if (unifiedSkus.length > 0) {
        const { rows: flagRows } = await pool.query(`
          SELECT sku, id as flag_id, hidden, flagged, flag_reason, image_url as override_image_url, display_name as override_display_name
          FROM admin_product_flags 
          WHERE sku = ANY($1) AND product_type = 'tire'
        `, [unifiedSkus]);
        for (const f of flagRows) {
          unifiedFlags[f.sku] = f;
        }
      }
      
      const unifiedProducts = unifiedResults.map((t: any) => {
        const sku = t.partNumber || "";
        const flag = unifiedFlags[sku] || {};
        return {
          sku,
          name: t.description || t.displayName || sku,
          displayName: flag.override_display_name || t.displayName || t.prettyName || null,
          brand: t.brand || null,
          size: t.size || null,
          terrain: t.badges?.terrain || null,
          construction: t.badges?.construction || null,
          imageUrl: flag.override_image_url || t.imageUrl || null,
          supplier: t.source?.includes("km") ? "K&M" : (t.source?.includes("tirewire") ? "Tirewire" : "WheelPros"),
          flagId: flag.flag_id || null,
          hidden: flag.hidden || false,
          flagged: flag.flagged || false,
          flagReason: flag.flag_reason || null,
        };
      });

      // Combine all results - dedupe by SKU
      const seenSkus = new Set<string>();
      const allProducts: any[] = [];
      
      for (const p of [...unifiedProducts, ...kmProducts, ...wpProducts]) {
        if (p.sku && !seenSkus.has(p.sku)) {
          seenSkus.add(p.sku);
          allProducts.push(p);
        }
        if (allProducts.length >= limit) break;
      }

      // Build brands dynamically from search results + DB
      // This ensures any supplier's brands appear in the filter
      const resultBrands = new Set<string>();
      for (const p of allProducts) {
        if (p.brand) resultBrands.add(p.brand);
      }
      
      // Also get common brands from DB for initial filter options
      const { rows: brandRows } = await pool.query(`
        SELECT DISTINCT brand_desc as brand FROM wp_tires WHERE brand_desc IS NOT NULL ORDER BY brand_desc LIMIT 100
      `);
      for (const r of brandRows) {
        if (r.brand) resultBrands.add(r.brand);
      }

      // Get distinct suppliers from results
      const resultSuppliers = new Set<string>();
      for (const p of allProducts) {
        if (p.supplier) resultSuppliers.add(p.supplier);
      }
      // Always include known suppliers
      resultSuppliers.add("K&M");
      resultSuppliers.add("WheelPros");

      return NextResponse.json({
        products: allProducts,
        filters: { 
          brands: Array.from(resultBrands).sort(),
          suppliers: Array.from(resultSuppliers).sort(),
        },
        total: allProducts.length,
        sources: {
          km: kmProducts.length,
          wheelpros: wpProducts.length,
        },
      });
    }
  } catch (err: any) {
    console.error("[admin/products/search] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
