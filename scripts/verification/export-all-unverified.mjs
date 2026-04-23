import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;
const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Create output directory
const outputDir = './batches-overnight';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Exporting all unverified records...');

// Get all unverified records
const result = await client.query(`
  SELECT 
    id, year, make, model, raw_trim, display_trim, submodel,
    bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes, source
  FROM vehicle_fitments 
  WHERE source != 'verified-research'
  ORDER BY make, model, year
`);

console.log(`Total records: ${result.rows.length}`);

// Normalize make names
const normalizeMap = {
  'Chevrolet': 'chevrolet',
  'Ford': 'ford',
  'Cadillac': 'cadillac',
  'Dodge': 'dodge',
  'Pontiac': 'pontiac',
  'Oldsmobile': 'oldsmobile',
  'Buick': 'buick',
  'Jeep': 'jeep',
  'Mercury': 'mercury',
  'GMC': 'gmc',
  'Chrysler': 'chrysler',
  'Lincoln': 'lincoln',
  'Toyota': 'toyota',
  'Nissan': 'nissan',
  'Suzuki': 'suzuki',
  'Saturn': 'saturn',
  'Saab': 'saab',
  'Isuzu': 'isuzu',
  'Daewoo': 'daewoo',
  'Plymouth': 'plymouth',
  'AMC': 'amc',
  'International': 'international',
  'land rover': 'land-rover',
  'mercedes': 'mercedes-benz'
};

// Group by make
const byMake = {};
for (const row of result.rows) {
  let make = row.make;
  if (normalizeMap[make]) make = normalizeMap[make];
  make = make.toLowerCase();
  
  if (!byMake[make]) byMake[make] = [];
  byMake[make].push({
    id: row.id,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.display_trim || row.raw_trim || row.submodel || 'Base',
    currentBoltPattern: row.bolt_pattern,
    currentHubBore: row.center_bore_mm,
    currentWheelSizes: row.oem_wheel_sizes,
    currentTireSizes: row.oem_tire_sizes,
    source: row.source
  });
}

// Create batch files (max 75 vehicles per batch)
const BATCH_SIZE = 75;
let batchNum = 1;
const manifest = [];

for (const [make, vehicles] of Object.entries(byMake).sort((a, b) => b[1].length - a[1].length)) {
  // Split into batches
  for (let i = 0; i < vehicles.length; i += BATCH_SIZE) {
    const batch = vehicles.slice(i, i + BATCH_SIZE);
    const batchName = `overnight-${String(batchNum).padStart(3, '0')}-${make}`;
    const filename = `${batchName}.json`;
    
    fs.writeFileSync(
      path.join(outputDir, filename),
      JSON.stringify(batch, null, 2)
    );
    
    manifest.push({
      batch: batchNum,
      name: batchName,
      make: make,
      count: batch.length,
      file: filename
    });
    
    batchNum++;
  }
}

// Write manifest
fs.writeFileSync(
  path.join(outputDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log(`\nCreated ${batchNum - 1} batch files in ${outputDir}/`);
console.log(`Manifest written to ${outputDir}/manifest.json`);

// Summary by make
console.log('\n=== BATCHES BY MAKE ===');
const makeCount = {};
manifest.forEach(m => {
  if (!makeCount[m.make]) makeCount[m.make] = { batches: 0, vehicles: 0 };
  makeCount[m.make].batches++;
  makeCount[m.make].vehicles += m.count;
});
Object.entries(makeCount)
  .sort((a, b) => b[1].vehicles - a[1].vehicles)
  .forEach(([make, data]) => {
    console.log(`${make}: ${data.batches} batches, ${data.vehicles} vehicles`);
  });

await client.end();
