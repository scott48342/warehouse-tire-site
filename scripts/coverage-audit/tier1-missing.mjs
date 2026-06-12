#!/usr/bin/env node
/**
 * Find missing Tier 1 vehicles using direct postgres
 */
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const TIER_1_VEHICLES = [
  { make: "Ford", model: "F-150" },
  { make: "Chevrolet", model: "Silverado 1500" },
  { make: "RAM", model: "Ram 1500" },
  { make: "GMC", model: "Sierra 1500" },
  { make: "Toyota", model: "Tundra" },
  { make: "Nissan", model: "Titan" },
  { make: "Toyota", model: "Tacoma" },
  { make: "Ford", model: "Ranger" },
  { make: "Chevrolet", model: "Colorado" },
  { make: "GMC", model: "Canyon" },
  { make: "Nissan", model: "Frontier" },
  { make: "Honda", model: "Ridgeline" },
  { make: "Jeep", model: "Gladiator" },
  { make: "Ford", model: "Maverick" },
  { make: "Ford", model: "F-250" },
  { make: "Ford", model: "F-350" },
  { make: "Chevrolet", model: "Silverado 2500HD" },
  { make: "Chevrolet", model: "Silverado 3500HD" },
  { make: "RAM", model: "Ram 2500" },
  { make: "RAM", model: "Ram 3500" },
  { make: "GMC", model: "Sierra 2500HD" },
  { make: "GMC", model: "Sierra 3500HD" },
  { make: "Toyota", model: "RAV4" },
  { make: "Honda", model: "CR-V" },
  { make: "Mazda", model: "CX-5" },
  { make: "Subaru", model: "Crosstrek" },
  { make: "Subaru", model: "Forester" },
  { make: "Hyundai", model: "Tucson" },
  { make: "Kia", model: "Sportage" },
  { make: "Nissan", model: "Rogue" },
  { make: "Ford", model: "Escape" },
  { make: "Chevrolet", model: "Equinox" },
  { make: "Toyota", model: "Highlander" },
  { make: "Honda", model: "Pilot" },
  { make: "Ford", model: "Explorer" },
  { make: "Chevrolet", model: "Traverse" },
  { make: "Hyundai", model: "Santa Fe" },
  { make: "Kia", model: "Sorento" },
  { make: "Subaru", model: "Outback" },
  { make: "Mazda", model: "CX-9" },
  { make: "Chevrolet", model: "Tahoe" },
  { make: "Chevrolet", model: "Suburban" },
  { make: "GMC", model: "Yukon" },
  { make: "Ford", model: "Expedition" },
  { make: "Toyota", model: "Sequoia" },
  { make: "Nissan", model: "Armada" },
  { make: "Jeep", model: "Wrangler" },
  { make: "Jeep", model: "Grand Cherokee" },
  { make: "Toyota", model: "4Runner" },
  { make: "Ford", model: "Bronco" },
  { make: "Land Rover", model: "Defender" },
];

const YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Year ranges where vehicles exist
const VEHICLE_RANGES = {
  "Ford|Maverick": { start: 2022 },
  "Ford|Bronco": { start: 2021 },
  "Jeep|Gladiator": { start: 2020 },
  "Subaru|Crosstrek": { start: 2013 },
  "Land Rover|Defender": { start: 2020 },
  "Mazda|CX-5": { start: 2013 },
  "Honda|Ridgeline": { start: 2017, gap: [2015, 2016] },
  "GMC|Canyon": { start: 2015 },
  "Chevrolet|Colorado": { start: 2015 },
};

function vehicleExistsInYear(make, model, year) {
  const key = `${make}|${model}`;
  const range = VEHICLE_RANGES[key];
  if (range?.start && year < range.start) return false;
  if (range?.end && year > range.end) return false;
  if (range?.gap && range.gap.includes(year)) return false;
  return true;
}

async function findMissing() {
  // Get all populated from DB
  const populated = await sql`
    SELECT DISTINCT year, make, model 
    FROM vehicle_fitments
  `;
  
  const populatedSet = new Set(
    populated.map(v => `${v.year}|${v.make.toLowerCase()}|${v.model.toLowerCase()}`)
  );
  
  const missing = [];
  
  for (const vehicle of TIER_1_VEHICLES) {
    const missingYears = [];
    for (const year of YEARS) {
      if (!vehicleExistsInYear(vehicle.make, vehicle.model, year)) continue;
      
      const key = `${year}|${vehicle.make.toLowerCase()}|${vehicle.model.toLowerCase()}`;
      if (!populatedSet.has(key)) {
        missingYears.push(year);
      }
    }
    if (missingYears.length > 0) {
      missing.push({ ...vehicle, missingYears });
    }
  }
  
  // Sort by missing count desc
  missing.sort((a, b) => b.missingYears.length - a.missingYears.length);
  
  console.log('\n=== MISSING TIER 1 VEHICLES ===\n');
  
  let totalMissing = 0;
  for (const v of missing) {
    totalMissing += v.missingYears.length;
    console.log(`${v.make} ${v.model}: ${v.missingYears.length} years missing`);
    console.log(`  Years: ${v.missingYears.join(', ')}`);
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Vehicles with gaps: ${missing.length}`);
  console.log(`Total missing records: ${totalMissing}`);
  
  await sql.end();
}

findMissing().catch(console.error);
