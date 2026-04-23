import pg from 'pg';
import { writeFileSync, mkdirSync } from 'fs';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Get all web_research records
const all = await client.query(`
  SELECT DISTINCT year, make, model
  FROM vehicle_fitments 
  WHERE source LIKE '%web_research%' OR source LIKE '%gap-fill%'
  ORDER BY make, model, year
`);

console.log("Total unique YMM to verify:", all.rows.length);

// Group by make
const byMake = {};
all.rows.forEach(r => {
  const make = r.make.toLowerCase();
  if (!byMake[make]) byMake[make] = [];
  byMake[make].push({ year: r.year, make: r.make, model: r.model });
});

// Create batches of ~75 vehicles each, grouped by make
const batches = [];
let batchNum = 1;

const makeGroups = {
  'toyota': 'japanese',
  'honda': 'japanese',
  'nissan': 'japanese',
  'mazda': 'japanese',
  'subaru': 'japanese',
  'mitsubishi': 'japanese',
  'lexus': 'japanese',
  'acura': 'japanese',
  'infiniti': 'japanese',
  'bmw': 'german',
  'mercedes': 'german',
  'mercedes-benz': 'german',
  'audi': 'german',
  'volkswagen': 'german',
  'porsche': 'german',
  'mini': 'german',
  'jaguar': 'european',
  'land-rover': 'european',
  'volvo': 'european',
  'maserati': 'european',
  'hyundai': 'korean',
  'kia': 'korean',
  'genesis': 'korean',
  'ford': 'domestic',
  'chevrolet': 'domestic',
  'dodge': 'domestic',
  'chrysler': 'domestic',
  'buick': 'domestic',
  'cadillac': 'domestic',
  'gmc': 'domestic',
  'lincoln': 'domestic',
  'ram': 'domestic',
  'jeep': 'domestic',
  'pontiac': 'domestic',
  'oldsmobile': 'domestic'
};

// Sort makes by group for better batching
const sortedMakes = Object.keys(byMake).sort((a, b) => {
  const groupA = makeGroups[a] || 'other';
  const groupB = makeGroups[b] || 'other';
  if (groupA !== groupB) return groupA.localeCompare(groupB);
  return a.localeCompare(b);
});

let currentBatch = [];
let currentGroup = null;

for (const make of sortedMakes) {
  const vehicles = byMake[make];
  const group = makeGroups[make] || 'other';
  
  // If switching groups and have vehicles, save batch
  if (currentGroup && currentGroup !== group && currentBatch.length > 0) {
    const batchName = `batch-${String(batchNum).padStart(2, '0')}-${currentGroup}`;
    batches.push({ name: batchName, group: currentGroup, vehicles: currentBatch });
    batchNum++;
    currentBatch = [];
  }
  
  currentGroup = group;
  
  // Add vehicles, creating new batch if too large
  for (const v of vehicles) {
    currentBatch.push(v);
    if (currentBatch.length >= 75) {
      const batchName = `batch-${String(batchNum).padStart(2, '0')}-${group}`;
      batches.push({ name: batchName, group, vehicles: currentBatch });
      batchNum++;
      currentBatch = [];
    }
  }
}

// Don't forget the last batch
if (currentBatch.length > 0) {
  const batchName = `batch-${String(batchNum).padStart(2, '0')}-${currentGroup}`;
  batches.push({ name: batchName, group: currentGroup, vehicles: currentBatch });
}

console.log("\nCreated", batches.length, "batches:");
batches.forEach(b => {
  console.log("  " + b.name + ": " + b.vehicles.length + " vehicles");
});

// Write batch files
for (const batch of batches) {
  const filename = `batches/${batch.name}.json`;
  writeFileSync(filename, JSON.stringify({
    batch: batch.name,
    group: batch.group,
    vehicleCount: batch.vehicles.length,
    vehicles: batch.vehicles
  }, null, 2));
}

console.log("\nBatch files written to batches/");

// Summary
const summary = batches.reduce((acc, b) => {
  if (!acc[b.group]) acc[b.group] = { batches: 0, vehicles: 0 };
  acc[b.group].batches++;
  acc[b.group].vehicles += b.vehicles.length;
  return acc;
}, {});

console.log("\nSummary by group:");
Object.entries(summary).forEach(([group, stats]) => {
  console.log("  " + group + ": " + stats.batches + " batches, " + stats.vehicles + " vehicles");
});

await client.end();
