/**
 * Tire Size Inheritance
 * 
 * Fills missing oem_tire_sizes by inheriting from same make+model records
 * that already have tire data. Uses wheel sizes as a secondary match key.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function run() {
  console.log('\n🛞 TIRE SIZE INHERITANCE\n');
  console.log('═'.repeat(65) + '\n');

  let totalFilled = 0;

  // Pass 1: Inherit by make+model+wheel_sizes (exact wheel match)
  console.log('📊 Pass 1: Same make + model + wheel sizes (exact match)\n');

  const wheelMatches = await pool.query(`
    WITH source_tires AS (
      SELECT DISTINCT make, model, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments
      WHERE oem_tire_sizes IS NOT NULL 
        AND oem_tire_sizes != '[]'::jsonb
        AND oem_wheel_sizes IS NOT NULL
        AND oem_wheel_sizes != '[]'::jsonb
    )
    SELECT 
      vf.id, vf.year, vf.make, vf.model, vf.display_trim,
      st.oem_tire_sizes as source_tires
    FROM vehicle_fitments vf
    JOIN source_tires st ON vf.make = st.make 
                        AND vf.model = st.model 
                        AND vf.oem_wheel_sizes = st.oem_wheel_sizes
    WHERE (vf.oem_tire_sizes IS NULL OR vf.oem_tire_sizes = '[]'::jsonb)
  `);

  if (wheelMatches.rows.length > 0) {
    for (const row of wheelMatches.rows) {
      await pool.query(
        'UPDATE vehicle_fitments SET oem_tire_sizes = $1::jsonb WHERE id = $2',
        [JSON.stringify(row.source_tires), row.id]
      );
    }
    console.log(`✅ Filled ${wheelMatches.rows.length} records by exact wheel match\n`);
    totalFilled += wheelMatches.rows.length;
  }

  // Pass 2: Inherit by make+model (most common tire sizes for that model)
  console.log('📊 Pass 2: Same make + model (most common tire sizes)\n');

  const modelTires = await pool.query(`
    WITH model_tire_stats AS (
      SELECT 
        make, model, oem_tire_sizes,
        COUNT(*) as usage_count
      FROM vehicle_fitments
      WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb
      GROUP BY make, model, oem_tire_sizes
    ),
    best_tires AS (
      SELECT DISTINCT ON (make, model) 
        make, model, oem_tire_sizes, usage_count
      FROM model_tire_stats
      WHERE usage_count >= 3  -- Only use if 3+ records have this combo
      ORDER BY make, model, usage_count DESC
    )
    SELECT make, model, oem_tire_sizes, usage_count
    FROM best_tires
  `);

  let pass2Filled = 0;
  for (const tire of modelTires.rows) {
    // oem_tire_sizes is already a JSON object from the query, pass as-is
    const result = await pool.query(`
      UPDATE vehicle_fitments 
      SET oem_tire_sizes = $1::jsonb
      WHERE make = $2 AND model = $3 
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      RETURNING id
    `, [JSON.stringify(tire.oem_tire_sizes), tire.make, tire.model]);
    
    if (result.rowCount > 0) {
      pass2Filled += result.rowCount;
      console.log(`✅ ${tire.make} ${tire.model}: ${result.rowCount} records filled`);
    }
  }
  console.log(`\n   Pass 2 total: ${pass2Filled}\n`);
  totalFilled += pass2Filled;

  // Pass 3: Generic wheel diameter → tire size mappings for remaining gaps
  console.log('📊 Pass 3: Generic wheel diameter mappings\n');

  // Common wheel-to-tire mappings by diameter
  const diameterMappings = {
    '15': ['205/65R15', '215/65R15', '225/70R15'],
    '16': ['205/55R16', '215/60R16', '225/60R16', '235/70R16'],
    '17': ['215/50R17', '225/55R17', '235/65R17', '245/65R17', '265/70R17'],
    '18': ['225/45R18', '235/50R18', '245/60R18', '265/65R18', '275/70R18'],
    '19': ['235/40R19', '245/45R19', '255/45R19', '275/55R19'],
    '20': ['245/40R20', '255/45R20', '265/50R20', '275/55R20', '275/60R20'],
    '21': ['255/35R21', '265/40R21', '275/45R21'],
    '22': ['265/35R22', '275/40R22', '285/45R22'],
  };

  // For records still missing tires but have wheel sizes, extract diameter and apply generic
  const remainingGaps = await pool.query(`
    SELECT id, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      AND oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes != '[]'::jsonb
  `);

  let pass3Filled = 0;
  for (const row of remainingGaps.rows) {
    const wheels = row.oem_wheel_sizes;
    // Extract diameters from wheel sizes
    let diameters = [];
    
    if (Array.isArray(wheels)) {
      for (const w of wheels) {
        if (typeof w === 'object' && w.diameter) {
          diameters.push(String(w.diameter));
        } else if (typeof w === 'string') {
          // Parse "8Jx17" or "17x8" formats
          const match = w.match(/(\d{2})/);
          if (match && parseInt(match[1]) >= 14 && parseInt(match[1]) <= 24) {
            diameters.push(match[1]);
          }
        }
      }
    }

    if (diameters.length > 0) {
      // Build tire sizes from diameters
      const tireSizes = [];
      for (const d of [...new Set(diameters)]) {
        if (diameterMappings[d]) {
          tireSizes.push(...diameterMappings[d]);
        }
      }
      
      if (tireSizes.length > 0) {
        await pool.query(
          'UPDATE vehicle_fitments SET oem_tire_sizes = $1 WHERE id = $2',
          [JSON.stringify([...new Set(tireSizes)]), row.id]
        );
        pass3Filled++;
      }
    }
  }
  console.log(`✅ Pass 3: ${pass3Filled} records filled with generic diameter mappings\n`);
  totalFilled += pass3Filled;

  // Final stats
  console.log('═'.repeat(65));
  console.log(`\n🎯 TOTAL FILLED: ${totalFilled}\n`);

  const final = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb) as has_tires,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb) as missing
    FROM vehicle_fitments
  `);

  const f = final.rows[0];
  console.log(`📊 FINAL TIRE COVERAGE`);
  console.log(`   Has tire data: ${f.has_tires}/${f.total} (${(f.has_tires/f.total*100).toFixed(1)}%)`);
  console.log(`   Still missing: ${f.missing}`);

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
