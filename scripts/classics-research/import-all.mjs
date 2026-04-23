import { readFileSync, readdirSync } from 'fs';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const resultsDir = './results';
const files = readdirSync(resultsDir).filter(f => f.endsWith('.json'));

let totalInserted = 0, totalUpdated = 0, totalSkipped = 0;

for (const file of files.sort()) {
  console.log(`Processing ${file}...`);
  
  const data = JSON.parse(readFileSync(`${resultsDir}/${file}`, 'utf-8'));
  const results = data.results || data.vehicles || [];
  
  let inserted = 0, updated = 0, skipped = 0;
  
  for (const r of results) {
    // Handle both camelCase (classics) and snake_case (80s) formats
    const boltPattern = r.boltPattern || r.bolt_pattern || (r.data && r.data.bolt_pattern);
    const hubBore = r.hubBore || r.hub_bore || (r.data && r.data.hub_bore);
    
    if (!boltPattern) {
      skipped++;
      continue;
    }
    
    // Handle year_range format or single year
    let years = [];
    if (r.year) {
      years = [r.year];
    } else if (r.year_range) {
      const match = r.year_range.match(/(\d{4})-(\d{4})/);
      if (match) {
        const [, start, end] = match;
        for (let y = parseInt(start); y <= parseInt(end); y++) years.push(y);
      }
    }
    
    if (years.length === 0) {
      skipped++;
      continue;
    }
    
    // Build OEM wheel sizes array
    const oemWheelSizes = [];
    if (r.oemWheelFront) oemWheelSizes.push(r.oemWheelFront);
    if (r.oemWheelRear && r.oemWheelRear !== r.oemWheelFront) oemWheelSizes.push(r.oemWheelRear);
    if (r.oem_wheel_sizes) oemWheelSizes.push(...r.oem_wheel_sizes);
    
    // Build OEM tire sizes array
    const oemTireSizes = [];
    if (r.oemTireFront) oemTireSizes.push(r.oemTireFront);
    if (r.oemTireRear && r.oemTireRear !== r.oemTireFront) oemTireSizes.push(r.oemTireRear);
    if (r.oem_tire_sizes) oemTireSizes.push(...r.oem_tire_sizes);
    
    for (const year of years) {
      const modId = `${year}-${r.make.toLowerCase()}-${r.model.toLowerCase()}-${(r.submodel || r.trim || 'base').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      
      // Check if exists
      const existing = await client.query(
        'SELECT id FROM vehicle_fitments WHERE year = $1 AND LOWER(make) = $2 AND LOWER(model) = $3',
        [year, r.make.toLowerCase(), r.model.toLowerCase()]
      );
      
      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE vehicle_fitments SET
            bolt_pattern = $1, center_bore_mm = $2, 
            oem_wheel_sizes = $3, oem_tire_sizes = $4,
            source = $5, quality_tier = $6, updated_at = NOW()
          WHERE id = $7
        `, [
          boltPattern,
          hubBore,
          JSON.stringify([...new Set(oemWheelSizes)]),
          JSON.stringify([...new Set(oemTireSizes)]),
          'classics-research-batch',
          r.confidence || 'high',
          existing.rows[0].id
        ]);
        updated++;
      } else {
        await client.query(`
          INSERT INTO vehicle_fitments (year, make, model, modification_id, display_trim, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes, source, quality_tier)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          year,
          r.make,
          r.model,
          modId,
          r.submodel || r.trim || 'Base',
          boltPattern,
          hubBore,
          JSON.stringify([...new Set(oemWheelSizes)]),
          JSON.stringify([...new Set(oemTireSizes)]),
          'classics-research-batch',
          r.confidence || 'high'
        ]);
        inserted++;
      }
    }
  }
  
  console.log(`  → Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
  totalInserted += inserted;
  totalUpdated += updated;
  totalSkipped += skipped;
}

console.log('');
console.log('=== IMPORT COMPLETE ===');
console.log(`Total Inserted: ${totalInserted}`);
console.log(`Total Updated: ${totalUpdated}`);
console.log(`Total Skipped: ${totalSkipped}`);

await client.end();
