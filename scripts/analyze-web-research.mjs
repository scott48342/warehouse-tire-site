import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

console.log("=== ANALYZING WEB_RESEARCH RECORDS ===\n");

// Get all web_research records
const all = await client.query(`
  SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm, oem_tire_sizes, source
  FROM vehicle_fitments 
  WHERE source LIKE '%web_research%' OR source LIKE '%gap-fill%'
  ORDER BY make, model, year
`);

console.log("Total web_research records:", all.rows.length);

// Group by make
const byMake = {};
all.rows.forEach(r => {
  const make = r.make.toLowerCase();
  if (!byMake[make]) byMake[make] = [];
  byMake[make].push(r);
});

console.log("\nBy make:");
Object.entries(byMake)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([make, records]) => {
    console.log("  " + make + ": " + records.length);
  });

// Group by year range
const byDecade = {};
all.rows.forEach(r => {
  const decade = Math.floor(r.year / 10) * 10 + "s";
  if (!byDecade[decade]) byDecade[decade] = 0;
  byDecade[decade]++;
});

console.log("\nBy decade:");
Object.entries(byDecade).sort().forEach(([decade, count]) => {
  console.log("  " + decade + ": " + count);
});

// Get unique YMM combos
const uniqueYMM = new Set();
all.rows.forEach(r => uniqueYMM.add(`${r.year}|${r.make}|${r.model}`));
console.log("\nUnique year/make/model combinations:", uniqueYMM.size);

// Export for batch processing
const batches = {
  domestic_cars: [],
  domestic_trucks: [],
  japanese: [],
  european: [],
  korean: [],
  other: []
};

const domesticMakes = ['ford', 'chevrolet', 'dodge', 'chrysler', 'buick', 'cadillac', 'gmc', 'lincoln', 'ram', 'jeep', 'pontiac', 'oldsmobile', 'mercury', 'plymouth'];
const japaneseMakes = ['toyota', 'honda', 'nissan', 'mazda', 'subaru', 'mitsubishi', 'lexus', 'acura', 'infiniti', 'scion'];
const europeanMakes = ['bmw', 'mercedes', 'mercedes-benz', 'audi', 'volkswagen', 'volvo', 'porsche', 'jaguar', 'land rover', 'land-rover', 'mini', 'fiat', 'alfa romeo', 'ferrari', 'lamborghini', 'maserati', 'bentley', 'rolls-royce', 'aston martin', 'aston-martin', 'mclaren', 'lotus'];
const koreanMakes = ['hyundai', 'kia', 'genesis'];
const truckModels = ['f-150', 'f-250', 'f-350', 'f-450', 'silverado', 'sierra', 'ram', 'tundra', 'titan', 'tacoma', 'colorado', 'canyon', 'ranger', 'frontier', 'ridgeline', 'gladiator', 'maverick', 'santa cruz', 'c10', 'c20', 'k10', 'k20', 'c1500', 'k1500'];

all.rows.forEach(r => {
  const make = r.make.toLowerCase();
  const model = r.model.toLowerCase();
  const vehicle = { year: r.year, make: r.make, model: r.model };
  
  const isTruck = truckModels.some(t => model.includes(t));
  
  if (domesticMakes.includes(make)) {
    if (isTruck) batches.domestic_trucks.push(vehicle);
    else batches.domestic_cars.push(vehicle);
  } else if (japaneseMakes.includes(make)) {
    batches.japanese.push(vehicle);
  } else if (europeanMakes.includes(make)) {
    batches.european.push(vehicle);
  } else if (koreanMakes.includes(make)) {
    batches.korean.push(vehicle);
  } else {
    batches.other.push(vehicle);
  }
});

console.log("\nBatch breakdown:");
Object.entries(batches).forEach(([name, vehicles]) => {
  console.log("  " + name + ": " + vehicles.length);
});

// Save for processing
writeFileSync('scripts/web-research-vehicles.json', JSON.stringify(batches, null, 2));
console.log("\nSaved to scripts/web-research-vehicles.json");

await client.end();
