import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  
  try {
    // Check raw source records
    console.log('Checking fitment_source_records for raw API data...\n');
    
    const res = await client.query(`
      SELECT id, source_id, year, make, model, raw_payload, fetched_at
      FROM fitment_source_records
      WHERE year = 2009 AND LOWER(make) = 'jeep' AND LOWER(model) = 'wrangler'
      LIMIT 1
    `);
    
    if (res.rows.length === 0) {
      console.log('No source records found for 2009 Jeep Wrangler');
      
      // Check vehicle_fitments instead
      const fitRes = await client.query(`
        SELECT id, modification_id, display_trim, bolt_pattern, center_bore_mm, thread_size, oem_tire_sizes
        FROM vehicle_fitments
        WHERE year = 2009 AND LOWER(make) = 'jeep' AND LOWER(model) = 'wrangler'
        LIMIT 3
      `);
      
      console.log('Vehicle fitments found:', fitRes.rows.length);
      for (const row of fitRes.rows) {
        console.log(JSON.stringify(row, null, 2));
      }
    } else {
      const row = res.rows[0];
      console.log('Source ID:', row.source_id);
      console.log('Fetched:', row.fetched_at);
      console.log('\nRaw payload structure:');
      
      const payload = row.raw_payload;
      console.log('Keys:', Object.keys(payload));
      
      if (payload.vehicleData) {
        console.log('\nvehicleData keys:', Object.keys(payload.vehicleData));
        if (payload.vehicleData.technical) {
          console.log('technical:', JSON.stringify(payload.vehicleData.technical, null, 2));
        }
        if (payload.vehicleData.wheels) {
          console.log('wheels[0]:', JSON.stringify(payload.vehicleData.wheels?.[0], null, 2));
        }
      }
      
      if (payload.modification) {
        console.log('\nmodification.slug:', payload.modification.slug);
      }
    }
    
  } finally {
    client.release();
    pool.end();
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
