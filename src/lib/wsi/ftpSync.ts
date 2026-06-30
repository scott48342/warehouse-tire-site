/**
 * WSI Wholesale FTP Sync
 *
 * Downloads wsi_inventory_for_warehouse_tire.csv from wsiwholesale.com FTP,
 * parses the CSV, filters to wheels only, normalizes bolt patterns, and
 * upserts all rows into the wsi_wheels table.
 *
 * Called by:
 *   - /api/cron/sync-wsi-inventory  (nightly Vercel cron ~5 AM ET)
 *   - /api/admin/wsi-sync           (manual trigger from admin panel)
 */

import { getPool } from "@/lib/vehicleFitment";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── FTP Config ──────────────────────────────────────────────────────────────

const FTP_HOST     = "wsiwholesale.com";
const FTP_USER     = "warehouse_tire@wsiwholesale.com";
const FTP_PASS     = process.env.WSI_FTP_PASSWORD ?? "IV^S~MPCnfrB";
const FTP_FILE     = "wsi_inventory_for_warehouse_tire.csv";
const FTP_URL      = `ftp://${FTP_HOST}/${FTP_FILE}`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WSIRow {
  sku: string;
  brand: string;
  style: string | null;
  finish: string | null;
  diameter: number;
  width: number;
  bp1: string | null;   // normalized "6x139.7"
  bp2: string | null;   // second bolt pattern for multi-fit
  offset_mm: number | null;
  centerbore: number | null;
  wsi_stock: number;
  alt_stock: number;
  catalog_price: number | null;
  dealer_cost: number | null;
  load_rating: number | null;
  image_url: string | null;
  logo_url: string | null;
}

