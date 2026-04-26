/**
 * Normalize wheel data from strings to objects
 * Converts "16x7" or "8Jx17" to {diameter: 16, width: 7}
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

function parseWheelString(s: string): { diameter: number; width: number } | null {
  // Match "16x7", "16x7.5", "8Jx17", "17x8.5J", etc.
  const match1 = s.match(/(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)/);
  if (match1) {
    const a = parseFloat(match1[1]);
    const b = parseFloat(match1[2]);
    // Determine which is diameter (larger, typically >= 14) and width
    if (a >= 14 && a <= 24) {
      return { diameter: a, width: b };
    } else if (b >= 14 && b <= 24) {
      return { diameter: b, width: a };
    }
  }
  
  // Match "8Jx17" format
  const match2 = s.match(/(\d+(?:\.\d+)?)J?[xX](\d+(?:\.\d+)?)/);
  if (match2) {
    const width = parseFloat(match2[1]);
    const diameter = parseFloat(match2[2]);
    return { diameter, width };
  }
  
  return null;
}

async function main() {
  console.log('\n🔧 Normalizing wheel data format...\n');
  
  // Get records with string wheel format
  const records = await pool.query(`
    SELECT id, oem_wheel_sizes::text as wheels
    FROM vehicle_fitments
    WHERE year >= 2000 
      AND oem_wheel_sizes IS NOT NULL
      AND oem_wheel_sizes::text != '[]'
      AND oem_wheel_sizes::text NOT LIKE '%diameter%'
  `);
  
  console.log(`Found ${records.rowCount} records with string wheel format\n`);
  
  const updates: { id: string; wheels: any[] }[] = [];
  let parsed = 0, failed = 0;
  
  for (const row of records.rows) {
    try {
      const wheels = JSON.parse(row.wheels);
      const normalized: any[] = [];
      let allParsed = true;
      
      for (const w of wheels) {
        if (typeof w === 'string') {
          const parsed = parseWheelString(w);
          if (parsed) {
            normalized.push({ ...parsed, axle: 'square', isStock: true });
          } else {
            allParsed = false;
            break;
          }
        } else if (typeof w === 'object' && w.diameter) {
          normalized.push(w); // Already normalized
        } else {
          allParsed = false;
          break;
        }
      }
      
      if (allParsed && normalized.length > 0) {
        updates.push({ id: row.id, wheels: normalized });
        parsed++;
      } else {
        failed++;
        if (failed <= 5) {
          console.log(`  Failed to parse: ${row.wheels.substring(0, 80)}`);
        }
      }
    } catch (e) {
      failed++;
    }
  }
  
  console.log(`\nParsed: ${parsed}, Failed: ${failed}`);
  
  if (updates.length === 0) {
    console.log('No updates needed.');
    await pool.end();
    return;
  }
  
  // Batch update
  console.log('\nUpdating records...');
  const BATCH_SIZE = 100;
  let updated = 0;
  
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    
    for (const u of batch) {
      await pool.query(
        `UPDATE vehicle_fitments SET oem_wheel_sizes = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(u.wheels), u.id]
      );
    }
    
    updated += batch.length;
    if (updated % 500 === 0 || updated === updates.length) {
      console.log(`  Updated ${updated}/${updates.length}`);
    }
  }
  
  console.log(`\n✅ Normalized ${updated} records`);
  await pool.end();
}

main().catch(console.error);
