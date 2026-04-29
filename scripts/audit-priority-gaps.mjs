import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { Client } = pg;
const dbUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').replace(/^["']|["']$/g, '');
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

await client.connect();

console.log('=== PRIORITY FITMENT GAP AUDIT ===\n');
console.log('Focusing on high-volume US vehicles (trucks, SUVs, popular cars)\n');

// High-priority US models (popular sellers)
const priorityModels = [
  // Ford trucks/SUVs
  { make: 'Ford', models: ['F-150', 'F-250', 'F-350', 'Ranger', 'Explorer', 'Expedition', 'Bronco', 'Bronco Sport', 'Escape', 'Edge', 'Mustang', 'Focus', 'Fusion'] },
  // Chevy/GMC trucks
  { make: 'Chevrolet', models: ['Silverado 1500', 'Silverado 2500HD', 'Silverado 3500HD', 'Colorado', 'Tahoe', 'Suburban', 'Traverse', 'Equinox', 'Blazer', 'Camaro', 'Corvette', 'Malibu'] },
  { make: 'GMC', models: ['Sierra 1500', 'Sierra 2500HD', 'Sierra 3500HD', 'Canyon', 'Yukon', 'Yukon XL', 'Acadia', 'Terrain'] },
  // Ram
  { make: 'Ram', models: ['1500', '2500', '3500'] },
  { make: 'Dodge', models: ['Durango', 'Challenger', 'Charger', 'Grand Caravan'] },
  // Jeep
  { make: 'Jeep', models: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator', 'Wagoneer', 'Grand Wagoneer'] },
  // Toyota
  { make: 'Toyota', models: ['Tundra', 'Tacoma', '4Runner', 'Sequoia', 'Highlander', 'RAV4', 'Camry', 'Corolla', 'Prius', 'Sienna', 'Land Cruiser'] },
  // Honda
  { make: 'Honda', models: ['Civic', 'Accord', 'CR-V', 'Pilot', 'Passport', 'Ridgeline', 'Odyssey', 'HR-V'] },
  // Nissan
  { make: 'Nissan', models: ['Titan', 'Frontier', 'Pathfinder', 'Murano', 'Rogue', 'Altima', 'Maxima', 'Sentra', 'Armada'] },
  // Hyundai/Kia
  { make: 'Hyundai', models: ['Santa Fe', 'Tucson', 'Palisade', 'Sonata', 'Elantra', 'Kona'] },
  { make: 'Kia', models: ['Telluride', 'Sorento', 'Sportage', 'Soul', 'Forte', 'K5', 'Optima'] },
  // Tesla
  { make: 'Tesla', models: ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'] },
  // Luxury
  { make: 'BMW', models: ['3 Series', '5 Series', 'X3', 'X5'] },
  { make: 'Mercedes-Benz', models: ['C-Class', 'E-Class', 'GLE', 'GLC'] },
  { make: 'Lexus', models: ['RX', 'NX', 'ES', 'GX', 'LX'] },
];

// Get catalog data
const catalogData = await client.query(`
  SELECT m.name as make, cm.name as model, cm.years 
  FROM catalog_models cm
  JOIN catalog_makes m ON cm.make_slug = m.slug
`);

// Get fitments
const fitmentData = await client.query(`
  SELECT DISTINCT year, make, model FROM vehicle_fitments
  WHERE certification_status = 'certified'
`);

const fitmentSet = new Set();
for (const row of fitmentData.rows) {
  const key = `${row.year}|${row.make.toLowerCase().trim()}|${row.model.toLowerCase().trim()}`;
  fitmentSet.add(key);
}

const gaps = [];

for (const row of catalogData.rows) {
  const make = row.make;
  const model = row.model;
  
  // Check if this is a priority model
  const priority = priorityModels.find(p => 
    p.make.toLowerCase() === make.toLowerCase() && 
    p.models.some(m => model.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(model.toLowerCase()))
  );
  if (!priority) continue;
  
  let years = [];
  const yearsRaw = row.years;
  if (typeof yearsRaw === 'string' && yearsRaw.includes('-')) {
    const [start, end] = yearsRaw.split('-').map(y => parseInt(y.trim()));
    if (!isNaN(start) && !isNaN(end)) {
      for (let y = start; y <= end; y++) years.push(y);
    }
  } else if (Array.isArray(yearsRaw)) {
    years = yearsRaw.map(y => parseInt(y)).filter(y => !isNaN(y));
  }
  
  years = years.filter(y => y >= 2000 && y <= 2026);
  if (years.length === 0) continue;
  
  const missingYears = years.filter(year => {
    const key = `${year}|${make.toLowerCase().trim()}|${model.toLowerCase().trim()}`;
    return !fitmentSet.has(key);
  });
  
  if (missingYears.length > 0) {
    gaps.push({
      make,
      model,
      totalYears: years.length,
      missingYears: missingYears.sort((a,b) => a-b),
      missingCount: missingYears.length
    });
  }
}

gaps.sort((a, b) => b.missingCount - a.missingCount);

console.log(`Found ${gaps.length} priority vehicles with gaps:\n`);

for (const gap of gaps) {
  console.log(`${gap.make} ${gap.model}: ${gap.missingCount} years missing`);
  console.log(`  → ${gap.missingYears.join(', ')}`);
}

if (gaps.length === 0) {
  console.log('✅ All priority vehicles have complete fitment coverage!');
}

// Save
fs.writeFileSync(path.join(__dirname, 'priority-gaps.json'), JSON.stringify(gaps, null, 2));

await client.end();
