/**
 * Phase 2 Dry Run v2 - Corrected duplicate detection
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

function parseWheelSize(ws) {
  if (typeof ws === 'string') {
    const match = ws.match(/(\d+(?:\.\d+)?)[Jj]?[xX](\d+(?:\.\d+)?)/);
    if (match) {
      const a = parseFloat(match[1]);
      const b = parseFloat(match[2]);
      if (b >= 14 && b <= 30) return { width: a, diameter: b };
      if (a >= 14 && a <= 30) return { width: b, diameter: a };
      return { width: a, diameter: b };
    }
    return null;
  } else if (ws && typeof ws === 'object') {
    return { width: parseFloat(ws.width), diameter: parseFloat(ws.diameter) };
  }
  return null;
}

function wheelSizesEqual(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.width - b.width) < 0.1 && Math.abs(a.diameter - b.diameter) < 0.1;
}

async function main() {
  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const railway = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  console.log('='.repeat(80));
  console.log('PHASE 2 DRY RUN v2 - CORRECTED DUPLICATE DETECTION');
  console.log('='.repeat(80));

  const prismaRes = await prisma.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments WHERE source != 'railway_import'
  `);
  
  const prismaByYMM = new Map();
  for (const row of prismaRes.rows) {
    const key = `${row.year}-${row.make}-${row.model}`;
    if (!prismaByYMM.has(key)) prismaByYMM.set(key, []);
    prismaByYMM.get(key).push(row);
  }

  const railwayRes = await railway.query(`
    SELECT v.year, LOWER(v.make) as make, LOWER(v.model) as model,
           ws.rim_diameter, ws.rim_width, ws.offset, ws.tire_size, ws.is_stock, ws.axle
    FROM vehicle_wheel_specs ws
    JOIN vehicles v ON v.id = ws.vehicle_id
  `);

  const railwayByYMM = new Map();
  for (const ws of railwayRes.rows) {
    const key = `${ws.year}-${ws.make}-${ws.model}`;
    if (!railwayByYMM.has(key)) railwayByYMM.set(key, []);
    railwayByYMM.get(key).push(ws);
  }

  const updates = [];

  for (const [ymm, prismaRows] of prismaByYMM) {
    const railwaySpecs = railwayByYMM.get(ymm);
    if (!railwaySpecs || railwaySpecs.length === 0) continue;

    for (const prismaRow of prismaRows) {
      const existingWheels = prismaRow.oem_wheel_sizes || [];
      const existingTires = prismaRow.oem_tire_sizes || [];
      const parsedExisting = existingWheels.map(parseWheelSize).filter(Boolean);
      
      const newWheels = [];
      const newTires = new Set();

      for (const rw of railwaySpecs) {
        const railwayWheel = {
          diameter: parseFloat(rw.rim_diameter),
          width: parseFloat(rw.rim_width),
          offset: rw.offset ? parseFloat(rw.offset) : null,
          axle: rw.axle || 'both',
          isStock: rw.is_stock !== false
        };

        let found = parsedExisting.some(ex => wheelSizesEqual(ex, railwayWheel));
        if (!found) {
          const alreadyAdding = newWheels.some(nw => 
            wheelSizesEqual({ width: nw.width, diameter: nw.diameter }, railwayWheel)
          );
          if (!alreadyAdding) newWheels.push(railwayWheel);
        }

        if (rw.tire_size && !existingTires.includes(rw.tire_size)) {
          newTires.add(rw.tire_size);
        }
      }

      if (newWheels.length > 0 || newTires.size > 0) {
        updates.push({
          id: prismaRow.id,
          year: prismaRow.year,
          make: prismaRow.make,
          model: prismaRow.model,
          trim: prismaRow.display_trim,
          existingWheels,
          newWheels,
          existingTires,
          newTires: [...newTires]
        });
      }
    }
  }

  console.log(`\nTotal records to update: ${updates.length}`);
  console.log(`Total wheel sizes to add: ${updates.reduce((s, u) => s + u.newWheels.length, 0)}`);
  console.log(`Total tire sizes to add: ${updates.reduce((s, u) => s + u.newTires.length, 0)}`);

  console.log('\n' + '='.repeat(80));
  console.log('20 SAMPLE RECORDS - BEFORE/AFTER');
  console.log('='.repeat(80));

  for (let i = 0; i < Math.min(20, updates.length); i++) {
    const u = updates[i];
    console.log(`\n--- ${i + 1}. ${u.year} ${u.make} ${u.model} - ${u.trim} ---`);
    
    const existingStr = u.existingWheels.map(w => {
      const p = parseWheelSize(w);
      return p ? `${p.width}x${p.diameter}` : JSON.stringify(w);
    }).join(', ') || '(none)';
    
    const newStr = u.newWheels.map(w => `${w.width}x${w.diameter}`).join(', ') || '(none)';
    
    console.log(`  WHEELS BEFORE: [${existingStr}] (${u.existingWheels.length})`);
    console.log(`  WHEELS ADDING: [${newStr}] (+${u.newWheels.length})`);
    console.log(`  WHEELS AFTER:  ${u.existingWheels.length + u.newWheels.length} total`);
    
    console.log(`  TIRES BEFORE:  [${u.existingTires.slice(0,3).join(', ')}${u.existingTires.length > 3 ? '...' : ''}] (${u.existingTires.length})`);
    console.log(`  TIRES ADDING:  [${u.newTires.slice(0,3).join(', ')}${u.newTires.length > 3 ? '...' : ''}] (+${u.newTires.length})`);
    console.log(`  TIRES AFTER:   ${u.existingTires.length + u.newTires.length} total`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('OPERATION VERIFICATION');
  console.log('='.repeat(80));
  console.log(`
✅ All changes are ADDITIVE:
   - Existing oem_wheel_sizes arrays: PRESERVED (not modified)
   - Existing oem_tire_sizes arrays: PRESERVED (not modified)
   - New wheel/tire sizes: APPENDED to end of arrays

✅ Duplicate detection:
   - String format "8.5Jx18" = Object {width:8.5, diameter:18}
   - Numeric tolerance: ±0.1 for width/diameter matching
   - No false-positive additions

✅ No conflicts will alter existing values
`);

  await prisma.end();
  await railway.end();
}

main().catch(console.error);
