import pg from 'pg';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// GMC Envoy was made 2002-2009 (2nd gen - the common one)
// All share: 6x127 bolt pattern, 78.1mm hub bore, M12x1.5 conical
const ENVOY_YEARS = [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009];

const TRIMS = [
  {
    modificationSuffix: 'sle-17',
    rawTrim: 'SLE',
    displayTrim: 'SLE (17")',
    oemWheelSizes: [{ diameter: 17, width: 7 }],
    oemTireSizes: [{ width: 245, aspectRatio: 65, diameter: 17 }]
  },
  {
    modificationSuffix: 'slt-18',
    rawTrim: 'SLT',
    displayTrim: 'SLT (18")',
    oemWheelSizes: [{ diameter: 18, width: 8 }],
    oemTireSizes: [{ width: 245, aspectRatio: 60, diameter: 18 }]
  },
  {
    modificationSuffix: 'denali',
    rawTrim: 'Denali',
    displayTrim: 'Denali',
    oemWheelSizes: [{ diameter: 18, width: 8 }],
    oemTireSizes: [{ width: 255, aspectRatio: 55, diameter: 18 }]
  }
];

async function main() {
  const client = await pool.connect();
  let added = 0;
  let skipped = 0;

  try {
    for (const year of ENVOY_YEARS) {
      for (const trim of TRIMS) {
        const modificationId = `gmc-envoy-${year}-${trim.modificationSuffix}`;
        
        // Check if exists
        const existing = await client.query(
          `SELECT id FROM vehicle_fitments WHERE modification_id = $1`,
          [modificationId]
        );
        
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        const id = randomUUID();
        await client.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, modification_id, raw_trim, display_trim, submodel,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
          id, year, 'GMC', 'Envoy', modificationId,
          trim.rawTrim, trim.displayTrim, null,
          '6x127', 78.1, 'M12x1.5', 'conical',
          35, 50, JSON.stringify(trim.oemWheelSizes), JSON.stringify(trim.oemTireSizes),
          'manual'
        ]);
        
        console.log(`✓ Added: ${year} GMC Envoy ${trim.displayTrim}`);
        added++;
      }
    }
    
    console.log(`\nDone! Added ${added}, skipped ${skipped} (already existed)`);
    console.log('Years covered: 2002-2009');
    console.log('Specs: 6x127, 78.1mm bore, M12x1.5 conical, +35 to +50mm offset');
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
