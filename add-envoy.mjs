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

// 2006 GMC Envoy fitment specs
const envoyFitments = [
  {
    year: 2006,
    make: 'GMC',
    model: 'Envoy',
    modificationId: 'gmc-envoy-2006-sle-17',
    rawTrim: 'SLE',
    displayTrim: 'SLE (17")',
    submodel: null,
    boltPattern: '6x127',
    centerBoreMm: 78.1,
    threadSize: 'M12x1.5',
    seatType: 'conical',
    offsetMinMm: 35,
    offsetMaxMm: 50,
    oemWheelSizes: JSON.stringify([{ diameter: 17, width: 7 }]),
    oemTireSizes: JSON.stringify([{ width: 245, aspectRatio: 65, diameter: 17 }]),
    source: 'manual'
  },
  {
    year: 2006,
    make: 'GMC',
    model: 'Envoy',
    modificationId: 'gmc-envoy-2006-slt-18',
    rawTrim: 'SLT',
    displayTrim: 'SLT (18")',
    submodel: null,
    boltPattern: '6x127',
    centerBoreMm: 78.1,
    threadSize: 'M12x1.5',
    seatType: 'conical',
    offsetMinMm: 35,
    offsetMaxMm: 50,
    oemWheelSizes: JSON.stringify([{ diameter: 18, width: 8 }]),
    oemTireSizes: JSON.stringify([{ width: 245, aspectRatio: 60, diameter: 18 }]),
    source: 'manual'
  },
  {
    year: 2006,
    make: 'GMC',
    model: 'Envoy',
    modificationId: 'gmc-envoy-2006-denali',
    rawTrim: 'Denali',
    displayTrim: 'Denali',
    submodel: null,
    boltPattern: '6x127',
    centerBoreMm: 78.1,
    threadSize: 'M12x1.5',
    seatType: 'conical',
    offsetMinMm: 35,
    offsetMaxMm: 50,
    oemWheelSizes: JSON.stringify([{ diameter: 18, width: 8 }]),
    oemTireSizes: JSON.stringify([{ width: 255, aspectRatio: 55, diameter: 18 }]),
    source: 'manual'
  }
];

async function main() {
  const client = await pool.connect();
  try {
    // Check if already exists
    const existing = await client.query(
      `SELECT id, display_trim FROM vehicle_fitments WHERE year = 2006 AND make = 'GMC' AND model = 'Envoy'`
    );
    
    if (existing.rows.length > 0) {
      console.log('Envoy fitments already exist:');
      existing.rows.forEach(r => console.log(`  - ${r.display_trim}`));
      return;
    }

    // Insert new fitments
    for (const fitment of envoyFitments) {
      const id = randomUUID();
      await client.query(`
        INSERT INTO vehicle_fitments (
          id, year, make, model, modification_id, raw_trim, display_trim, submodel,
          bolt_pattern, center_bore_mm, thread_size, seat_type,
          offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        id, fitment.year, fitment.make, fitment.model, fitment.modificationId,
        fitment.rawTrim, fitment.displayTrim, fitment.submodel,
        fitment.boltPattern, fitment.centerBoreMm, fitment.threadSize, fitment.seatType,
        fitment.offsetMinMm, fitment.offsetMaxMm, fitment.oemWheelSizes, fitment.oemTireSizes,
        fitment.source
      ]);
      console.log(`✓ Added: ${fitment.displayTrim}`);
    }
    
    console.log('\n2006 GMC Envoy fitments added successfully!');
    console.log('Specs: 6x127 bolt pattern, 78.1mm center bore, M12x1.5 lugs');
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
