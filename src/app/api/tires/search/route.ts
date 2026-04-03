/**
 * Unified Tire Search API
 * 
 * Accepts vehicle params (year, make, model, modification) + optional wheelDiameter
 * Returns tires that fit the vehicle.
 * 
 * Sources:
 * - WheelPros local database (wp_tires)
 * - Tirewire (ATD, NTW, US AutoForce) via SOAP API
 * 
 * Flow:
 * 1. If size param provided → direct size search
 * 2. If vehicle params provided:
 *    a. Get tire sizes for vehicle from tire-sizes API
 *    b. Filter to wheelDiameter if provided
 *    c. Search tires matching those sizes from all sources
 */

import { NextResponse } from "next/server";
import pg from "pg";
import { XMLParser } from "fast-xml-parser";
import { searchTiresTirewire, tirewireTireToUnified, type UnifiedTire } from "@/lib/tirewire/client";
import { getClassicFitment } from "@/lib/classic-fitment/classicLookup";
import { getClassicTireSizesForWheelDiameter } from "@/lib/classic-fitment/classicTireUpsize";
import { getCachedTireImagesBatch } from "@/lib/images/tireImageService";
import { expandKmDescription, extractModelName } from "@/lib/km/nameExpander";
import { shouldApplyPackagePriority, applyPackagePriorityToTires } from "@/lib/packagePrioritization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const DATABASE_URL = required("POSTGRES_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function i(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function toSimpleSize(s: string): string {
  // Accept formats like:
  // - 245/50R18 → 2455018
  // - 245/40ZR20 95Y → 2454020
  // - 2455018 → 2455018
  const v = String(s || "").trim().toUpperCase();
  const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const m2 = v.match(/^(\d{7})$/);
  if (m2) return m2[1];
  return "";
}

function normalizeFlotationSize(s: string): string | null {
  // Handle flotation/LT sizes like:
  // - 35/12.50R20 → 35X12.50R20 (normalized)
  // - 35X12.50R20 → 35X12.50R20
  // - 37/12.50R17 → 37X12.50R17
  const v = String(s || "").trim().toUpperCase();
  // Match: 35/12.50R20 or 35X12.50R20 or 35-12.50R20
  const m = v.match(/^(\d{2,3})\s*[\/X\-]\s*(\d{1,2}(?:\.\d+)?)\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) {
    // Return normalized format: 35X12.50R20
    return `${m[1]}X${m[2]}R${m[3]}`;
  }
  return null;
}

function isFlotationSize(s: string): boolean {
  // Flotation sizes start with 2-digit number (overall diameter) not 3-digit (width)
  const v = String(s || "").trim();
  return /^\d{2}[\/X\-]/.test(v);
}

function extractRimDiameter(size: string): number | null {
  // Extract rim diameter from tire size
  // 245/50R18 → 18
  // 2455018 → 18
  const simple = toSimpleSize(size);
  if (simple && simple.length === 7) {
    return parseInt(simple.slice(5), 10);
  }
  const m = size.match(/R(\d{2})/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

interface TireResult {
  partNumber: string;
  mfgPartNumber: string;
  brand: string | null;
  model?: string | null;
  description: string;
  cost: number | null;
  price?: number | null;
  quantity: { primary: number; alternate: number; national: number };
  imageUrl: string | null;
  size: string;
  simpleSize: string;
  rimDiameter: number | null;
  tireLibraryId?: number | null;
  source?: string; // "wheelpros", "tirewire:atd", "tirewire:ntw", etc.
  badges: {
    terrain: string | null;
    construction: string | null;
    warrantyMiles: number | null;
    loadIndex: string | null;
    speedRating: string | null;
    utqg?: string | null;
  };
}

async function searchTiresBySize(
  db: pg.Pool,
  size: string,
  minQty: number,
  limit: number
): Promise<TireResult[]> {
  const simple = toSimpleSize(size) || size;
  const flotation = normalizeFlotationSize(size);
  const isFlotation = isFlotationSize(size);
  
  // For flotation sizes (35/12.50R20), search with multiple patterns
  // Database may store as: 35X12.50R20, 35/12.50R20, LT35X12.50R20, etc.
  let flotationPatterns: string[] = [];
  if (isFlotation && flotation) {
    const m = size.match(/^(\d{2,3})\s*[\/X\-]\s*(\d{1,2}(?:\.\d+)?)\s*[A-Z]*\s*R?\s*(\d{2})/i);
    if (m) {
      // Create multiple search patterns
      flotationPatterns = [
        `%${m[1]}X${m[2]}%R${m[3]}%`,  // 35X12.50R20
        `%${m[1]}/${m[2]}%R${m[3]}%`,  // 35/12.50R20
        `%${m[1]}X${m[2].replace('.', '')}%R${m[3]}%`,  // 35X1250R20 (no decimal)
      ];
    }
  }
  
  const { rows } = await db.query({
    text: `
      select
        t.sku,
        t.brand_desc,
        t.tire_description,
        t.tire_size,
        t.simple_size,
        t.terrain,
        t.construction_type,
        t.mileage_warranty,
        t.load_index,
        t.speed_rating,
        t.image_url,
        t.map_usd,
        t.msrp_usd,
        coalesce(i.qoh, 0) as qoh
      from wp_tires t
      left join wp_inventory i
        on i.sku = t.sku
       and i.product_type = 'tire'
       and i.location_id = 'TOTAL'
      where (
        t.simple_size = $1 
        or t.tire_size ilike $2
        or ($5::boolean and (t.tire_size ilike any($6::text[])))
      )
        and ($3::int is null or coalesce(i.qoh, 0) >= $3::int)
      order by coalesce(i.qoh, 0) desc, t.brand_desc asc, t.sku asc
      limit $4
    `,
    values: [simple, `%${simple}%`, minQty || null, limit, isFlotation, flotationPatterns.length > 0 ? flotationPatterns : ['__NOMATCH__']],
  });

  return rows.map((r) => {
    const mapUsd0 = n(r.map_usd);
    const msrpUsd0 = n(r.msrp_usd);
    const mapUsd = mapUsd0 != null && mapUsd0 > 0.01 ? mapUsd0 : null;
    const msrpUsd = msrpUsd0 != null && msrpUsd0 > 0.01 ? msrpUsd0 : null;
    const cost = mapUsd != null ? Math.max(0.01, mapUsd - 50) : msrpUsd;
    const tireSize = r.tire_size || r.simple_size || "";

    return {
      partNumber: String(r.sku),
      mfgPartNumber: String(r.sku),
      brand: r.brand_desc || null,
      description: r.tire_description || tireSize || r.sku,
      cost: cost != null && Number.isFinite(cost) ? cost : null,
      quantity: { primary: 0, alternate: 0, national: i(r.qoh) },
      imageUrl: r.image_url || null,
      size: tireSize,
      simpleSize: r.simple_size || toSimpleSize(tireSize),
      rimDiameter: extractRimDiameter(tireSize),
      source: "wheelpros",
      badges: {
        terrain: r.terrain || null,
        construction: r.construction_type || null,
        warrantyMiles: r.mileage_warranty != null ? i(r.mileage_warranty) : null,
        loadIndex: r.load_index || null,
        speedRating: r.speed_rating || null,
      },
    };
  });
}

/**
 * Search Tirewire suppliers and convert to TireResult format
 */
async function searchTiresTirewireFormatted(size: string): Promise<TireResult[]> {
  try {
    console.log("[tires/search] Calling Tirewire for size:", size);
    const results = await searchTiresTirewire(size);
    console.log("[tires/search] Tirewire returned:", results.length, "connections, tires:", results.reduce((sum, r) => sum + r.tires.length, 0));
    const tires: TireResult[] = [];
    
    for (const result of results) {
      for (const tire of result.tires) {
        const unified = tirewireTireToUnified(tire, result.provider);
        tires.push({
          partNumber: unified.partNumber,
          mfgPartNumber: unified.mfgPartNumber,
          brand: unified.brand,
          model: unified.model,
          description: unified.description,
          cost: unified.cost,
          price: unified.price,
          quantity: unified.quantity,
          imageUrl: unified.imageUrl,
          size: unified.size,
          simpleSize: unified.simpleSize,
          rimDiameter: unified.rimDiameter,
          tireLibraryId: unified.tireLibraryId,
          source: unified.source,
          badges: {
            terrain: unified.badges.terrain,
            construction: unified.badges.construction,
            warrantyMiles: unified.badges.warrantyMiles,
            loadIndex: unified.badges.loadIndex,
            speedRating: unified.badges.speedRating,
            utqg: unified.badges.utqg,
          },
        });
      }
    }
    
    return tires;
  } catch (err) {
    console.error("[tires/search] Tirewire error:", err);
    return [];
  }
}

/**
 * Look up K&M tire images from km_image_mappings table
 */
async function getKmImagesFromDb(partNumbers: string[]): Promise<Map<string, string>> {
  if (partNumbers.length === 0) return new Map();
  
  try {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT part_number, image_url 
      FROM km_image_mappings 
      WHERE part_number = ANY($1) AND image_url IS NOT NULL
    `, [partNumbers]);
    
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.part_number, row.image_url);
    }
    return map;
  } catch (err) {
    console.error("[tires/search] K&M image lookup error:", err);
    return new Map();
  }
}

/**
 * Look up tire images by brand + model pattern from tire_model_images table
 * This enables image sharing across all sizes of the same tire model
 */
async function getModelImagesFromDb(): Promise<Map<string, string>> {
  try {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT LOWER(brand) as brand, LOWER(model_pattern) as pattern, image_url 
      FROM tire_model_images 
      WHERE image_url IS NOT NULL
    `);
    
    const map = new Map<string, string>();
    for (const row of rows) {
      // Key: "brand:pattern" (lowercase for case-insensitive matching)
      map.set(`${row.brand}:${row.pattern}`, row.image_url);
    }
    return map;
  } catch (err) {
    console.error("[tires/search] Model image lookup error:", err);
    return new Map();
  }
}

/**
 * Find image URL for a tire by matching brand + model pattern
 */
function findModelImage(
  brand: string | null | undefined,
  model: string | null | undefined,
  description: string | null | undefined,
  modelImages: Map<string, string>
): string | null {
  if (!brand || modelImages.size === 0) return null;
  
  const brandLower = brand.toLowerCase();
  const modelText = (model || description || "").toLowerCase();
  
  // Try each pattern from our mapping
  for (const [key, imageUrl] of modelImages) {
    const [mapBrand, mapPattern] = key.split(":");
    
    // Brand must match
    if (mapBrand !== brandLower) continue;
    
    // Check if model text contains the pattern
    if (modelText.includes(mapPattern)) {
      return imageUrl;
    }
  }
  
  return null;
}

/**
 * Search K&M/Keystone tires by size and convert to TireResult format
 */
async function searchTiresKM(size: string): Promise<TireResult[]> {
  const apiKey = (
    process.env.KM_API_KEY ||
    process.env.KMTIRE_API_KEY ||
    process.env.KM_TIRE_API_KEY ||
    ""
  ).trim();
  
  console.log("[tires/search] KM API key check:", apiKey ? `present (${apiKey.slice(0,4)}...)` : "MISSING");
  
  if (!apiKey) {
    console.warn("[tires/search] No K&M API key configured");
    return [];
  }
  
  // Convert size to K&M format (7-8 digit compact)
  const tireSize = toKmSizeFormat(size);
  console.log("[tires/search] KM size conversion:", size, "→", tireSize || "(failed)");
  if (!tireSize) {
    console.warn("[tires/search] Could not convert size for K&M:", size);
    return [];
  }
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<InventoryRequest>` +
    `<Credentials><APIKey>${apiKey}</APIKey></Credentials>` +
    `<Item>` +
    `<TireSize>${tireSize}</TireSize>` +
    `</Item>` +
    `</InventoryRequest>`;
  
  try {
    const res = await fetch("https://api.kmtire.com/v1/tiresizesearch", {
      method: "POST",
      headers: {
        "content-type": "application/xml",
        accept: "application/xml, text/xml, */*",
      },
      body: xml,
      cache: "no-store",
    });
    
    if (!res.ok) {
      console.error("[tires/search] K&M API error:", res.status);
      return [];
    }
    
    const text = await res.text();
    console.log("[tires/search] KM response length:", text.length, "first 200 chars:", text.slice(0, 200));
    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: "__cdata",
    });
    
    const data = parser.parse(text) as any;
    const resp = data?.InventoryResponse || data?.inventoryresponse || data;
    const itemsRaw = resp?.Item;
    const items = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];
    console.log("[tires/search] KM parsed items:", items.length);
    
    return items.map((it: any) => {
      const qty = it?.Quantity || {};
      const brand = pickKmField(it, ["BrandName", "VendorName", "Brand", "Vendor"]);
      const desc = pickKmField(it, ["Description", "Desc"]);
      const kmSize = it?.Size || tireSize;
      const speedRating = pickKmField(it, ["SpeedRating", "Speed_Rating", "Speed"]);
      const loadRange = pickKmField(it, ["LoadRange", "Load_Range", "LoadRangeCode"]);
      const utqgTreadwear = pickKmField(it, ["UTQGTreadwear", "UTQG_Treadwear", "Treadwear"]);
      const utqgTraction = pickKmField(it, ["UTQGTraction", "UTQG_Traction", "Traction"]);
      const utqgTemperature = pickKmField(it, ["UTQGTemperature", "UTQG_Temperature", "Temperature"]);
      
      // Build UTQG string if components exist
      let utqg: string | null = null;
      if (utqgTreadwear || utqgTraction || utqgTemperature) {
        utqg = [utqgTreadwear, utqgTraction, utqgTemperature].filter(Boolean).join(" ");
      }
      
      // Extract rim diameter from size
      const simpleSize = toSimpleSize(kmSize) || tireSize;
      const rimDiameter = simpleSize.length >= 7 ? parseInt(simpleSize.slice(5), 10) : null;
      
      // Reconstruct display size from simple format
      let displaySize = kmSize;
      if (simpleSize && simpleSize.length === 7) {
        const w = simpleSize.slice(0, 3);
        const a = simpleSize.slice(3, 5);
        const r = simpleSize.slice(5);
        displaySize = `${w}/${a}R${r}`;
      }
      
      const cost = it?.Cost != null ? Number(it.Cost) : null;
      const qtyPrimary = qty?.Primary != null ? Number(qty.Primary) : 0;
      const qtyAlternate = qty?.Alternate != null ? Number(qty.Alternate) : 0;
      const qtyNational = qty?.National != null ? Number(qty.National) : 0;
      
      // Clean up K&M description - expand abbreviations and format nicely
      const brandStr = brand ? String(brand).trim() : null;
      const rawDesc = desc ? String(desc).trim() : displaySize;
      const cleanDescription = expandKmDescription(rawDesc, brandStr);
      const modelName = extractModelName(rawDesc);
      
      return {
        partNumber: String(it?.PartNumber || ""),
        mfgPartNumber: String(it?.MfgPartNumber || it?.PartNumber || ""),
        brand: brandStr,
        model: modelName,
        description: cleanDescription,
        cost: cost != null && Number.isFinite(cost) ? cost : null,
        quantity: {
          primary: qtyPrimary,
          alternate: qtyAlternate,
          national: qtyPrimary + qtyAlternate + qtyNational,
        },
        imageUrl: null, // K&M doesn't return images in size search
        size: displaySize,
        simpleSize,
        rimDiameter,
        source: "km",
        badges: {
          terrain: null,
          construction: loadRange || null,
          warrantyMiles: null,
          loadIndex: null,
          speedRating: speedRating ? String(speedRating).trim() : null,
          utqg,
        },
      } as TireResult;
    });
  } catch (err) {
    console.error("[tires/search] K&M error:", err);
    return [];
  }
}

function pickKmField(it: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = it?.[k];
    if (v == null) continue;
    const cdata = typeof v === "object" && v?.__cdata != null ? v.__cdata : null;
    const result = cdata != null ? cdata : v;
    if (result != null) return String(result);
  }
  return null;
}

function toKmSizeFormat(size: string): string {
  // Accept formats like:
  // - 245/50R18 → 2455018
  // - 245/40ZR20 95Y → 2454020
  // - 37x13.50R22 → 37135022 (flotation)
  const s = String(size || "").trim().toUpperCase();
  
  // Flotation string -> rawSize digits: 37x13.50R22 -> 37135022
  const f = s.match(/^(\d{2})\s*[X]\s*(\d{1,2}\.\d{2})\s*R\s*(\d{2}(?:\.5)?)\s*(?:LT)?$/i);
  if (f) {
    const dia = f[1];
    const width = f[2].replace(".", "");
    const rim = f[3].replace(".", "");
    return `${dia}${width}${rim}`;
  }
  
  // Standard metric: 245/50R18 -> 2455018
  const m = s.match(/(\d{3})\s*\/?\s*(\d{2})\s*[A-Z]*\s*R\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  
  // Already in compact format
  const m2 = s.match(/^\d{7}$/);
  if (m2) return s;
  
  const m3 = s.match(/^\d{8}$/);
  if (m3) return s;
  
  return "";
}

/**
 * Build a lookup map of brand+pattern → imageUrl from Tirewire results
 * Used to enrich K&M results with TireLibrary images
 */
function buildPatternImageLookup(twResults: TireResult[]): Map<string, string> {
  const lookup = new Map<string, string>();
  
  for (const tire of twResults) {
    if (!tire.imageUrl || !tire.brand) continue;
    
    // Key: normalized "BRAND:PATTERN" (e.g., "MICHELIN:DEFENDER 2")
    const model = (tire.model || tire.description || "").trim();
    if (!model) continue;
    
    const key = `${tire.brand.toUpperCase()}:${model.toUpperCase()}`;
    if (!lookup.has(key)) {
      lookup.set(key, tire.imageUrl);
    }
    
    // Also add partial matches (first word of pattern)
    // e.g., "MICHELIN:DEFENDER" for "DEFENDER 2", "DEFENDER T+H", etc.
    const firstWord = model.split(/\s+/)[0];
    if (firstWord && firstWord.length > 3) {
      const partialKey = `${tire.brand.toUpperCase()}:${firstWord.toUpperCase()}`;
      if (!lookup.has(partialKey)) {
        lookup.set(partialKey, tire.imageUrl);
      }
    }
  }
  
  return lookup;
}

/**
 * Enrich K&M results with TireLibrary images by matching brand+pattern
 */
function enrichKmWithTireLibraryImages(
  kmResults: TireResult[],
  imageLookup: Map<string, string>
): TireResult[] {
  return kmResults.map((tire) => {
    // Already has an image
    if (tire.imageUrl) return tire;
    
    if (!tire.brand) return tire;
    
    // Try exact match first
    const model = (tire.model || "").trim();
    const desc = (tire.description || "").trim();
    
    // Extract pattern name from description (e.g., "LX 225/65R17/SL LXHT-206 102T" → "LXHT-206")
    let patternName = model;
    if (!patternName && desc) {
      // Try to extract pattern from description
      const parts = desc.split(/\s+/);
      // Look for pattern-like strings (alphanumeric, possibly with hyphens)
      for (const part of parts) {
        if (/^[A-Z]{2,}[-]?\d*[A-Z]*$/i.test(part) && part.length > 3) {
          patternName = part;
          break;
        }
      }
    }
    
    if (patternName) {
      // Try exact match
      const exactKey = `${tire.brand.toUpperCase()}:${patternName.toUpperCase()}`;
      if (imageLookup.has(exactKey)) {
        return { ...tire, imageUrl: imageLookup.get(exactKey)! };
      }
      
      // Try partial match (first word)
      const firstWord = patternName.split(/[-\s]/)[0];
      if (firstWord && firstWord.length > 2) {
        const partialKey = `${tire.brand.toUpperCase()}:${firstWord.toUpperCase()}`;
        if (imageLookup.has(partialKey)) {
          return { ...tire, imageUrl: imageLookup.get(partialKey)! };
        }
      }
    }
    
    // Try brand-only fallback (use any image from that brand)
    // This gives at least a branded image
    for (const [key, url] of imageLookup) {
      if (key.startsWith(`${tire.brand.toUpperCase()}:`)) {
        return { ...tire, imageUrl: url };
      }
    }
    
    return tire;
  });
}

/**
 * Merge results from WheelPros, Tirewire, and K&M, deduplicating by product code.
 * Tirewire results are preferred when duplicates exist (better images).
 */
async function mergeTireResults(
  wpResults: TireResult[],
  twResults: TireResult[],
  kmResults: TireResult[],
  minQty: number
): Promise<TireResult[]> {
  const merged = new Map<string, TireResult>();
  
  // First, look up K&M images from our database (by part number)
  const kmPartNumbers = kmResults.map(t => t.partNumber).filter(Boolean);
  const kmDbImages = await getKmImagesFromDb(kmPartNumbers);
  
  // Also load model-based image mappings (brand+model → image)
  const modelImages = await getModelImagesFromDb();
  
  // Apply database images to K&M results (try part number first, then model-based)
  const kmWithDbImages = kmResults.map(tire => {
    if (tire.imageUrl) return tire; // Already has an image
    
    // Try exact part number match first
    const dbImage = kmDbImages.get(tire.partNumber);
    if (dbImage) {
      return { ...tire, imageUrl: dbImage };
    }
    
    // Try model-based match (same image for all sizes of a model)
    const modelImage = findModelImage(tire.brand, tire.model, tire.description, modelImages);
    if (modelImage) {
      return { ...tire, imageUrl: modelImage };
    }
    
    return tire;
  });
  
  // Build image lookup from Tirewire results for remaining K&M enrichment
  const imageLookup = buildPatternImageLookup(twResults);
  
  // Enrich remaining K&M results (without images) with TireLibrary images
  const enrichedKmResults = enrichKmWithTireLibraryImages(kmWithDbImages, imageLookup);
  
  // Helper to add/merge a tire, keeping lowest price
  const addTire = (tire: TireResult) => {
    const key = normalizeProductKey(tire.mfgPartNumber, tire.brand);
    const totalQty = tire.quantity.primary + tire.quantity.alternate + tire.quantity.national;
    
    // Skip if below minimum quantity
    if (minQty > 0 && totalQty < minQty) return;
    
    if (!merged.has(key)) {
      merged.set(key, { ...tire });
    } else {
      const existing = merged.get(key)!;
      
      // Aggregate quantities from different sources
      if (existing.source !== tire.source) {
        existing.quantity.national += tire.quantity.national;
      }
      
      // Keep the LOWEST PRICE (if the new one has a valid lower price)
      const existingPrice = existing.cost ?? existing.price ?? Infinity;
      const newPrice = tire.cost ?? tire.price ?? Infinity;
      
      if (newPrice < existingPrice && newPrice > 0) {
        // New source has lower price - update price but keep best image
        existing.cost = tire.cost;
        existing.price = tire.price;
        // Keep TireLibrary image if existing has one
        if (!existing.imageUrl?.includes('tirelibrary') && tire.imageUrl) {
          existing.imageUrl = tire.imageUrl;
        }
      }
    }
  };
  
  // Add all results - Tirewire first (best images), then K&M, then WheelPros
  for (const tire of twResults) addTire(tire);
  for (const tire of enrichedKmResults) addTire(tire);
  for (const tire of wpResults) addTire(tire);
  
  // Sort by PRICE ascending (lowest first), then by brand
  return Array.from(merged.values()).sort((a, b) => {
    const priceA = a.cost ?? a.price ?? Infinity;
    const priceB = b.cost ?? b.price ?? Infinity;
    if (priceA !== priceB) return priceA - priceB;  // Lowest price first
    return (a.brand || "").localeCompare(b.brand || "");
  });
}

function normalizeProductKey(partNumber: string, brand: string | null): string {
  // Normalize part numbers for comparison
  // Remove common prefixes/suffixes and normalize case
  const normalized = String(partNumber || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return `${(brand || "").toUpperCase()}:${normalized}`;
}

/**
 * Replace TireLibrary URLs with cached Vercel Blob URLs where available
 */
async function applyCachedImages(results: TireResult[]): Promise<TireResult[]> {
  // Extract patternIds from TireLibrary URLs
  const patternIdMap = new Map<number, number[]>(); // patternId -> indices in results
  
  for (let i = 0; i < results.length; i++) {
    const tire = results[i];
    if (!tire.imageUrl) continue;
    
    // Check if it's a TireLibrary URL
    const match = tire.imageUrl.match(/tirelibrary\.com\/images\/Products\/(\d+)\./i);
    if (match) {
      const patternId = parseInt(match[1], 10);
      if (!patternIdMap.has(patternId)) {
        patternIdMap.set(patternId, []);
      }
      patternIdMap.get(patternId)!.push(i);
    }
  }
  
  if (patternIdMap.size === 0) return results;
  
  try {
    // Batch lookup cached URLs
    const cachedUrls = await getCachedTireImagesBatch(Array.from(patternIdMap.keys()));
    
    // Replace URLs where we have cached versions
    const updated = [...results];
    for (const [patternId, indices] of patternIdMap) {
      const cachedUrl = cachedUrls.get(patternId);
      if (cachedUrl && !cachedUrl.includes("tirelibrary.com")) {
        // We have a locally cached version
        for (const idx of indices) {
          updated[idx] = { ...updated[idx], imageUrl: cachedUrl };
        }
      }
    }
    
    return updated;
  } catch (err) {
    console.error("[tires/search] Cached image lookup failed:", err);
    return results; // Return original results on error
  }
}

// ============================================================================
// IMAGE VALIDATION
// ============================================================================

/**
 * Check if an image URL is valid and not a placeholder/noimage
 * Feature flag: set TIRE_ALLOW_NO_IMAGE=true to disable filtering (for testing)
 */
function isValidProductImage(imageUrl: string | null | undefined): boolean {
  // TEMPORARY: Disable image filtering until we have better image coverage
  // Feature flag: set TIRE_ALLOW_NO_IMAGE=false to re-enable filtering
  if (process.env.TIRE_ALLOW_NO_IMAGE !== "false") {
    return true;
  }
  
  // Must have a URL
  if (!imageUrl || typeof imageUrl !== "string") return false;
  
  // Must not be empty/whitespace
  const url = imageUrl.trim().toLowerCase();
  if (!url || url.length < 10) return false;
  
  // Must start with http/https
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  
  // Block known placeholder/noimage patterns
  const invalidPatterns = [
    "noimage",
    "no-image",
    "no_image",
    "placeholder",
    "default",
    "missing",
    "notfound",
    "not-found",
    "not_found",
    "unavailable",
    "blank",
    "empty",
    "/null",
    "/undefined",
    "data:image",  // Block inline data URIs (usually placeholders)
  ];
  
  for (const pattern of invalidPatterns) {
    if (url.includes(pattern)) return false;
  }
  
  return true;
}

/**
 * Filter tire results to only include products with valid images
 * Returns { filtered, stats } with filtered results and filtering statistics
 */
function filterTiresWithValidImages(
  tires: TireResult[],
  debug: boolean = false
): { filtered: TireResult[]; stats: { total: number; valid: number; invalid: number; invalidReasons: Record<string, number> } } {
  const stats = {
    total: tires.length,
    valid: 0,
    invalid: 0,
    invalidReasons: {} as Record<string, number>,
  };
  
  const filtered: TireResult[] = [];
  
  for (const tire of tires) {
    if (isValidProductImage(tire.imageUrl)) {
      filtered.push(tire);
      stats.valid++;
    } else {
      stats.invalid++;
      // Track reason for filtering (for debug)
      let reason = "missing";
      if (tire.imageUrl) {
        const url = tire.imageUrl.toLowerCase();
        if (url.includes("noimage") || url.includes("no-image") || url.includes("no_image")) reason = "noimage";
        else if (url.includes("placeholder")) reason = "placeholder";
        else if (url.includes("default")) reason = "default";
        else if (!url.startsWith("http")) reason = "invalid_url";
        else reason = "other";
      }
      stats.invalidReasons[reason] = (stats.invalidReasons[reason] || 0) + 1;
      
      if (debug) {
        console.log(`[tires/search] Filtered out (${reason}): ${tire.partNumber} - ${tire.brand} - imageUrl: ${tire.imageUrl?.slice(0, 50) || "null"}`);
      }
    }
  }
  
  return { filtered, stats };
}

/**
 * Apply overrides from admin_product_flags table
 * This allows admins to set custom images and display names for products
 */
async function applyAdminOverrides(db: pg.Pool, results: TireResult[]): Promise<TireResult[]> {
  if (results.length === 0) return results;
  
  const skus = results.map(r => r.partNumber).filter(Boolean);
  if (skus.length === 0) return results;
  
  try {
    const { rows } = await db.query(`
      SELECT sku, image_url 
      FROM admin_product_flags 
      WHERE sku = ANY($1) 
        AND product_type = 'tire' 
        AND image_url IS NOT NULL AND image_url != ''
    `, [skus]);
    
    if (rows.length === 0) return results;
    
    const overrides = new Map<string, string>();
    for (const row of rows) {
      if (row.image_url) {
        overrides.set(row.sku, row.image_url);
      }
    }
    
    // Apply image overrides
    return results.map(tire => {
      const imageUrl = overrides.get(tire.partNumber);
      if (imageUrl) {
        return { ...tire, imageUrl };
      }
      return tire;
    });
  } catch (err) {
    console.error("[tires/search] Admin override lookup error:", err);
    return results; // Return original results on error
  }
}

// Alias for backward compatibility
const applyImageOverrides = applyAdminOverrides;

export async function GET(req: Request) {
  const t0 = Date.now();
  const timing: Record<string, number> = {};
  
  try {
    const url = new URL(req.url);
    
    // Direct size search
    const sizeRaw = (url.searchParams.get("size") || url.searchParams.get("tireSize") || "").trim();
    
    // Vehicle params
    const year = url.searchParams.get("year");
    const make = url.searchParams.get("make");
    const model = url.searchParams.get("model");
    const modification = url.searchParams.get("modification") || url.searchParams.get("trim");
    const wheelDiameter = i(url.searchParams.get("wheelDiameter"));
    
    // Pagination
    const minQty = i(url.searchParams.get("minQty"));
    const pageSize = Math.min(Math.max(i(url.searchParams.get("pageSize") || url.searchParams.get("limit")) || 50, 1), 200);

    const tDb0 = Date.now();
    const db = getPool();
    timing.dbPoolMs = Date.now() - tDb0;
    
    // Case 1: Direct size search
    if (sizeRaw) {
      const tSearch0 = Date.now();
      // Query all sources in parallel
      // NOTE: KM disabled for testing (invalid API key)
      const [wpResults, twResults, kmResults] = await Promise.all([
        searchTiresBySize(db, sizeRaw, minQty, pageSize),
        searchTiresTirewireFormatted(sizeRaw),
        Promise.resolve([]), // searchTiresKM(sizeRaw) - disabled
      ]);
      timing.searchMs = Date.now() - tSearch0;
      
      // Merge and dedupe by partNumber (prefer Tirewire for images)
      const tMerge0 = Date.now();
      const merged = await mergeTireResults(wpResults, twResults, kmResults, minQty);
      timing.mergeMs = Date.now() - tMerge0;
      
      // Apply cached TireLibrary images (from Vercel Blob)
      const tCache0 = Date.now();
      const withCachedImages = await applyCachedImages(merged.slice(0, pageSize * 2));
      timing.cachedImagesMs = Date.now() - tCache0;
      
      // Apply admin image overrides (for K&M tires without images, etc.)
      const tOverride0 = Date.now();
      const resultsWithOverrides = await applyImageOverrides(db, withCachedImages); // Fetch extra to account for filtering
      timing.imageOverrideMs = Date.now() - tOverride0;
      
      // Filter out tires without valid images
      const debug = url.searchParams.get("debug") === "true";
      let { filtered: finalResults, stats: imageStats } = filterTiresWithValidImages(resultsWithOverrides, debug);
      
      if (imageStats.invalid > 0) {
        console.log(`[tires/search] Image filter: ${imageStats.valid}/${imageStats.total} valid, filtered ${imageStats.invalid} (${JSON.stringify(imageStats.invalidReasons)})`);
      }
      
      // Package priority sorting (size mode)
      const packageParam = url.searchParams.get("package");
      const buildTypeParam = url.searchParams.get("buildType");
      const searchTypeParam = url.searchParams.get("searchType");
      
      const applyPkgPriority = shouldApplyPackagePriority({
        searchType: searchTypeParam || undefined,
        buildType: buildTypeParam || undefined,
        package: packageParam || undefined,
      });
      
      let packagePriorityApplied = false;
      if (applyPkgPriority && finalResults.length > 0) {
        finalResults = applyPackagePriorityToTires(finalResults);
        packagePriorityApplied = true;
      }
      
      timing.totalMs = Date.now() - t0;
      
      return NextResponse.json({
        results: finalResults.slice(0, pageSize),
        mode: "size",
        size: sizeRaw,
        sources: {
          wheelpros: wpResults.length,
          tirewire: twResults.length,
          km: kmResults.length,
        },
        imageFiltering: {
          totalBeforeFilter: imageStats.total,
          validImages: imageStats.valid,
          filteredOut: imageStats.invalid,
          ...(debug && { reasons: imageStats.invalidReasons }),
        },
        packagePriorityApplied,
        timing,
      });
    }
    
    // Case 2: Vehicle-based search
    if (!year || !make || !model) {
      return NextResponse.json({
        results: [],
        error: "Vehicle params (year, make, model) or size required",
      });
    }
    
    // Get tire sizes from vehicles/tire-sizes API
    const tFitment0 = Date.now();
    let tireSizes: string[] = [];           // Original OEM sizes (for display)
    let searchableSizes: string[] = [];     // Modern sizes (for search)
    let sizeConversions: any[] = [];        // Conversion details
    let hasLegacySizes = false;
    let fitmentSource = "api";
    
    try {
      const tireSizesUrl = new URL(`${url.origin}/api/vehicles/tire-sizes`);
      tireSizesUrl.searchParams.set("year", year);
      tireSizesUrl.searchParams.set("make", make);
      tireSizesUrl.searchParams.set("model", model);
      if (modification) tireSizesUrl.searchParams.set("modification", modification);
      
      const tsRes = await fetch(tireSizesUrl.toString());
      if (tsRes.ok) {
        const tsData = await tsRes.json();
        
        // Get original OEM sizes (may include legacy formats like E70-14)
        tireSizes = (tsData.tireSizes || tsData.sizes || tsData.results || []).map((s: any) => 
          typeof s === "string" ? s : s.size || s.front || ""
        ).filter(Boolean);
        
        // Get searchable sizes (modern P-metric equivalents)
        // The tire-sizes API now returns searchableSizes for legacy tire conversion
        searchableSizes = tsData.searchableSizes || tireSizes;
        sizeConversions = tsData.sizeConversions || [];
        hasLegacySizes = tsData.hasLegacySizes || false;
        
        if (hasLegacySizes) {
          console.log(`[tires/search] Legacy tire sizes detected for ${year} ${make} ${model}`);
          console.log(`  Original: ${tireSizes.join(", ")}`);
          console.log(`  Search:   ${searchableSizes.join(", ")}`);
        }
      }
    } catch (err) {
      console.error("[tires/search] Tire sizes error:", err);
    }
    timing.fitmentMs = Date.now() - tFitment0;
    
    // Track original OEM sizes for response
    const oemTireSizes = [...tireSizes];
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CLASSIC VEHICLE UPSIZE LOGIC
    // For classic vehicles, use the upsize engine to get proper tire sizes
    // when the wheel diameter differs from stock
    // ═══════════════════════════════════════════════════════════════════════════
    let isClassicVehicle = false;
    let classicUpsizeSizes: string[] = [];
    let classicStockTire: string | null = null;
    
    if (wheelDiameter && year && make && model) {
      try {
        const classicData = await getClassicFitment(
          parseInt(year, 10),
          make,
          model
        );
        
        if (classicData && classicData.isClassicVehicle) {
          isClassicVehicle = true;
          classicStockTire = classicData.stockReference?.tireSize || null;
          
          if (classicStockTire) {
            // Get upsize tire sizes for the selected wheel diameter
            classicUpsizeSizes = getClassicTireSizesForWheelDiameter(
              classicStockTire,
              wheelDiameter,
              5 // Get top 5 size options
            );
            
            if (classicUpsizeSizes.length > 0) {
              console.log(`[tires/search] CLASSIC UPSIZE: ${year} ${make} ${model}`);
              console.log(`  Stock tire: ${classicStockTire}`);
              console.log(`  Wheel: ${wheelDiameter}"`);
              console.log(`  Upsize sizes: ${classicUpsizeSizes.join(", ")}`);
            }
          }
        }
      } catch (err) {
        console.warn("[tires/search] Classic fitment check failed:", err);
      }
    }
    
    // Filter by wheel diameter if specified
    // Use searchableSizes (modern P-metric) for actual searching
    let matchMode: "exact" | "oem-fallback" | "direct-search" | "classic-upsize" = "exact";
    let sizesToSearch = searchableSizes.length > 0 ? searchableSizes : tireSizes;
    
    if (wheelDiameter) {
      // First check: do we have OEM sizes matching this diameter?
      const filtered = sizesToSearch.filter((size) => {
        const rim = extractRimDiameter(size);
        return rim === wheelDiameter;
      });
      
      if (filtered.length > 0) {
        // OEM sizes match the wheel diameter
        sizesToSearch = filtered;
        matchMode = "exact";
      } else if (isClassicVehicle && classicUpsizeSizes.length > 0) {
        // CLASSIC VEHICLE: Use upsize engine sizes
        // This handles both:
        // 1. OEM sizes exist but don't match wheel diameter
        // 2. No OEM sizes at all (classic vehicle with no tire data in DB)
        sizesToSearch = classicUpsizeSizes;
        matchMode = "classic-upsize";
        console.log(`[tires/search] Using classic upsize sizes for ${wheelDiameter}" wheels`);
      } else if (sizesToSearch.length > 0) {
        // No OEM tires match the wheel diameter - this is a plus/minus sizing scenario
        // Search directly for tires of the specified diameter
        sizesToSearch = [];
        matchMode = "direct-search";
        console.log(`[tires/search] No OEM tires for ${wheelDiameter}" wheel, using direct search`);
      } else {
        // No OEM sizes at all and not classic - direct search
        sizesToSearch = [];
        matchMode = "direct-search";
        console.log(`[tires/search] No tire sizes for vehicle, using direct search for ${wheelDiameter}" wheel`);
      }
    }
    
    // Build results from all sources
    const tSearch0 = Date.now();
    let wpResults: TireResult[] = [];
    let twResults: TireResult[] = [];
    let kmResults: TireResult[] = [];
    
    if (sizesToSearch.length > 0) {
      // Search using modern P-metric sizes (converted from legacy if needed)
      const searchPromises: Promise<void>[] = [];
      
      // Calculate limit per size - use sizesToSearch.length to avoid Infinity when tireSizes is empty
      const searchCount = Math.min(sizesToSearch.length, 5);
      const limitPerSize = Math.ceil(pageSize / searchCount) || pageSize;
      
      for (const size of sizesToSearch.slice(0, 5)) {
        // WheelPros
        searchPromises.push(
          searchTiresBySize(db, size, minQty, limitPerSize)
            .then((results) => { wpResults.push(...results); })
        );
        // Tirewire
        searchPromises.push(
          searchTiresTirewireFormatted(size)
            .then((results) => { twResults.push(...results); })
        );
        // K&M/Keystone
        searchPromises.push(
          searchTiresKM(size)
            .then((results) => { kmResults.push(...results); })
        );
      }
      
      await Promise.all(searchPromises);
    } else if (wheelDiameter && matchMode === "direct-search" && sizesToSearch.length === 0) {
      // Direct search by rim diameter when no OEM sizes match
      // Search for common sizes with this rim diameter
      const commonSizes = [`205/55R${wheelDiameter}`, `225/45R${wheelDiameter}`, `245/40R${wheelDiameter}`];
      
      const searchPromises: Promise<void>[] = [];
      for (const size of commonSizes) {
        searchPromises.push(
          searchTiresBySize(db, size, minQty, Math.ceil(pageSize / 3))
            .then((results) => { wpResults.push(...results.filter(t => t.rimDiameter === wheelDiameter)); })
        );
        searchPromises.push(
          searchTiresTirewireFormatted(size)
            .then((results) => { twResults.push(...results.filter(t => t.rimDiameter === wheelDiameter)); })
        );
        searchPromises.push(
          searchTiresKM(size)
            .then((results) => { kmResults.push(...results.filter(t => t.rimDiameter === wheelDiameter)); })
        );
      }
      await Promise.all(searchPromises);
    }
    timing.searchMs = Date.now() - tSearch0;
    
    // Merge results from all sources
    const allResults = await mergeTireResults(wpResults, twResults, kmResults, minQty);
    
    if (allResults.length === 0 && !wheelDiameter) {
      return NextResponse.json({
        results: [],
        mode: "vehicle",
        vehicle: { year, make, model, modification },
        wheelDiameter: wheelDiameter || null,
        oemTireSizes: tireSizes,
        hasLegacySizes,
        sizeConversions: hasLegacySizes ? sizeConversions : undefined,
        error: "No tire sizes found for vehicle",
        fallbackMessage: tireSizes.length > 0
          ? `No tires currently in stock for sizes ${tireSizes.slice(0, 3).join(", ")}. Please check back later or contact us for assistance.`
          : "We couldn't determine the tire size for this vehicle. Please contact us for assistance.",
        noResultsReason: "no_stock",
      });
    }
    
    // Final strict filter: only return tires matching wheelDiameter
    const filteredResults = wheelDiameter
      ? allResults.filter((t) => t.rimDiameter === wheelDiameter)
      : allResults;
    
    const slicedResults = filteredResults.slice(0, pageSize);
    
    // If strict filtering leaves us empty but we have results, return error
    if (wheelDiameter && slicedResults.length === 0 && allResults.length > 0) {
      return NextResponse.json({
        results: [],
        mode: "vehicle",
        vehicle: { year, make, model, modification },
        wheelDiameter,
        oemTireSizes: tireSizes,
        hasLegacySizes,
        sizeConversions: hasLegacySizes ? sizeConversions : undefined,
        error: `No tires found for ${wheelDiameter}" wheels. OEM sizes are ${tireSizes.join(", ")}`,
        fallbackMessage: `No tires currently available for ${wheelDiameter}" wheels. We have tires for other wheel sizes - try a different diameter or contact us.`,
        noResultsReason: "wheel_diameter_mismatch",
        matchMode,
      });
    }
    
    // Apply cached TireLibrary images (from Vercel Blob)
    const tCache0 = Date.now();
    const withCachedImages = await applyCachedImages(slicedResults);
    timing.cachedImagesMs = Date.now() - tCache0;
    
    // Apply admin image overrides (for K&M tires without images, etc.)
    const tOverride0 = Date.now();
    const withOverrides = await applyImageOverrides(db, withCachedImages);
    timing.imageOverrideMs = Date.now() - tOverride0;
    
    // Filter out tires without valid images (using enhanced validation)
    const debug = url.searchParams.get("debug") === "true";
    let { filtered: finalResults, stats: imageStats } = filterTiresWithValidImages(withOverrides, debug);
    
    if (imageStats.invalid > 0) {
      console.log(`[tires/search] Image filter: ${imageStats.valid}/${imageStats.total} valid, filtered ${imageStats.invalid} (${JSON.stringify(imageStats.invalidReasons)})`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PACKAGE PRIORITY SORTING (Optional Overlay)
    // Apply ONLY when: searchType === 'package' OR buildType === 'lifted'
    // Prioritizes: WheelPros + image + stock > image + stock > WheelPros + stock > rest
    // ═══════════════════════════════════════════════════════════════════════════
    const packageParam = url.searchParams.get("package");
    const buildTypeParam = url.searchParams.get("buildType");
    const searchTypeParam = url.searchParams.get("searchType");
    
    const applyPackagePriority = shouldApplyPackagePriority({
      searchType: searchTypeParam || undefined,
      buildType: buildTypeParam || undefined,
      package: packageParam || undefined,
    });
    
    let packagePriorityApplied = false;
    
    if (applyPackagePriority && finalResults.length > 0) {
      const tPkgPriority0 = Date.now();
      finalResults = applyPackagePriorityToTires(finalResults);
      timing.packagePriorityMs = Date.now() - tPkgPriority0;
      packagePriorityApplied = true;
      console.log(`[tires/search] 📦 PACKAGE PRIORITY applied: reordered ${finalResults.length} results`);
    }
    
    timing.totalMs = Date.now() - t0;
    
    // Build fallback message if no results
    let fallbackMessage: string | undefined;
    let noResultsReason: string | undefined;
    if (finalResults.length === 0) {
      if (imageStats.invalid > 0) {
        fallbackMessage = `Found ${imageStats.invalid} tire(s) but they don't have valid images yet. Please check back soon or contact us.`;
        noResultsReason = "hidden_no_image";
      } else if (withOverrides.length === 0 && allResults.length === 0) {
        fallbackMessage = tireSizes.length > 0
          ? `No tires currently in stock for ${tireSizes.slice(0, 2).join(" or ")}. Check back later or contact us.`
          : "No tires found for this vehicle configuration. Please contact us for assistance.";
        noResultsReason = "no_stock";
      }
    }
    
    return NextResponse.json({
      results: finalResults,
      mode: "vehicle",
      vehicle: { year, make, model, modification },
      wheelDiameter: wheelDiameter || null,
      
      // Original OEM sizes (for display, may include legacy like E70-14)
      oemTireSizes: tireSizes,
      
      // Sizes actually searched (modern P-metric)
      tireSizesSearched: sizesToSearch.length > 0 ? sizesToSearch : [`direct:R${wheelDiameter}`],
      
      // Legacy conversion info
      hasLegacySizes,
      sizeConversions: hasLegacySizes ? sizeConversions : undefined,
      
      // Classic vehicle upsize info
      isClassicVehicle,
      ...(isClassicVehicle && classicStockTire && {
        classicInfo: {
          stockTireSize: classicStockTire,
          upsizeSizes: classicUpsizeSizes,
        },
      }),
      
      matchMode,
      fitmentSource,
      sources: {
        wheelpros: wpResults.length,
        tirewire: twResults.length,
        km: kmResults.length,
      },
      imageFiltering: {
        totalBeforeFilter: imageStats.total,
        validImages: imageStats.valid,
        filteredOut: imageStats.invalid,
        ...(debug && { reasons: imageStats.invalidReasons }),
      },
      
      // Fallback messaging for empty results (QA validation)
      ...(fallbackMessage && { fallbackMessage }),
      ...(noResultsReason && { noResultsReason }),
      
      // Package prioritization flag
      packagePriorityApplied,
      
      timing,
    });
  } catch (e: any) {
    console.error("[tires/search] Error:", e);
    return NextResponse.json(
      { results: [], error: e?.message || String(e) },
      { status: 200 }
    );
  }
}

