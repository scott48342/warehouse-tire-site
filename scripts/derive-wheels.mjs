import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sql = postgres(process.env.POSTGRES_URL);

console.log('🔧 Deriving wheel sizes from tire sizes...\n');

// Get records missing wheels but having tires
const records = await sql`
  SELECT id, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]')
    AND oem_tire_sizes IS NOT NULL 
    AND oem_tire_sizes::text != '[]'
`;

console.log(`Found ${records.length} records to process...`);

let updated = 0;
for (const record of records) {
  const tires = record.oem_tire_sizes;
  if (!Array.isArray(tires) || tires.length === 0) continue;
  
  // Extract wheel diameters from tire sizes
  const diameters = new Set();
  for (const tire of tires) {
    // Handle both string format "255/40R19" and object format
    const tireStr = typeof tire === 'string' ? tire : tire.size || tire.tireSize || '';
    const match = tireStr.match(/R(\d+)/i);
    if (match) {
      diameters.add(parseInt(match[1]));
    }
  }
  
  if (diameters.size === 0) continue;
  
  // Create wheel size objects
  const wheelSizes = Array.from(diameters).sort((a,b) => a-b).map(d => ({
    diameter: d,
    position: "both"
  }));
  
  // Update the record
  await sql`
    UPDATE vehicle_fitments 
    SET oem_wheel_sizes = ${JSON.stringify(wheelSizes)}::jsonb
    WHERE id = ${record.id}
  `;
  updated++;
}

console.log(`✅ Updated ${updated} records with derived wheel sizes`);

// Final check
const stillMissing = await sql`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]'
`;
console.log(`\n📊 Records still missing wheel sizes: ${stillMissing[0].cnt}`);

await sql.end();
