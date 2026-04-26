import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;
const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

console.log('=== AUDIT: Tire/Wheel Diameter Mismatches ===\n');

// Get records with both wheel and tire data
const records = await client.query(`
  SELECT id, year, make, model, trim, "wheelDiameter", "rearWheelDiameter", "tireSize", "rearTireSize"
  FROM vehicle_fitments
  WHERE "wheelDiameter" IS NOT NULL 
    AND ("tireSize" IS NOT NULL OR "rearTireSize" IS NOT NULL)
  LIMIT 5000
`);

function extractDiameter(tireSize) {
  if (!tireSize) return null;
  // Handle array format
  if (Array.isArray(tireSize)) {
    return tireSize.map(t => extractDiameter(t)).filter(Boolean);
  }
  // Handle string like "265/70R17" or "P265/70R17" or "35x12.50R17"
  const match = String(tireSize).match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

let mismatches = [];
let samples = [];

for (const row of records.rows) {
  const wheelDia = row.wheelDiameter;
  const rearWheelDia = row.rearWheelDiameter || wheelDia;
  
  let frontTires = row.tireSize;
  let rearTires = row.rearTireSize;
  
  // Parse tire arrays if stored as JSON string
  if (typeof frontTires === 'string' && frontTires.startsWith('[')) {
    try { frontTires = JSON.parse(frontTires); } catch(e) {}
  }
  if (typeof rearTires === 'string' && rearTires.startsWith('[')) {
    try { rearTires = JSON.parse(rearTires); } catch(e) {}
  }
  
  // Check front tire compatibility
  const frontDiameters = Array.isArray(frontTires) 
    ? frontTires.map(t => extractDiameter(t)).filter(Boolean)
    : [extractDiameter(frontTires)].filter(Boolean);
  
  const rearDiameters = Array.isArray(rearTires)
    ? rearTires.map(t => extractDiameter(t)).filter(Boolean)
    : [extractDiameter(rearTires)].filter(Boolean);
  
  // Check if ANY tire diameter doesn't match wheel diameter
  const frontMismatch = frontDiameters.length > 0 && !frontDiameters.includes(wheelDia);
  const rearMismatch = rearDiameters.length > 0 && !rearDiameters.includes(rearWheelDia);
  
  if (frontMismatch || rearMismatch) {
    mismatches.push(row);
    if (samples.length < 15) {
      samples.push({
        vehicle: `${row.year} ${row.make} ${row.model} [${row.trim}]`,
        wheelDia,
        rearWheelDia: row.rearWheelDiameter,
        frontTires: Array.isArray(frontTires) ? frontTires : frontTires,
        frontDiameters,
        rearTires: Array.isArray(rearTires) ? rearTires : rearTires,
        rearDiameters,
        issue: frontMismatch ? 'front' : 'rear'
      });
    }
  }
}

console.log('Records checked:', records.rows.length);
console.log('Mismatches found:', mismatches.length);
console.log('\nSample mismatches:');
samples.forEach((s, i) => {
  console.log(`\n${i+1}. ${s.vehicle}`);
  console.log(`   Wheel: ${s.wheelDia}"${s.rearWheelDia ? ` / Rear: ${s.rearWheelDia}"` : ''}`);
  console.log(`   Front tires: ${JSON.stringify(s.frontTires)} → diameters: ${s.frontDiameters}`);
  if (s.rearTires) console.log(`   Rear tires: ${JSON.stringify(s.rearTires)} → diameters: ${s.rearDiameters}`);
  console.log(`   Issue: ${s.issue} tire doesn't match wheel`);
});

// Check Land Rover Discovery
console.log('\n\n=== AUDIT: Land Rover Discovery Missing Wheels ===\n');
const lrRes = await client.query(`
  SELECT id, year, model, trim, "wheelDiameter", "tireSize", "boltPattern"
  FROM vehicle_fitments
  WHERE make = 'Land Rover' AND model ILIKE '%Discovery%'
  ORDER BY year DESC, trim
`);
console.log('Land Rover Discovery records:', lrRes.rows.length);
const missingWheels = lrRes.rows.filter(r => !r.wheelDiameter);
console.log('Missing wheel diameter:', missingWheels.length);
if (missingWheels.length > 0) {
  console.log('\nSample missing:');
  missingWheels.slice(0, 10).forEach(r => {
    console.log(`  ${r.year} ${r.model} [${r.trim}] - bolt: ${r.boltPattern}, tire: ${r.tireSize}`);
  });
}

// Check Acura duplicates
console.log('\n\n=== AUDIT: Acura TL/TLX/TSX Duplicates ===\n');
const acuraRes = await client.query(`
  SELECT year, make, model, trim, "boltPattern", COUNT(*) as cnt
  FROM vehicle_fitments
  WHERE make = 'Acura' AND model IN ('TL', 'TLX', 'TSX')
  GROUP BY year, make, model, trim, "boltPattern"
  HAVING COUNT(*) > 1
  ORDER BY year DESC, model, trim
`);
console.log('Duplicate groups:', acuraRes.rows.length);
if (acuraRes.rows.length > 0) {
  console.log('\nDuplicate records:');
  acuraRes.rows.forEach(r => {
    console.log(`  ${r.year} ${r.make} ${r.model} [${r.trim}] - ${r.cnt} copies`);
  });
}

// Total Acura records for context
const acuraTotalRes = await client.query(`
  SELECT model, COUNT(*) as cnt
  FROM vehicle_fitments
  WHERE make = 'Acura' AND model IN ('TL', 'TLX', 'TSX')
  GROUP BY model
  ORDER BY model
`);
console.log('\nTotal Acura records by model:');
acuraTotalRes.rows.forEach(r => console.log(`  ${r.model}: ${r.cnt}`));

await client.end();
