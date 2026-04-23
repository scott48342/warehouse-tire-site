import { readFileSync, readdirSync } from 'fs';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const resultsDir = './results';
const files = readdirSync(resultsDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
  console.log("No result files found in", resultsDir);
  process.exit(1);
}

let totalUpdated = 0, totalSkipped = 0, totalFlagged = 0;

for (const file of files.sort()) {
  console.log(`Processing ${file}...`);
  
  const data = JSON.parse(readFileSync(`${resultsDir}/${file}`, 'utf-8'));
  const vehicles = data.vehicles || data.results || [];
  
  let updated = 0, skipped = 0, flagged = 0;
  
  for (const v of vehicles) {
    // Skip flagged/invalid vehicles
    if (v.flag || v.invalid || v.confidence === 'low' || v.confidence === 'skip') {
      flagged++;
      continue;
    }
    
    const boltPattern = v.boltPattern || v.bolt_pattern;
    let hubBore = v.hubBore || v.hub_bore || v.centerBore;
    
    // Handle various hub bore formats
    if (hubBore) {
      if (typeof hubBore === 'string') {
        // Extract first numeric value from strings like "front:70.1/rear:64.1" or "66.6mm"
        const match = hubBore.match(/(\d+\.?\d*)/);
        hubBore = match ? parseFloat(match[1]) : null;
      } else if (typeof hubBore !== 'number') {
        hubBore = null;
      }
    }
    
    if (!boltPattern) {
      skipped++;
      continue;
    }
    
    // Build tire sizes array
    let tireSizes = v.oemTireSizes || v.oem_tire_sizes || v.tireSizes || [];
    if (typeof tireSizes === 'string') tireSizes = [tireSizes];
    
    // Build wheel sizes array  
    let wheelSizes = v.oemWheelSizes || v.oem_wheel_sizes || v.wheelSizes || [];
    if (typeof wheelSizes === 'string') wheelSizes = [wheelSizes];
    
    // Update existing record
    const result = await client.query(`
      UPDATE vehicle_fitments SET
        bolt_pattern = $1,
        center_bore_mm = $2,
        oem_tire_sizes = $3,
        oem_wheel_sizes = $4,
        source = $5,
        quality_tier = $6,
        updated_at = NOW()
      WHERE year = $7 AND LOWER(make) = $8 AND LOWER(model) = $9
      RETURNING id
    `, [
      boltPattern,
      hubBore,
      JSON.stringify(tireSizes),
      JSON.stringify(wheelSizes),
      'verified-research',
      v.confidence || 'high',
      v.year,
      v.make.toLowerCase(),
      v.model.toLowerCase()
    ]);
    
    if (result.rowCount > 0) {
      updated += result.rowCount;
    } else {
      // Record doesn't exist, insert it
      await client.query(`
        INSERT INTO vehicle_fitments (year, make, model, modification_id, display_trim, bolt_pattern, center_bore_mm, oem_tire_sizes, oem_wheel_sizes, source, quality_tier)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        v.year,
        v.make,
        v.model,
        `${v.year}-${v.make.toLowerCase()}-${v.model.toLowerCase()}-base`,
        'Base',
        boltPattern,
        hubBore,
        JSON.stringify(tireSizes),
        JSON.stringify(wheelSizes),
        'verified-research',
        v.confidence || 'high'
      ]);
      updated++;
    }
  }
  
  console.log(`  → Updated: ${updated}, Skipped: ${skipped}, Flagged: ${flagged}`);
  totalUpdated += updated;
  totalSkipped += skipped;
  totalFlagged += flagged;
}

console.log('');
console.log('=== IMPORT COMPLETE ===');
console.log(`Total Updated: ${totalUpdated}`);
console.log(`Total Skipped: ${totalSkipped}`);
console.log(`Total Flagged (need review): ${totalFlagged}`);

await client.end();
