require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== SEPARATING TRANS AM ===\n');
    
    // 1. Find all Firebird Trans Am trims
    const transAmTrims = await client.query(`
      SELECT id, year, make, model, display_trim, modification_id,
             bolt_pattern, center_bore_mm, thread_size, seat_type,
             offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
             quality_tier, confidence_tag, source
      FROM vehicle_fitments
      WHERE make = 'Pontiac' AND model ILIKE '%firebird%'
        AND display_trim ILIKE '%trans am%'
        AND year >= 1980 AND year <= 1990
      ORDER BY year, display_trim
    `);
    
    console.log(`Found ${transAmTrims.rows.length} Firebird Trans Am records to convert:\n`);
    
    // Group by trim for display
    const byTrim = {};
    transAmTrims.rows.forEach(r => {
      if (!byTrim[r.display_trim]) byTrim[r.display_trim] = [];
      byTrim[r.display_trim].push(r.year);
    });
    Object.entries(byTrim).forEach(([trim, years]) => {
      console.log(`  ${trim}: ${Math.min(...years)}-${Math.max(...years)} (${years.length} records)`);
    });
    
    if (!dryRun) {
      let created = 0;
      let updated = 0;
      
      for (const r of transAmTrims.rows) {
        // Determine new model name and trim
        let newModel = 'Trans Am';
        let newTrim = 'Base';
        
        if (r.display_trim.toLowerCase().includes('gta')) {
          newTrim = 'GTA';
        } else if (r.display_trim.toLowerCase().includes('se')) {
          newTrim = 'SE';
        } else if (r.display_trim.toLowerCase() === 'trans am') {
          newTrim = 'Base';
        }
        
        // Check if Trans Am record already exists for this year/trim
        const existing = await client.query(`
          SELECT id FROM vehicle_fitments
          WHERE make = 'Pontiac' AND model = 'Trans Am' 
            AND year = $1 AND COALESCE(display_trim, 'Base') = $2
        `, [r.year, newTrim]);
        
        if (existing.rows.length > 0) {
          console.log(`  Skipping ${r.year} Trans Am ${newTrim} - already exists`);
          continue;
        }
        
        // Create new Trans Am record
        const newModId = `pontiac-trans-am-${newTrim.toLowerCase()}-${uuidv4().slice(0, 8)}`;
        
        await client.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, display_trim, modification_id,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
            quality_tier, confidence_tag, source,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17,
            NOW(), NOW()
          )
        `, [
          uuidv4(), r.year, 'Pontiac', newModel, newTrim, newModId,
          r.bolt_pattern, r.center_bore_mm, r.thread_size, r.seat_type,
          r.offset_min_mm, r.offset_max_mm, JSON.stringify(r.oem_wheel_sizes), JSON.stringify(r.oem_tire_sizes),
          r.quality_tier, r.confidence_tag, 'manual-research'
        ]);
        created++;
        
        // Update old Firebird record - change trim to just "Formula" or "Base" if it was Trans Am
        // Actually, let's keep the Firebird records but remove Trans Am from them
        // No wait - we should delete the Trans Am trims from Firebird since they're now separate
        await client.query(`
          DELETE FROM vehicle_fitments WHERE id = $1
        `, [r.id]);
        updated++;
        
        console.log(`  ${r.year} Firebird "${r.display_trim}" -> Trans Am "${newTrim}"`);
      }
      
      console.log(`\n✅ Created ${created} Trans Am records`);
      console.log(`🗑️  Removed ${updated} Firebird Trans Am records`);
      
      // Verify final state
      const firebird = await client.query(`
        SELECT DISTINCT display_trim, COUNT(*) as cnt 
        FROM vehicle_fitments 
        WHERE make = 'Pontiac' AND model ILIKE '%firebird%' AND year >= 1980 AND year <= 1990
        GROUP BY display_trim ORDER BY display_trim
      `);
      const transam = await client.query(`
        SELECT DISTINCT display_trim, COUNT(*) as cnt 
        FROM vehicle_fitments 
        WHERE make = 'Pontiac' AND model = 'Trans Am' AND year >= 1980 AND year <= 1990
        GROUP BY display_trim ORDER BY display_trim
      `);
      
      console.log('\n--- Final State ---');
      console.log('\nPontiac Firebird trims:');
      firebird.rows.forEach(r => console.log(`  ${r.display_trim}: ${r.cnt} records`));
      console.log('\nPontiac Trans Am trims:');
      transam.rows.forEach(r => console.log(`  ${r.display_trim}: ${r.cnt} records`));
      
    } else {
      console.log('\nRun without --dry-run to apply changes.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
