/**
 * EXPAND GROUPED TRIMS (BATCH VERSION)
 * Uses batch inserts for speed
 */

import pg from "pg";
import fs from "fs";
import crypto from "crypto";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

console.log(`\n=== EXPAND GROUPED TRIMS - BATCH ===\n`);

function generateModificationId(year, make, model, trim) {
  const normalizedTrim = trim.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hash = crypto.createHash('md5')
    .update(`${year}-${make}-${model}-${trim}`)
    .digest('hex')
    .slice(0, 8);
  return `${make.toLowerCase()}-${model.toLowerCase()}-${normalizedTrim}-${hash}`;
}

function splitTrims(displayTrim) {
  if (!displayTrim) return [];
  const parts = displayTrim
    .split(/,\s*/)
    .map(s => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

async function main() {
  const client = await pool.connect();
  
  try {
    // Get grouped records
    const groupedRecords = await client.query(`
      SELECT * FROM vehicle_fitments
      WHERE display_trim LIKE '%,%'
      ORDER BY year DESC, make, model
    `);
    console.log(`Found ${groupedRecords.rows.length} records with grouped trims\n`);
    
    // Get existing modification_ids
    const existingMods = await client.query(`
      SELECT year, LOWER(make) as make, LOWER(model) as model, modification_id
      FROM vehicle_fitments
    `);
    const existingSet = new Set(
      existingMods.rows.map(r => `${r.year}|${r.make}|${r.model}|${r.modification_id}`)
    );
    console.log(`Loaded ${existingSet.size} existing modification IDs\n`);
    
    const newRecords = [];
    
    for (const record of groupedRecords.rows) {
      const trims = splitTrims(record.display_trim);
      if (trims.length <= 1) continue;
      
      for (const trim of trims) {
        const modId = generateModificationId(record.year, record.make, record.model, trim);
        const key = `${record.year}|${record.make.toLowerCase()}|${record.model.toLowerCase()}|${modId}`;
        
        if (existingSet.has(key)) continue;
        existingSet.add(key);
        
        // Truncate fields that might be too long
        const threadSize = (record.thread_size || '').slice(0, 20);
        const seatType = (record.seat_type || '').slice(0, 20);
        // Source is varchar(50), so truncate to fit + " [expanded]"
        const source = ((record.source || 'unknown').slice(0, 38) + ' [expanded]');
        
        newRecords.push({
          year: record.year,
          make: record.make,
          model: record.model,
          modification_id: modId,
          raw_trim: trim.slice(0, 255),
          display_trim: trim.slice(0, 255),
          submodel: null,
          bolt_pattern: (record.bolt_pattern || '').slice(0, 20),
          center_bore_mm: record.center_bore_mm,
          thread_size: threadSize,
          seat_type: seatType,
          offset_min_mm: record.offset_min_mm,
          offset_max_mm: record.offset_max_mm,
          oem_wheel_sizes: record.oem_wheel_sizes,
          oem_tire_sizes: record.oem_tire_sizes,
          source,
          quality_tier: (record.quality_tier || 'unknown').slice(0, 20)
        });
      }
    }
    
    console.log(`New records to insert: ${newRecords.length}\n`);
    
    if (newRecords.length === 0) {
      console.log('All trims already expanded!');
      await pool.end();
      return;
    }
    
    // Batch insert
    const BATCH_SIZE = 50;
    let inserted = 0;
    
    for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
      const batch = newRecords.slice(i, i + BATCH_SIZE);
      
      const values = [];
      const params = [];
      let paramIndex = 1;
      
      for (const rec of batch) {
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}::jsonb, $${paramIndex++}::jsonb, $${paramIndex++}, $${paramIndex++}, NOW(), NOW())`);
        params.push(
          rec.year, rec.make, rec.model, rec.modification_id, rec.raw_trim, rec.display_trim, rec.submodel,
          rec.bolt_pattern, rec.center_bore_mm, rec.thread_size, rec.seat_type,
          rec.offset_min_mm, rec.offset_max_mm,
          JSON.stringify(rec.oem_wheel_sizes), JSON.stringify(rec.oem_tire_sizes),
          rec.source, rec.quality_tier
        );
      }
      
      try {
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, raw_trim, display_trim, submodel,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
            source, quality_tier, created_at, updated_at
          ) VALUES ${values.join(', ')}
          ON CONFLICT (year, make, model, modification_id) DO NOTHING
        `, params);
        inserted += batch.length;
        
        if (inserted % 500 === 0 || inserted === newRecords.length) {
          console.log(`  Inserted ${inserted}/${newRecords.length}...`);
        }
      } catch (err) {
        console.error(`Batch error: ${err.message}`);
        // Fall back to individual inserts for this batch
        for (const rec of batch) {
          try {
            await client.query(`
              INSERT INTO vehicle_fitments (
                year, make, model, modification_id, raw_trim, display_trim, submodel,
                bolt_pattern, center_bore_mm, thread_size, seat_type,
                offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
                source, quality_tier, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, NOW(), NOW())
              ON CONFLICT (year, make, model, modification_id) DO NOTHING
            `, [
              rec.year, rec.make, rec.model, rec.modification_id, rec.raw_trim, rec.display_trim, rec.submodel,
              rec.bolt_pattern, rec.center_bore_mm, rec.thread_size, rec.seat_type,
              rec.offset_min_mm, rec.offset_max_mm,
              JSON.stringify(rec.oem_wheel_sizes), JSON.stringify(rec.oem_tire_sizes),
              rec.source, rec.quality_tier
            ]);
            inserted++;
          } catch (e) {
            // Skip
          }
        }
      }
    }
    
    console.log(`\n✅ Inserted ${inserted} new trim records`);
    
    const afterCount = await client.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
    console.log(`Total records now: ${afterCount.rows[0].cnt}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
