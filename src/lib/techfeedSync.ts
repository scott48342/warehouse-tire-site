/**
 * Techfeed Sync from WheelPros SFTP
 * 
 * Downloads the Wheel_TechGuide.csv and rebuilds wheels_by_sku.json.gz
 * This contains product specs, images, pricing - the catalog data.
 * 
 * Feed location: sftp://sftp.wheelpros.com/CommonFeed/USD/WHEEL/Wheel_TechGuide.csv
 * Refresh: Daily (catalog changes less frequently than inventory)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(zlib.gzip);

// Dynamic import to avoid Turbopack bundling issues with ssh2 native modules
async function getSftpClient() {
  const { default: Client } = await import("ssh2-sftp-client");
  return new Client();
}

// Dynamic import for csv-parse
async function getCsvParse() {
  const { parse } = await import("csv-parse/sync");
  return parse;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TechfeedSyncResult = {
  success: boolean;
  skusProcessed: number;
  stylesProcessed: number;
  errors: string[];
  durationMs: number;
  feedSize: number;
};

type CompactWheel = {
  sku: string;
  product_desc: string;
  brand_cd: string;
  brand_desc: string;
  style: string;
  display_style_no: string;
  diameter: string;
  width: string;
  offset: string;
  centerbore: string;
  backspacing: string;
  lug_count: string;
  bolt_pattern_metric: string;
  bolt_pattern_standard: string;
  abbreviated_finish_desc: string;
  fancy_finish_desc: string;
  box_label_desc: string;
  msrp: string;
  map_price: string;
  images: string[];
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const SFTP_CONFIG = {
  host: "sftp.wheelpros.com",
  port: 22,
  username: process.env.WHEELPROS_SFTP_USER || "Warehouse1",
  password: process.env.WHEELPROS_SFTP_PASS || "",
};

// TechGuide CSV path on SFTP
const TECHGUIDE_PATH = "/CommonFeed/USD/WHEEL/Wheel_TechGuide.csv";

// Output paths (relative to process.cwd())
const OUT_DIR = "src/techfeed";
const OUT_SKU_FILE = "wheels_by_sku.json.gz";
const OUT_STYLE_FILE = "wheels_by_style.json.gz";

// ═══════════════════════════════════════════════════════════════════════════════
// SFTP DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════════

async function downloadTechGuide(): Promise<Buffer> {
  const sftp = await getSftpClient();
  
  try {
    await sftp.connect(SFTP_CONFIG);
    console.log("[techfeedSync] Connected to SFTP");
    
    // Check if file exists
    const exists = await sftp.exists(TECHGUIDE_PATH);
    if (!exists) {
      throw new Error(`TechGuide not found at ${TECHGUIDE_PATH}`);
    }
    
    const data = await sftp.get(TECHGUIDE_PATH) as Buffer;
    console.log(`[techfeedSync] Downloaded ${(data.length / 1024 / 1024).toFixed(2)} MB`);
    
    return data;
  } finally {
    await sftp.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV PARSING
// ═══════════════════════════════════════════════════════════════════════════════

function pickImages(row: Record<string, any>): string[] {
  const keys = ["image_url1", "image_url2", "image_url3", "image_url4", "image_url"];
  const urls: string[] = [];
  for (const k of keys) {
    const v = (row[k] ?? "").toString().trim();
    if (v && !urls.includes(v)) urls.push(v);
  }
  return urls;
}

function compactRow(row: Record<string, any>): CompactWheel {
  return {
    sku: (row.sku ?? "").toString().trim(),
    product_desc: (row.product_desc ?? "").toString().trim(),
    brand_cd: (row.brand_cd ?? "").toString().trim(),
    brand_desc: (row.brand_desc ?? "").toString().trim(),
    style: (row.style ?? "").toString().trim(),
    display_style_no: (row.display_style_no ?? "").toString().trim(),
    diameter: (row.diameter ?? "").toString().trim(),
    width: (row.width ?? "").toString().trim(),
    offset: (row.offset ?? "").toString().trim(),
    centerbore: (row.centerbore ?? "").toString().trim(),
    backspacing: (row.backspacing ?? "").toString().trim(),
    lug_count: (row.lug_count ?? "").toString().trim(),
    bolt_pattern_metric: (row.bolt_pattern_metric ?? "").toString().trim(),
    bolt_pattern_standard: (row.bolt_pattern_standard ?? "").toString().trim(),
    abbreviated_finish_desc: (row.abbreviated_finish_desc ?? "").toString().trim(),
    fancy_finish_desc: (row.fancy_finish_desc ?? "").toString().trim(),
    box_label_desc: (row.box_label_desc ?? "").toString().trim(),
    msrp: (row.msrp ?? "").toString().trim(),
    map_price: (row.map_price ?? "").toString().trim(),
    images: pickImages(row),
  };
}

async function parseTechGuide(csvData: Buffer): Promise<{
  bySku: Record<string, CompactWheel>;
  byStyle: Record<string, CompactWheel[]>;
}> {
  const parse = await getCsvParse();
  
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  });

  const bySku: Record<string, CompactWheel> = {};
  const byStyle: Record<string, CompactWheel[]> = {};

  for (const row of records) {
    const compact = compactRow(row);
    if (!compact.sku) continue;

    bySku[compact.sku] = compact;

    const styleKey = compact.style || compact.display_style_no;
    if (styleKey) {
      if (!byStyle[styleKey]) byStyle[styleKey] = [];
      byStyle[styleKey].push(compact);
    }
  }

  return { bySku, byStyle };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE OUTPUT FILES
// ═══════════════════════════════════════════════════════════════════════════════

async function writeCompressedJson(filePath: string, data: any): Promise<void> {
  const json = JSON.stringify(data);
  const compressed = await gzip(Buffer.from(json, "utf8"));
  await fs.writeFile(filePath, compressed);
  console.log(`[techfeedSync] Wrote ${filePath} (${(compressed.length / 1024).toFixed(1)} KB)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SYNC FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

let lastSyncResult: TechfeedSyncResult | null = null;

export function getLastTechfeedSyncResult(): TechfeedSyncResult | null {
  return lastSyncResult;
}

export async function runTechfeedSync(): Promise<TechfeedSyncResult> {
  const t0 = Date.now();
  const errors: string[] = [];
  let skusProcessed = 0;
  let stylesProcessed = 0;
  let feedSize = 0;

  try {
    // 1. Download TechGuide CSV from SFTP
    console.log("[techfeedSync] Starting TechGuide download...");
    const csvData = await downloadTechGuide();
    feedSize = csvData.length;

    // 2. Parse CSV into indexed structures
    console.log("[techfeedSync] Parsing CSV...");
    const { bySku, byStyle } = await parseTechGuide(csvData);
    skusProcessed = Object.keys(bySku).length;
    stylesProcessed = Object.keys(byStyle).length;

    console.log(`[techfeedSync] Parsed ${skusProcessed} SKUs, ${stylesProcessed} styles`);

    // 3. Ensure output directory exists
    const outDir = path.join(process.cwd(), OUT_DIR);
    await fs.mkdir(outDir, { recursive: true });

    // 4. Write compressed JSON files
    const skuFile = path.join(outDir, OUT_SKU_FILE);
    const styleFile = path.join(outDir, OUT_STYLE_FILE);

    await writeCompressedJson(skuFile, {
      generatedAt: new Date().toISOString(),
      rows: skusProcessed,
      bySku,
    });

    await writeCompressedJson(styleFile, {
      generatedAt: new Date().toISOString(),
      rows: stylesProcessed,
      byStyle,
    });

    const result: TechfeedSyncResult = {
      success: true,
      skusProcessed,
      stylesProcessed,
      errors,
      durationMs: Date.now() - t0,
      feedSize,
    };

    lastSyncResult = result;
    return result;

  } catch (err: any) {
    const errMsg = err?.message || String(err);
    errors.push(errMsg);
    console.error("[techfeedSync] Sync failed:", errMsg);

    const result: TechfeedSyncResult = {
      success: false,
      skusProcessed,
      stylesProcessed,
      errors,
      durationMs: Date.now() - t0,
      feedSize,
    };

    lastSyncResult = result;
    return result;
  }
}
