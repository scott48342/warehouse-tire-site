require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== FULL CLASSIC VEHICLE AUDIT (1980-1990) ===\n');
    
    // 1. Find all records with missing critical fields
    console.log('--- RECORDS WITH MISSING CRITICAL FIELDS ---\n');
    
    const missingBolt = await client.query(`
      SELECT year, make, model, display_trim, bolt_pattern
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
        AND (bolt_pattern IS NULL OR bolt_pattern = '' OR bolt_pattern = 'N/A')
      ORDER BY make, model, year
    `);
    console.log(`Missing/Invalid bolt_pattern: ${missingBolt.rows.length}`);
    missingBolt.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim || ''} - bolt: "${r.bolt_pattern}"`));
    
    const missingHub = await client.query(`
      SELECT year, make, model, display_trim, center_bore_mm
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
        AND center_bore_mm IS NULL
      ORDER BY make, model, year
    `);
    console.log(`\nMissing center_bore_mm: ${missingHub.rows.length}`);
    missingHub.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim || ''}`));
    
    const missingOffset = await client.query(`
      SELECT year, make, model, display_trim, offset_min_mm, offset_max_mm
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
        AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
      ORDER BY make, model, year
    `);
    console.log(`\nMissing offset range: ${missingOffset.rows.length}`);
    missingOffset.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim || ''}`));
    
    const missingTires = await client.query(`
      SELECT year, make, model, display_trim, oem_tire_sizes
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null' OR oem_tire_sizes::text = '""')
      ORDER BY make, model, year
    `);
    console.log(`\nMissing oem_tire_sizes: ${missingTires.rows.length}`);
    missingTires.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim || ''} - tires: ${JSON.stringify(r.oem_tire_sizes)}`));
    
    // 2. Find suspicious/invalid bolt patterns
    console.log('\n\n--- SUSPICIOUS BOLT PATTERNS ---\n');
    const suspiciousBolt = await client.query(`
      SELECT DISTINCT bolt_pattern, COUNT(*) as cnt
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
      GROUP BY bolt_pattern
      ORDER BY bolt_pattern
    `);
    console.log('All bolt patterns found:');
    suspiciousBolt.rows.forEach(r => {
      const flag = (!r.bolt_pattern || !r.bolt_pattern.match(/^\d+x\d+(\.\d+)?$/)) ? ' ⚠️ SUSPICIOUS' : '';
      console.log(`  ${r.bolt_pattern || '(null)'}: ${r.cnt} records${flag}`);
    });
    
    // 3. Find model name inconsistencies (case differences)
    console.log('\n\n--- MODEL NAME INCONSISTENCIES ---\n');
    const modelNames = await client.query(`
      SELECT make, model, COUNT(*) as cnt
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
      GROUP BY make, model
      ORDER BY make, LOWER(model)
    `);
    
    // Group by make and find duplicates
    const byMake = {};
    modelNames.rows.forEach(r => {
      if (!byMake[r.make]) byMake[r.make] = [];
      byMake[r.make].push({ model: r.model, cnt: parseInt(r.cnt) });
    });
    
    const duplicates = [];
    Object.entries(byMake).forEach(([make, models]) => {
      const normalized = {};
      models.forEach(m => {
        const key = m.model.toLowerCase().replace(/[-_\s]+/g, '');
        if (!normalized[key]) normalized[key] = [];
        normalized[key].push(m);
      });
      Object.entries(normalized).forEach(([key, variants]) => {
        if (variants.length > 1) {
          duplicates.push({ make, variants });
        }
      });
    });
    
    if (duplicates.length > 0) {
      console.log('Found model name duplicates (same model, different casing/formatting):');
      duplicates.forEach(d => {
        console.log(`\n  ${d.make}:`);
        d.variants.forEach(v => console.log(`    "${v.model}" (${v.cnt} records)`));
      });
    } else {
      console.log('No model name duplicates found.');
    }
    
    // 4. Check for obviously wrong hub bores (out of typical range)
    console.log('\n\n--- SUSPICIOUS HUB BORE VALUES ---\n');
    const suspiciousHub = await client.query(`
      SELECT year, make, model, display_trim, center_bore_mm
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
        AND (center_bore_mm < 50 OR center_bore_mm > 130)
      ORDER BY center_bore_mm
    `);
    console.log(`Hub bore outside typical range (50-130mm): ${suspiciousHub.rows.length}`);
    suspiciousHub.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} - ${r.center_bore_mm}mm`));
    
    // 5. Check for obviously wrong offsets
    console.log('\n\n--- SUSPICIOUS OFFSET VALUES ---\n');
    const suspiciousOffset = await client.query(`
      SELECT year, make, model, display_trim, offset_min_mm, offset_max_mm
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
        AND (offset_min_mm < -50 OR offset_max_mm > 70 OR offset_min_mm > offset_max_mm)
      ORDER BY make, model, year
    `);
    console.log(`Offsets outside typical range or inverted: ${suspiciousOffset.rows.length}`);
    suspiciousOffset.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} - offset: ${r.offset_min_mm} to ${r.offset_max_mm}`));
    
    // Summary
    console.log('\n\n=== SUMMARY ===');
    const total = await client.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE year >= 1980 AND year <= 1990`);
    console.log(`Total classic records (1980-1990): ${total.rows[0].cnt}`);
    console.log(`Missing bolt_pattern: ${missingBolt.rows.length}`);
    console.log(`Missing center_bore_mm: ${missingHub.rows.length}`);
    console.log(`Missing offset range: ${missingOffset.rows.length}`);
    console.log(`Missing oem_tire_sizes: ${missingTires.rows.length}`);
    console.log(`Model name duplicates: ${duplicates.length} sets`);
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
