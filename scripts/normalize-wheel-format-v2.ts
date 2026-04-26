/**
 * Normalize wheel data with "size" field format
 * Converts {"size": "17x7", "tires": [...]} to {diameter: 17, width: 7}
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

function parseWheelString(s: string): { diameter: number; width: number } | null {
  const match = s.match(/(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)/);
  if (match) {
    const a = parseFloat(match[1]);
    const b = parseFloat(match[2]);
    if (a >= 14 && a <= 24) return { diameter: a, width: b };
    if (b >= 14 && b <= 24) return { diameter: b, width: a };
  }
  return null;
}

async function main() {
  console.log('\n🔧 Normalizing wheel "size" field format...\n');
  
  const records = await pool.query(`
    SELECT id, oem_wheel_sizes::text as wheels
    FROM vehicle_fitments
    WHERE year >= 2000 
      AND oem_wheel_sizes IS NOT NULL
      AND oem_wheel_sizes::text LIKE '%"size":%'
      AND oem_wheel_sizes::text NOT LIKE '%"diameter":%'
  `);
  
  console.log(`Found ${records.rowCount} records with "size" field format\n`);
  
  const updates: { id: string; wheels: any[] }[] = [];
  
  for (const row of records.rows) {
    try {
      const wheels = JSON.parse(row.wheels);
      const normalized: any[] = [];
      
      for (const w of wheels) {
        if (typeof w === 'object' && w.size) {
          const parsed = parseWheelString(w.size);
          if (parsed) {
            normalized.push({
              diameter: parsed.diameter,
              width: parsed.width,
              offset: w.offset || null,
              axle: 'square',
              isStock: true
            });
          }
        }
      }
      
      if (normalized.length > 0) {
        updates.push({ id: row.id, wheels: normalized });
      }
    } catch (e) {}
  }
  
  console.log(`Prepared ${updates.length} updates\n`);
  
  for (const u of updates) {
    await pool.query(
      `UPDATE vehicle_fitments SET oem_wheel_sizes = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(u.wheels), u.id]
    );
  }
  
  console.log(`✅ Normalized ${updates.length} records`);
  await pool.end();
}

main().catch(console.error);
