import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  SELECT year, make, model, display_trim, oem_wheel_sizes
  FROM vehicle_fitments
  WHERE (make = 'Dodge' AND model = 'Challenger') OR (make = 'Ford' AND model = 'Mustang')
  AND year >= 2020
  ORDER BY make, model, display_trim, year
`);

console.log('=== STAGGERED VERIFICATION (by width delta) ===\n');

let staggeredCount = 0;
let squareCount = 0;

for (const row of result.rows) {
  const wheels = row.oem_wheel_sizes || [];
  const frontWidth = wheels.find(w => w.axle === 'front')?.width;
  const rearWidth = wheels.find(w => w.axle === 'rear')?.width;
  const widthDelta = Math.abs((frontWidth || 0) - (rearWidth || 0));
  const isStaggered = widthDelta > 0 && frontWidth && rearWidth;
  
  if (isStaggered) {
    staggeredCount++;
    console.log(`✓ STAGGERED: ${row.year} ${row.make} ${row.model} ${row.display_trim} (F=${frontWidth}" R=${rearWidth}" Δ=${widthDelta}")`);
  } else {
    squareCount++;
    console.log(`○ square:    ${row.year} ${row.make} ${row.model} ${row.display_trim} (width=${frontWidth || rearWidth}")`);
  }
}

console.log(`\nTotal: ${staggeredCount} staggered, ${squareCount} square`);
await pool.end();
