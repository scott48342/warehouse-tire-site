/**
 * Platform-Based Spec Inheritance
 * 
 * Fills missing centerbore, offset, thread_size, seat_type based on
 * make + bolt_pattern combinations that already have complete data.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function run() {
  console.log(`\n🔧 PLATFORM-BASED SPEC INHERITANCE`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  // Step 1: Find make+bolt_pattern combos with known specs
  console.log(`📊 Analyzing existing data for inheritance candidates...\n`);
  
  const platformSpecs = await pool.query(`
    WITH platform_stats AS (
      SELECT 
        make,
        bolt_pattern,
        -- Centerbore: most common value
        MODE() WITHIN GROUP (ORDER BY center_bore_mm) as cb_mode,
        COUNT(*) FILTER (WHERE center_bore_mm IS NOT NULL) as cb_count,
        COUNT(*) FILTER (WHERE center_bore_mm IS NULL) as cb_missing,
        -- Offset: use min/max from existing
        MIN(offset_min_mm) FILTER (WHERE offset_min_mm IS NOT NULL) as offset_min,
        MAX(offset_max_mm) FILTER (WHERE offset_max_mm IS NOT NULL) as offset_max,
        COUNT(*) FILTER (WHERE offset_min_mm IS NOT NULL) as offset_count,
        COUNT(*) FILTER (WHERE offset_min_mm IS NULL) as offset_missing,
        -- Thread size: most common
        MODE() WITHIN GROUP (ORDER BY thread_size) as thread_mode,
        COUNT(*) FILTER (WHERE thread_size IS NOT NULL) as thread_count,
        COUNT(*) FILTER (WHERE thread_size IS NULL) as thread_missing,
        -- Seat type: most common
        MODE() WITHIN GROUP (ORDER BY seat_type) as seat_mode,
        COUNT(*) FILTER (WHERE seat_type IS NOT NULL) as seat_count,
        COUNT(*) FILTER (WHERE seat_type IS NULL) as seat_missing,
        COUNT(*) as total
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      GROUP BY make, bolt_pattern
    )
    SELECT * FROM platform_stats
    WHERE cb_count >= 3 OR offset_count >= 3 OR thread_count >= 3 OR seat_count >= 3
    ORDER BY cb_missing + offset_missing DESC
  `);

  console.log(`Found ${platformSpecs.rows.length} make+bolt_pattern combinations with fillable gaps\n`);

  // Step 2: Apply inheritance
  let totalCbFilled = 0;
  let totalOffsetFilled = 0;
  let totalThreadFilled = 0;
  let totalSeatFilled = 0;

  for (const platform of platformSpecs.rows) {
    const { make, bolt_pattern, cb_mode, cb_missing, offset_min, offset_max, offset_missing,
            thread_mode, thread_missing, seat_mode, seat_missing } = platform;

    // Fill centerbore
    if (cb_mode && parseInt(cb_missing) > 0) {
      const result = await pool.query(`
        UPDATE vehicle_fitments 
        SET center_bore_mm = $1
        WHERE make = $2 AND bolt_pattern = $3 AND center_bore_mm IS NULL
        RETURNING id
      `, [cb_mode, make, bolt_pattern]);
      if (result.rowCount > 0) {
        totalCbFilled += result.rowCount;
        console.log(`✅ ${make} ${bolt_pattern}: ${result.rowCount} centerbore → ${cb_mode}mm`);
      }
    }

    // Fill offset
    if (offset_min && offset_max && parseInt(offset_missing) > 0) {
      const result = await pool.query(`
        UPDATE vehicle_fitments 
        SET offset_min_mm = $1, offset_max_mm = $2
        WHERE make = $3 AND bolt_pattern = $4 AND offset_min_mm IS NULL
        RETURNING id
      `, [offset_min, offset_max, make, bolt_pattern]);
      if (result.rowCount > 0) {
        totalOffsetFilled += result.rowCount;
        console.log(`✅ ${make} ${bolt_pattern}: ${result.rowCount} offset → ${offset_min}-${offset_max}mm`);
      }
    }

    // Fill thread size
    if (thread_mode && parseInt(thread_missing) > 0) {
      const result = await pool.query(`
        UPDATE vehicle_fitments 
        SET thread_size = $1
        WHERE make = $2 AND bolt_pattern = $3 AND thread_size IS NULL
        RETURNING id
      `, [thread_mode, make, bolt_pattern]);
      if (result.rowCount > 0) {
        totalThreadFilled += result.rowCount;
      }
    }

    // Fill seat type
    if (seat_mode && parseInt(seat_missing) > 0) {
      const result = await pool.query(`
        UPDATE vehicle_fitments 
        SET seat_type = $1
        WHERE make = $2 AND bolt_pattern = $3 AND seat_type IS NULL
        RETURNING id
      `, [seat_mode, make, bolt_pattern]);
      if (result.rowCount > 0) {
        totalSeatFilled += result.rowCount;
      }
    }
  }

  console.log(`\n${'─'.repeat(65)}`);
  console.log(`\n📈 INHERITANCE RESULTS (Pass 1 - Make + Bolt Pattern)`);
  console.log(`   Centerbore filled: ${totalCbFilled}`);
  console.log(`   Offset filled:     ${totalOffsetFilled}`);
  console.log(`   Thread size filled: ${totalThreadFilled}`);
  console.log(`   Seat type filled:  ${totalSeatFilled}`);

  // Step 3: Second pass - bolt pattern only (cross-make inheritance)
  console.log(`\n\n🔧 PASS 2: Cross-make inheritance by bolt pattern only...\n`);

  const boltSpecs = await pool.query(`
    WITH bolt_stats AS (
      SELECT 
        bolt_pattern,
        MODE() WITHIN GROUP (ORDER BY center_bore_mm) as cb_mode,
        COUNT(*) FILTER (WHERE center_bore_mm IS NOT NULL) as cb_count,
        MIN(offset_min_mm) FILTER (WHERE offset_min_mm IS NOT NULL) as offset_min,
        MAX(offset_max_mm) FILTER (WHERE offset_max_mm IS NOT NULL) as offset_max,
        COUNT(*) FILTER (WHERE offset_min_mm IS NOT NULL) as offset_count,
        MODE() WITHIN GROUP (ORDER BY thread_size) as thread_mode,
        COUNT(*) FILTER (WHERE thread_size IS NOT NULL) as thread_count,
        MODE() WITHIN GROUP (ORDER BY seat_type) as seat_mode,
        COUNT(*) FILTER (WHERE seat_type IS NOT NULL) as seat_count
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      GROUP BY bolt_pattern
    )
    SELECT * FROM bolt_stats
    WHERE cb_count >= 10 OR offset_count >= 10
  `);

  let pass2Cb = 0, pass2Offset = 0, pass2Thread = 0, pass2Seat = 0;

  for (const bolt of boltSpecs.rows) {
    const { bolt_pattern, cb_mode, offset_min, offset_max, thread_mode, seat_mode } = bolt;

    // Only fill if we have strong consensus (10+ records)
    if (cb_mode) {
      const result = await pool.query(`
        UPDATE vehicle_fitments 
        SET center_bore_mm = $1
        WHERE bolt_pattern = $2 AND center_bore_mm IS NULL
        RETURNING id
      `, [cb_mode, bolt_pattern]);
      if (result.rowCount > 0) {
        pass2Cb += result.rowCount;
        console.log(`✅ ${bolt_pattern}: ${result.rowCount} centerbore → ${cb_mode}mm (cross-make)`);
      }
    }

    if (offset_min && offset_max) {
      const result = await pool.query(`
        UPDATE vehicle_fitments 
        SET offset_min_mm = $1, offset_max_mm = $2
        WHERE bolt_pattern = $3 AND offset_min_mm IS NULL
        RETURNING id
      `, [offset_min, offset_max, bolt_pattern]);
      if (result.rowCount > 0) {
        pass2Offset += result.rowCount;
        console.log(`✅ ${bolt_pattern}: ${result.rowCount} offset → ${offset_min}-${offset_max}mm (cross-make)`);
      }
    }

    if (thread_mode) {
      const result = await pool.query(`
        UPDATE vehicle_fitments SET thread_size = $1
        WHERE bolt_pattern = $2 AND thread_size IS NULL
        RETURNING id
      `, [thread_mode, bolt_pattern]);
      pass2Thread += result.rowCount;
    }

    if (seat_mode) {
      const result = await pool.query(`
        UPDATE vehicle_fitments SET seat_type = $1
        WHERE bolt_pattern = $2 AND seat_type IS NULL
        RETURNING id
      `, [seat_mode, bolt_pattern]);
      pass2Seat += result.rowCount;
    }
  }

  console.log(`\n${'─'.repeat(65)}`);
  console.log(`\n📈 CROSS-MAKE RESULTS (Pass 2)`);
  console.log(`   Centerbore filled: ${pass2Cb}`);
  console.log(`   Offset filled:     ${pass2Offset}`);
  console.log(`   Thread size filled: ${pass2Thread}`);
  console.log(`   Seat type filled:  ${pass2Seat}`);

  // Final summary
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`\n🎯 TOTAL FILLED`);
  console.log(`   Centerbore: ${totalCbFilled + pass2Cb}`);
  console.log(`   Offset:     ${totalOffsetFilled + pass2Offset}`);
  console.log(`   Thread:     ${totalThreadFilled + pass2Thread}`);
  console.log(`   Seat:       ${totalSeatFilled + pass2Seat}`);

  // Check remaining gaps
  console.log(`\n\n📊 REMAINING GAPS AFTER INHERITANCE`);
  console.log(`${'═'.repeat(65)}`);
  
  const remaining = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE center_bore_mm IS NULL) as cb_missing,
      COUNT(*) FILTER (WHERE offset_min_mm IS NULL) as offset_missing,
      COUNT(*) FILTER (WHERE thread_size IS NULL) as thread_missing,
      COUNT(*) FILTER (WHERE seat_type IS NULL) as seat_missing,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb) as tire_missing
    FROM vehicle_fitments
  `);

  const r = remaining.rows[0];
  const pct = (missing, total) => ((total - missing) / total * 100).toFixed(1);
  
  console.log(`\nFIELD          | MISSING | % COMPLETE`);
  console.log(`───────────────┼─────────┼───────────`);
  console.log(`Centerbore     | ${String(r.cb_missing).padStart(7)} | ${pct(r.cb_missing, r.total)}%`);
  console.log(`Offset         | ${String(r.offset_missing).padStart(7)} | ${pct(r.offset_missing, r.total)}%`);
  console.log(`Thread Size    | ${String(r.thread_missing).padStart(7)} | ${pct(r.thread_missing, r.total)}%`);
  console.log(`Seat Type      | ${String(r.seat_missing).padStart(7)} | ${pct(r.seat_missing, r.total)}%`);
  console.log(`OEM Tire Sizes | ${String(r.tire_missing).padStart(7)} | ${pct(r.tire_missing, r.total)}%`);

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