export interface SyncResult {
  success: boolean;
  rowsFetched: number;
  rowsUpserted: number;
  durationMs: number;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "6-135/6-139.7" → ["6x135", "6x139.7"] */
function parseBoltPatterns(raw: string): [string | null, string | null] {
  if (!raw || !raw.trim()) return [null, null];
  const parts = raw.trim().split("/").map(p =>
    p.trim().replace(/^(\d+)[-x](.+)$/, "$1x$2")
  );
  return [parts[0] || null, parts[1] || null];
}

/** "20X10" → { diameter: 20, width: 10 } */
function parseSize(raw: string): { diameter: number; width: number } | null {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/^(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { diameter: parseFloat(m[1]), width: parseFloat(m[2]) };
}

/** "+18" / "-18" / "0" → numeric, null if unparseable */
function parseOffset(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  const n = parseFloat(raw.trim());
  return isNaN(n) ? null : n;
}

function toNum(v: string | undefined): number | null {
  if (!v || !v.trim() || v.toLowerCase() === "call") return null;
  const n = parseFloat(v.trim());
  return isNaN(n) ? null : n;
}

function toInt(v: string | undefined): number {
  if (!v || !v.trim()) return 0;
  const n = parseInt(v.trim(), 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

// ─── CSV Parser ──────────────────────────────────────────────────────────────

/** Minimal CSV row parser that handles quoted fields */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (vals[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

// ─── FTP Download ────────────────────────────────────────────────────────────

async function downloadCSV(): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `wsi_inventory_${Date.now()}.csv`);
  // curl.exe on Windows (local dev), curl on Linux (Vercel prod)
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  const cmd = `${curlBin} -s --retry 3 --retry-delay 5 -u "${FTP_USER}:${FTP_PASS}" "${FTP_URL}" -o "${tmpFile}"`;

  console.log("[wsi-sync] Downloading FTP inventory...");
  try {
    execSync(cmd, { timeout: 120_000 });
  } catch (err) {
    throw new Error(`FTP download failed: ${(err as Error).message}`);
  }

  if (!fs.existsSync(tmpFile)) throw new Error("FTP file not found after download");
  const stat = fs.statSync(tmpFile);
  if (stat.size < 10_000) throw new Error(`FTP file too small (${stat.size} bytes) — likely an error`);

  console.log(`[wsi-sync] Downloaded ${(stat.size / 1_048_576).toFixed(1)} MB`);
  const text = fs.readFileSync(tmpFile, "utf-8");
  fs.unlinkSync(tmpFile);
  return text;
}

// ─── Row Normalization ───────────────────────────────────────────────────────

function normalizeRow(raw: Record<string, string>): WSIRow | null {
  // Wheels only — tires have no pricing
  if (!raw.ItemCategory || raw.ItemCategory.toLowerCase() !== "wheels") return null;

  const sku = raw.PartNumber?.trim();
  if (!sku) return null;

  const size = parseSize(raw.Size);
  if (!size) return null; // skip unparseable sizes

  const [bp1, bp2] = parseBoltPatterns(raw.BoltPattern);

  return {
    sku,
    brand: (raw.Brand ?? "").trim() || "Unknown",
    style: raw.Style?.trim() || null,
    finish: raw.Finish?.trim() || null,
    diameter: size.diameter,
    width: size.width,
    bp1,
    bp2,
    offset_mm: parseOffset(raw.Offset),
    centerbore: toNum(raw.CenterBore),
    wsi_stock: toInt(raw.WSIStock),
    alt_stock: toInt(raw.AltStock),
    catalog_price: toNum(raw.WSICatalogPrice),
    dealer_cost: toNum(raw.Cost),
    load_rating: toNum(raw.LoadRating),
    image_url: raw.ImageURL?.trim() || null,
    logo_url: raw.LogoURL?.trim() || null,
  };
}

// ─── DB Upsert ───────────────────────────────────────────────────────────────

async function upsertRows(rows: WSIRow[]): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  let total = 0;

  try {
    await client.query("BEGIN");

    // Staging table — dropped at end of transaction
    await client.query(`
      CREATE TEMP TABLE wsi_staging (
        sku           TEXT PRIMARY KEY,
        brand         TEXT,
        style         TEXT,
        finish        TEXT,
        diameter      NUMERIC,
        width         NUMERIC,
        bp1           TEXT,
        bp2           TEXT,
        offset_mm     NUMERIC,
        centerbore    NUMERIC,
        wsi_stock     INTEGER,
        alt_stock     INTEGER,
        catalog_price NUMERIC,
        dealer_cost   NUMERIC,
        load_rating   NUMERIC,
        image_url     TEXT,
        logo_url      TEXT
      ) ON COMMIT DROP
    `);

    // Bulk insert into staging in chunks of 500
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const valuePlaceholders = chunk.map((_, idx) => {
        const b = idx * 17;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16},$${b+17})`;
      }).join(",");
      const values: unknown[] = [];
      for (const r of chunk) {
        values.push(
          r.sku, r.brand, r.style, r.finish, r.diameter, r.width,
          r.bp1, r.bp2, r.offset_mm, r.centerbore,
          r.wsi_stock, r.alt_stock,
          r.catalog_price, r.dealer_cost, r.load_rating,
          r.image_url, r.logo_url
        );
      }
      await client.query(
        `INSERT INTO wsi_staging VALUES ${valuePlaceholders} ON CONFLICT (sku) DO UPDATE SET wsi_stock = EXCLUDED.wsi_stock + wsi_staging.wsi_stock`,
        values
      );
      total += chunk.length;
    }

    // Merge staging → wsi_wheels (full upsert)
    await client.query(`
      INSERT INTO wsi_wheels
        (sku, brand, style, finish, diameter, width, bp1, bp2,
         offset_mm, centerbore, wsi_stock, alt_stock, catalog_price,
         dealer_cost, load_rating, image_url, logo_url, synced_at)
      SELECT
        sku, brand, style, finish, diameter, width, bp1, bp2,
        offset_mm, centerbore, wsi_stock, alt_stock, catalog_price,
        dealer_cost, load_rating, image_url, logo_url, NOW()
      FROM wsi_staging
      ON CONFLICT (sku) DO UPDATE SET
        brand         = EXCLUDED.brand,
        style         = EXCLUDED.style,
        finish        = EXCLUDED.finish,
        diameter      = EXCLUDED.diameter,
        width         = EXCLUDED.width,
        bp1           = EXCLUDED.bp1,
        bp2           = EXCLUDED.bp2,
        offset_mm     = EXCLUDED.offset_mm,
        centerbore    = EXCLUDED.centerbore,
        wsi_stock     = EXCLUDED.wsi_stock,
        alt_stock     = EXCLUDED.alt_stock,
        catalog_price = EXCLUDED.catalog_price,
        dealer_cost   = EXCLUDED.dealer_cost,
        load_rating   = EXCLUDED.load_rating,
        image_url     = COALESCE(EXCLUDED.image_url, wsi_wheels.image_url),
        logo_url      = COALESCE(EXCLUDED.logo_url, wsi_wheels.logo_url),
        synced_at     = NOW()
    `);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return total;
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

export async function runWSISync(): Promise<SyncResult> {
  const start = Date.now();
  console.log("[wsi-sync] Starting WSI FTP inventory sync...");

  try {
    const csvText = await downloadCSV();
    const rawRows = parseCSV(csvText);
    console.log(`[wsi-sync] Parsed ${rawRows.length} CSV rows`);

    const wheelRows = rawRows
      .map(normalizeRow)
      .filter((r): r is WSIRow => r !== null);
    console.log(`[wsi-sync] ${wheelRows.length} wheel rows after normalization`);

    const upserted = await upsertRows(wheelRows);
    const durationMs = Date.now() - start;
    console.log(`[wsi-sync] ✅ Done in ${durationMs}ms — upserted ${upserted} rows`);

    return {
      success: true,
      rowsFetched: rawRows.length,
      rowsUpserted: upserted,
      durationMs,
    };
  } catch (err) {
    const error = (err as Error).message;
    console.error("[wsi-sync] ❌ Sync failed:", error);
    return {
      success: false,
      rowsFetched: 0,
      rowsUpserted: 0,
      durationMs: Date.now() - start,
      error,
    };
  }
}
