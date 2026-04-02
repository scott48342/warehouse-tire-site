const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function audit() {
  // Total records
  const total = await pool.query(`SELECT COUNT(*) as count FROM vehicle_fitments`);
  console.log(`\n📊 FITMENT DATA COMPLETENESS AUDIT`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Total records: ${total.rows[0].count}\n`);

  // Check scalar fields
  const scalarFields = [
    { name: 'center_bore_mm', label: 'Centerbore' },
    { name: 'bolt_pattern', label: 'Bolt Pattern' },
    { name: 'offset_min_mm', label: 'Offset Min' },
    { name: 'offset_max_mm', label: 'Offset Max' },
    { name: 'thread_size', label: 'Thread Size' },
    { name: 'seat_type', label: 'Seat Type' },
  ];

  console.log(`FIELD                    | MISSING | % COMPLETE`);
  console.log(`─────────────────────────┼─────────┼───────────`);

  const issues = [];
  const totalCount = parseInt(total.rows[0].count);
  
  for (const field of scalarFields) {
    const result = await pool.query(`
      SELECT COUNT(*) as missing 
      FROM vehicle_fitments 
      WHERE ${field.name} IS NULL
    `);
    const missing = parseInt(result.rows[0].missing);
    const pct = ((totalCount - missing) / totalCount * 100).toFixed(1);
    const status = missing === 0 ? '✅' : (parseFloat(pct) < 90 ? '🔴' : '⚠️');
    console.log(`${status} ${field.label.padEnd(21)} | ${String(missing).padStart(7)} | ${pct}%`);
    
    if (missing > 0) {
      issues.push({ field: field.name, label: field.label, missing, pct });
    }
  }

  // Check JSONB array fields
  console.log(`─────────────────────────┼─────────┼───────────`);
  
  const jsonFields = [
    { name: 'oem_wheel_sizes', label: 'OEM Wheel Sizes' },
    { name: 'oem_tire_sizes', label: 'OEM Tire Sizes' },
  ];

  for (const field of jsonFields) {
    const result = await pool.query(`
      SELECT COUNT(*) as missing 
      FROM vehicle_fitments 
      WHERE ${field.name} IS NULL OR ${field.name} = '[]'::jsonb
    `);
    const missing = parseInt(result.rows[0].missing);
    const pct = ((totalCount - missing) / totalCount * 100).toFixed(1);
    const status = missing === 0 ? '✅' : (parseFloat(pct) < 90 ? '🔴' : '⚠️');
    console.log(`${status} ${field.label.padEnd(21)} | ${String(missing).padStart(7)} | ${pct}%`);
    
    if (missing > 0) {
      issues.push({ field: field.name, label: field.label, missing, pct, isJson: true });
    }
  }

  // Sample vehicles for critical issues
  console.log(`\n\n📋 SAMPLE VEHICLES WITH MISSING DATA`);
  console.log(`═══════════════════════════════════════════════════════════════`);

  for (const issue of issues.filter(i => parseFloat(i.pct) < 80)) {
    console.log(`\n🔍 ${issue.label} (${issue.missing} missing, ${issue.pct}% complete):`);
    const condition = issue.isJson 
      ? `${issue.field} IS NULL OR ${issue.field} = '[]'::jsonb`
      : `${issue.field} IS NULL`;
    const samples = await pool.query(`
      SELECT DISTINCT year, make, model, display_trim
      FROM vehicle_fitments 
      WHERE ${condition}
      ORDER BY year DESC, make, model
      LIMIT 20
    `);
    samples.rows.forEach(r => {
      console.log(`   ${r.year} ${r.make} ${r.model} ${r.display_trim || ''}`);
    });
    if (issue.missing > 20) console.log(`   ... and ${issue.missing - 20} more`);
  }

  // Year breakdown for critical fields
  console.log(`\n\n📅 GAPS BY DECADE`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  
  const decades = await pool.query(`
    SELECT 
      FLOOR(year / 10) * 10 as decade,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE center_bore_mm IS NULL) as cb_missing,
      COUNT(*) FILTER (WHERE offset_min_mm IS NULL) as offset_missing,
      COUNT(*) FILTER (WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb) as wheel_missing,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb) as tire_missing
    FROM vehicle_fitments
    GROUP BY FLOOR(year / 10) * 10
    ORDER BY decade
  `);
  
  console.log(`\nDECADE | TOTAL | CB MISS | OFFSET MISS | WHEEL MISS | TIRE MISS`);
  console.log(`───────┼───────┼─────────┼─────────────┼────────────┼──────────`);
  decades.rows.forEach(r => {
    console.log(`${r.decade}s  | ${String(r.total).padStart(5)} | ${String(r.cb_missing).padStart(7)} | ${String(r.offset_missing).padStart(11)} | ${String(r.wheel_missing).padStart(10)} | ${String(r.tire_missing).padStart(8)}`);
  });

  // Brand breakdown for modern vehicles (2000+)
  console.log(`\n\n🏭 MODERN (2000+) GAPS BY MAKE (TOP 15)`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  
  const makes = await pool.query(`
    SELECT 
      make,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE center_bore_mm IS NULL) as cb_missing,
      COUNT(*) FILTER (WHERE offset_min_mm IS NULL) as offset_missing
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY make
    HAVING COUNT(*) FILTER (WHERE center_bore_mm IS NULL) > 0 
        OR COUNT(*) FILTER (WHERE offset_min_mm IS NULL) > 0
    ORDER BY COUNT(*) FILTER (WHERE center_bore_mm IS NULL) + COUNT(*) FILTER (WHERE offset_min_mm IS NULL) DESC
    LIMIT 15
  `);
  
  console.log(`\nMAKE          | TOTAL | CB MISS | OFFSET MISS`);
  console.log(`──────────────┼───────┼─────────┼────────────`);
  makes.rows.forEach(r => {
    console.log(`${r.make.padEnd(13)} | ${String(r.total).padStart(5)} | ${String(r.cb_missing).padStart(7)} | ${String(r.offset_missing).padStart(10)}`);
  });

  await pool.end();
}

audit().catch(e => { console.error(e); process.exit(1); });
