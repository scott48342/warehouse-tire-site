/**
 * Verify duplicate detection is working correctly
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const railway = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  // Get 2022 Tahoe from Railway
  console.log('Railway wheel specs for 2022 Chevrolet Tahoe:');
  const rwRes = await railway.query(`
    SELECT v.year, v.make, v.model, v.trim,
           ws.rim_diameter, ws.rim_width, ws.offset
    FROM vehicle_wheel_specs ws
    JOIN vehicles v ON v.id = ws.vehicle_id
    WHERE v.year = 2022 AND LOWER(v.make) = 'chevrolet' AND LOWER(v.model) = 'tahoe'
  `);
  console.log('Railway has', rwRes.rows.length, 'wheel specs for 2022 Tahoe:');
  for (const r of rwRes.rows) {
    console.log(`  ${r.trim}: ${r.rim_width}x${r.rim_diameter} offset ${r.offset}`);
  }

  // Get ALL 2022 Tahoe trims from Prisma
  console.log('\nPrisma 2022 Tahoe trims:');
  const prRes = await prisma.query(`
    SELECT id, display_trim, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE year = 2022 AND make = 'chevrolet' AND model = 'tahoe'
  `);
  for (const r of prRes.rows) {
    const wheels = r.oem_wheel_sizes || [];
    const sizes = wheels.map(w => {
      if (typeof w === 'string') {
        const match = w.match(/(\d+(?:\.\d+)?)[Jj]?[xX](\d+(?:\.\d+)?)/);
        return match ? `${match[1]}x${match[2]}` : w;
      }
      return `${w.width}x${w.diameter}`;
    });
    console.log(`  ${r.display_trim}: [${sizes.join(', ')}]`);
  }

  // Now check: does the "Base" trim exist and what does it have?
  console.log('\nBase trim detail:');
  const baseRes = await prisma.query(`
    SELECT display_trim, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE year = 2022 AND make = 'chevrolet' AND model = 'tahoe' 
      AND display_trim = 'Base'
  `);
  if (baseRes.rows.length > 0) {
    console.log('  Found Base trim');
    console.log('  Wheels:', JSON.stringify(baseRes.rows[0].oem_wheel_sizes, null, 2));
  } else {
    console.log('  No "Base" trim found - checking all trims:');
    const allRes = await prisma.query(`
      SELECT DISTINCT display_trim
      FROM vehicle_fitments
      WHERE year = 2022 AND make = 'chevrolet' AND model = 'tahoe'
    `);
    console.log('  Trims:', allRes.rows.map(r => r.display_trim).join(', '));
  }

  await prisma.end();
  await railway.end();
}

main().catch(console.error);
