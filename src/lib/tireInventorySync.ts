/**
 * Tire Inventory Sync from WheelPros SFTP Feed
 * 
 * Downloads the tireInvPriceData.json feed and updates wp_inventory in Postgres.
 * This provides local inventory data so we don't need to hit TireWeb on every search.
 * 
 * Feed location: sftp://sftp.wheelpros.com/CommonFeed/USD/TIRE/tireInvPriceData.json
 * Feed size: ~4MB
 * Feed refresh: Every 2 hours by WheelPros
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import pg from "pg";

// Dynamic import to avoid Turbopack bundling issues with ssh2 native modules
async function getSftpClient() {
  const { default: Client } = await import("ssh2-sftp-client");
  return new Client();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TireInventoryRecord = {
  sku: string;
  totalQty: number;
  mapPrice: number | null;
  msrp: number | null;
  brand: string | null;
  runDate: string | null;
};

export type TireSyncResult = {
  success: boolean;
  recordsProcessed: number;
  recordsUpdated: number;
  errors: string[];
  durationMs: number;
  feedRunDate: string | null;
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

const TIRE_FEED_PATH = "/CommonFeed/USD/TIRE/tireInvPriceData.json";

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

const { Pool } = pg;

function getPool(): pg.Pool {
  const DATABASE_URL = process.env.POSTGRES_URL;
  if (!DATABASE_URL) throw new Error("Missing POSTGRES_URL");
  
  return new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SFTP DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════════

async function downloadTireInventoryFeed(): Promise<Buffer> {
  const sftp = await getSftpClient();
  
  try {
    await sftp.connect(SFTP_CONFIG);
    console.log("[tireInventorySync] Connected to SFTP");
    
    const data = await sftp.get(TIRE_FEED_PATH) as Buffer;
    console.log(`[tireInventorySync] Downloaded ${(data.length / 1024 / 1024).toFixed(2)} MB`);
    
    return data;
  } finally {
    await sftp.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSE FEED
// ═══════════════════════════════════════════════════════════════════════════════

type RawTireFeedRecord = {
  PartNumber?: string;
  TotalQOH?: string | number;
  MAP_USD?: string;
  MSRP_USD?: string;
  Brand?: string;
  RunDate?: string;
  [key: string]: any;
};

function parseTireInventoryFeed(data: Buffer): TireInventoryRecord[] {
  const json: RawTireFeedRecord[] = JSON.parse(data.toString("utf8"));
  const records: TireInventoryRecord[] = [];
  
  for (const row of json) {
    const partNumber = row.PartNumber;
    if (!partNumber) continue;
    
    const sku = partNumber.trim();
    
    // Parse total quantity
    let totalQty = 0;
    if (typeof row.TotalQOH === "number") {
      totalQty = row.TotalQOH;
    } else if (typeof row.TotalQOH === "string") {
      totalQty = parseInt(row.TotalQOH, 10) || 0;
    }
    
    // Parse prices
    const mapPrice = row.MAP_USD ? parseFloat(row.MAP_USD) || null : null;
    const msrp = row.MSRP_USD ? parseFloat(row.MSRP_USD) || null : null;
    
    records.push({
      sku,
      totalQty,
      mapPrice,
      msrp,
      brand: row.Brand || null,
      runDate: row.RunDate || null,
    });
  }
  
  return records;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE POSTGRES
// ═══════════════════════════════════════════════════════════════════════════════

async function updateTireInventory(records: TireInventoryRecord[]): Promise<number> {
  const pool = getPool();
  let updated = 0;
  
  try {
    // Process in batches of 500
    const batchSize = 500;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // Build bulk upsert query
      const values: any[] = [];
      const placeholders: string[] = [];
      
      batch.forEach((record, idx) => {
        const offset = idx * 4;
        placeholders.push(`($${offset + 1}, 'tire', 'TOTAL', $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(
          record.sku,
          record.totalQty,
          record.runDate ? new Date(record.runDate) : new Date(),
          new Date()
        );
      });
      
      const query = `
        INSERT INTO wp_inventory (sku, product_type, location_id, qoh, run_date, updated_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (sku, product_type, location_id) 
        DO UPDATE SET 
          qoh = EXCLUDED.qoh,
          run_date = EXCLUDED.run_date,
          updated_at = EXCLUDED.updated_at
      `;
      
      await pool.query(query, values);
      updated += batch.length;
      
      if ((i + batchSize) % 2000 === 0) {
        console.log(`[tireInventorySync] Processed ${i + batchSize}/${records.length} records`);
      }
    }
    
    return updated;
  } finally {
    await pool.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SYNC FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

let lastSyncResult: TireSyncResult | null = null;

export function getLastTireSyncResult(): TireSyncResult | null {
  return lastSyncResult;
}

export async function runTireInventorySync(): Promise<TireSyncResult> {
  const t0 = Date.now();
  const result: TireSyncResult = {
    success: false,
    recordsProcessed: 0,
    recordsUpdated: 0,
    errors: [],
    durationMs: 0,
    feedRunDate: null,
  };
  
  try {
    // Check SFTP password is configured
    if (!SFTP_CONFIG.password) {
      throw new Error("WHEELPROS_SFTP_PASS not configured");
    }
    
    // Download feed
    console.log("[tireInventorySync] Downloading tire inventory from SFTP...");
    const data = await downloadTireInventoryFeed();
    
    // Parse feed
    console.log("[tireInventorySync] Parsing feed...");
    const records = parseTireInventoryFeed(data);
    result.recordsProcessed = records.length;
    result.feedRunDate = records[0]?.runDate || null;
    
    console.log(`[tireInventorySync] Parsed ${records.length} tire records`);
    
    // Update Postgres
    console.log("[tireInventorySync] Updating wp_inventory...");
    result.recordsUpdated = await updateTireInventory(records);
    
    console.log(`[tireInventorySync] Updated ${result.recordsUpdated} records in wp_inventory`);
    
    result.success = true;
  } catch (err: any) {
    console.error("[tireInventorySync] Sync failed:", err);
    result.errors.push(err?.message || String(err));
  }
  
  result.durationMs = Date.now() - t0;
  lastSyncResult = result;
  return result;
}
