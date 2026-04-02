const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function audit() {
  console.log('📊 BATCH 1 GAP AUDIT\n');
  console.log('═'.repeat(65) + '\n');

  const vehicles = [
    { make: 'ram', model: '1500', targetYears: [2000, 2008] },
    { make: 'toyota', model: 'highlander', targetYears: [2001, 2009] },
    { make: 'toyota', model: 'sienna', targetYears: [2000, 2018] },
    { make: 'honda', model: 'odyssey', targetYears: [2000, 2004] },
  ];

  for (const v of vehicles) {
    const existing = await pool.query(`
      SELECT year, COUNT(*) as trim_count, 
             array_agg(DISTINCT display_trim ORDER BY display_trim) as trims
      FROM vehicle_fitments 
      WHERE LOWER(make) = $1 AND LOWER(model) = $2
      GROUP BY year
      ORDER BY year
    `, [v.make.toLowerCase(), v.model.toLowerCase()]);

    console.log(`\n🚗 ${v.make.toUpperCase()} ${v.model.toUpperCase()}`);
    console.log(`   Target gap: ${v.targetYears[0]}-${v.targetYears[1]}`);
    console.log(`   Existing years in DB:`);
    
    const existingYears = new Set(existing.rows.map(r => r.year));
    const gapYears = [];
    
    for (let y = v.targetYears[0]; y <= v.targetYears[1]; y++) {
      if (!existingYears.has(y)) {
        gapYears.push(y);
      }
    }

    if (existing.rows.length === 0) {
      console.log(`   (none)`);
    } else {
      existing.rows.forEach(r => {
        const inTarget = r.year >= v.targetYears[0] && r.year <= v.targetYears[1];
        const marker = inTarget ? '✓' : ' ';
        console.log(`   ${marker} ${r.year}: ${r.trim_count} trim(s) - ${r.trims.slice(0,3).join(', ')}${r.trims.length > 3 ? '...' : ''}`);
      });
    }

    console.log(`\n   📋 GAPS TO FILL: ${gapYears.length > 0 ? gapYears.join(', ') : 'NONE'}`);
    
    // Get sample specs from existing data for this model
    if (existing.rows.length > 0) {
      const specs = await pool.query(`
        SELECT DISTINCT bolt_pattern, center_bore_mm, thread_size, seat_type
        FROM vehicle_fitments 
        WHERE LOWER(make) = $1 AND LOWER(model) = $2
        LIMIT 1
      `, [v.make.toLowerCase(), v.model.toLowerCase()]);
      
      if (specs.rows.length > 0) {
        const s = specs.rows[0];
        console.log(`   🔧 Inherited specs: ${s.bolt_pattern}, CB: ${s.center_bore_mm}mm, ${s.thread_size}, ${s.seat_type}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(65));
  await pool.end();
}

audit().catch(e => { console.error(e); process.exit(1); });
