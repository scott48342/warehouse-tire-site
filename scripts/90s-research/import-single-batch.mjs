import { readFileSync } from 'fs';
import pg from 'pg';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node import-single-batch.mjs <batch-file.json>');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const data = JSON.parse(readFileSync(file, 'utf-8'));
const results = data.results || [];

let inserted = 0, updated = 0, skipped = 0;

for (const r of results) {
  if (r.status !== 'complete' && r.status !== 'success') {
    skipped++;
    continue;
  }
  
  // Handle year_range format
  let years = [];
  if (r.year) {
    years = [r.year];
  } else if (r.year_range) {
    const [start, end] = r.year_range.split('-').map(Number);
    for (let y = start; y <= end; y++) years.push(y);
  }
  
  // Handle both nested (data: {}) and flat formats
  const d = r.data || r;
  
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
        d.bolt_pattern,
        d.hub_bore,
        JSON.stringify(d.oem_wheel_sizes || []),
        JSON.stringify(d.oem_tire_sizes || []),
        '90s-research-batch',
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
        d.bolt_pattern,
        d.hub_bore,
        JSON.stringify(d.oem_wheel_sizes || []),
        JSON.stringify(d.oem_tire_sizes || []),
        '90s-research-batch',
        r.confidence || 'high'
      ]);
      inserted++;
    }
  }
}

console.log(`Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
await client.end();
