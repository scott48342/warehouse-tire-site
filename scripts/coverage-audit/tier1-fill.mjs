#!/usr/bin/env node
/**
 * Fill missing Tier 1 vehicles with verified OEM fitment data
 * Sources: OEM dealer guides, manufacturer specs
 */
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// =============================================================================
// VERIFIED OEM FITMENT DATA
// =============================================================================

const FITMENT_DATA = [];

// Helper to generate mod ID
function modId(make, model, year) {
  return `${make.toLowerCase().replace(/\s+/g, '-')}_${model.toLowerCase().replace(/\s+/g, '-')}_${year}_base`;
}

// -----------------------------------------------------------------------------
// RAM 1500 (2010-2025) - 5x139.7, CB 77.8mm
// -----------------------------------------------------------------------------
for (let year = 2010; year <= 2025; year++) {
  FITMENT_DATA.push({
    year,
    make: "RAM",
    model: "Ram 1500",
    boltPattern: "5x139.7",
    centerBoreMm: 77.8,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 0,
    offsetMaxMm: 35,
    oemWheelSizes: year >= 2019 
      ? ["18x8", "20x9", "22x9"] 
      : ["17x7", "18x8", "20x9"],
    oemTireSizes: year >= 2019
      ? ["275/65R18", "275/55R20", "285/45R22"]
      : ["265/70R17", "275/60R18", "275/55R20"],
    source: "oem_specs",
    sourceNotes: "RAM dealer fitment guide",
  });
}

// -----------------------------------------------------------------------------
// RAM 2500 (2010-2025) - 8x165.1, CB 121.4mm
// -----------------------------------------------------------------------------
for (let year = 2010; year <= 2025; year++) {
  FITMENT_DATA.push({
    year,
    make: "RAM",
    model: "Ram 2500",
    boltPattern: "8x165.1",
    centerBoreMm: 121.4,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 0,
    offsetMaxMm: 50,
    oemWheelSizes: year >= 2019 ? ["18x8", "20x8"] : ["17x7.5", "18x8"],
    oemTireSizes: year >= 2019 ? ["275/70R18", "275/60R20"] : ["265/70R17", "275/70R18"],
    source: "oem_specs",
    sourceNotes: "RAM dealer fitment guide - HD truck",
  });
}

// -----------------------------------------------------------------------------
// RAM 3500 (2010-2025) - 8x165.1, CB 121.4mm (SRW)
// -----------------------------------------------------------------------------
for (let year = 2010; year <= 2025; year++) {
  FITMENT_DATA.push({
    year,
    make: "RAM",
    model: "Ram 3500",
    boltPattern: "8x165.1",
    centerBoreMm: 121.4,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 0,
    offsetMaxMm: 50,
    oemWheelSizes: year >= 2019 ? ["18x8", "20x8"] : ["17x7.5", "18x8"],
    oemTireSizes: year >= 2019 ? ["275/70R18", "275/60R20"] : ["265/70R17", "275/70R18"],
    source: "oem_specs",
    sourceNotes: "RAM dealer fitment guide - HD truck SRW",
  });
}

// -----------------------------------------------------------------------------
// Chevrolet Silverado 2500HD (2010-2025)
// 2010: 8x165.1, 2011+: 8x180
// -----------------------------------------------------------------------------
for (let year = 2010; year <= 2025; year++) {
  const is2011Plus = year >= 2011;
  FITMENT_DATA.push({
    year,
    make: "Chevrolet",
    model: "Silverado 2500HD",
    boltPattern: is2011Plus ? "8x180" : "8x165.1",
    centerBoreMm: is2011Plus ? 124.1 : 116.8,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: is2011Plus ? 25 : 0,
    offsetMaxMm: 50,
    oemWheelSizes: year >= 2020 ? ["18x8", "20x8.5"] : ["17x7.5", "18x8"],
    oemTireSizes: year >= 2020 ? ["275/70R18", "275/60R20"] : ["265/70R17", "275/70R18"],
    source: "oem_specs",
    sourceNotes: `GM dealer fitment guide - HD truck${is2011Plus ? ' (8x180 pattern 2011+)' : ' (8x165.1 pre-2011)'}`,
  });
}

// -----------------------------------------------------------------------------
// Chevrolet Silverado 3500HD (2010-2025)
// -----------------------------------------------------------------------------
for (let year = 2010; year <= 2025; year++) {
  const is2011Plus = year >= 2011;
  FITMENT_DATA.push({
    year,
    make: "Chevrolet",
    model: "Silverado 3500HD",
    boltPattern: is2011Plus ? "8x180" : "8x165.1",
    centerBoreMm: is2011Plus ? 124.1 : 116.8,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: is2011Plus ? 25 : 0,
    offsetMaxMm: 50,
    oemWheelSizes: year >= 2020 ? ["18x8", "20x8.5"] : ["17x7.5", "18x8"],
    oemTireSizes: year >= 2020 ? ["275/70R18", "275/60R20"] : ["265/70R17", "275/70R18"],
    source: "oem_specs",
    sourceNotes: `GM dealer fitment guide - HD truck SRW${is2011Plus ? ' (8x180 pattern 2011+)' : ''}`,
  });
}

// -----------------------------------------------------------------------------
// GMC Sierra 2500HD (2010-2025)
// -----------------------------------------------------------------------------
for (let year = 2010; year <= 2025; year++) {
  const is2011Plus = year >= 2011;
  FITMENT_DATA.push({
    year,
    make: "GMC",
    model: "Sierra 2500HD",
    boltPattern: is2011Plus ? "8x180" : "8x165.1",
    centerBoreMm: is2011Plus ? 124.1 : 116.8,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: is2011Plus ? 25 : 0,
    offsetMaxMm: 50,
    oemWheelSizes: year >= 2020 ? ["18x8", "20x8.5"] : ["17x7.5", "18x8"],
    oemTireSizes: year >= 2020 ? ["275/70R18", "275/60R20"] : ["265/70R17", "275/70R18"],
    source: "oem_specs",
    sourceNotes: `GM dealer fitment guide - HD truck${is2011Plus ? ' (8x180 pattern 2011+)' : ''}`,
  });
}

// -----------------------------------------------------------------------------
// GMC Sierra 3500HD (2010-2025)
// -----------------------------------------------------------------------------
for (let year = 2010; year <= 2025; year++) {
  const is2011Plus = year >= 2011;
  FITMENT_DATA.push({
    year,
    make: "GMC",
    model: "Sierra 3500HD",
    boltPattern: is2011Plus ? "8x180" : "8x165.1",
    centerBoreMm: is2011Plus ? 124.1 : 116.8,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: is2011Plus ? 25 : 0,
    offsetMaxMm: 50,
    oemWheelSizes: year >= 2020 ? ["18x8", "20x8.5"] : ["17x7.5", "18x8"],
    oemTireSizes: year >= 2020 ? ["275/70R18", "275/60R20"] : ["265/70R17", "275/70R18"],
    source: "oem_specs",
    sourceNotes: `GM dealer fitment guide - HD truck SRW${is2011Plus ? ' (8x180 pattern 2011+)' : ''}`,
  });
}

// -----------------------------------------------------------------------------
// Hyundai Santa Fe (2010-2017, 2019-2025) - 2018 already in DB
// -----------------------------------------------------------------------------
const SANTA_FE_YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
for (const year of SANTA_FE_YEARS) {
  const is5thGen = year >= 2024;
  const is4thGen = year >= 2019 && year <= 2023;
  
  let oemWheels, oemTires;
  if (is5thGen) {
    oemWheels = ["18x7.5", "19x7.5", "20x8"];
    oemTires = ["235/65R18", "235/55R19", "255/45R20"];
  } else if (is4thGen) {
    oemWheels = ["17x7", "18x7.5", "19x7.5"];
    oemTires = ["235/65R17", "235/60R18", "235/55R19"];
  } else if (year >= 2013) {
    oemWheels = ["17x7", "18x7.5", "19x7.5"];
    oemTires = ["235/65R17", "235/60R18", "235/55R19"];
  } else {
    oemWheels = ["17x6.5", "18x7"];
    oemTires = ["235/65R17", "235/60R18"];
  }
  
  FITMENT_DATA.push({
    year,
    make: "Hyundai",
    model: "Santa Fe",
    boltPattern: "5x114.3",
    centerBoreMm: 67.1,
    threadSize: "M12x1.5",
    seatType: "conical",
    offsetMinMm: 35,
    offsetMaxMm: 55,
    oemWheelSizes: oemWheels,
    oemTireSizes: oemTires,
    source: "oem_specs",
    sourceNotes: "Hyundai dealer fitment guide",
  });
}

// -----------------------------------------------------------------------------
// GMC Sierra 1500 (missing: 2010-2013, 2016-2017, 2021, 2023, 2025)
// -----------------------------------------------------------------------------
const SIERRA_1500_MISSING = [2010, 2011, 2012, 2013, 2016, 2017, 2021, 2023, 2025];
for (const year of SIERRA_1500_MISSING) {
  const isNewGen = year >= 2019;
  FITMENT_DATA.push({
    year,
    make: "GMC",
    model: "Sierra 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 0,
    offsetMaxMm: 31,
    oemWheelSizes: isNewGen ? ["17x8", "18x8.5", "20x9", "22x9"] : ["17x7.5", "18x8", "20x9"],
    oemTireSizes: isNewGen ? ["255/70R17", "265/65R18", "275/55R20", "275/50R22"] : ["265/70R17", "265/65R18", "275/55R20"],
    source: "oem_specs",
    sourceNotes: "GM dealer fitment guide",
  });
}

// -----------------------------------------------------------------------------
// Chevrolet Silverado 1500 (missing: 2010-2012)
// -----------------------------------------------------------------------------
for (let year = 2010; year <= 2012; year++) {
  FITMENT_DATA.push({
    year,
    make: "Chevrolet",
    model: "Silverado 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 0,
    offsetMaxMm: 31,
    oemWheelSizes: ["17x7.5", "18x8", "20x9"],
    oemTireSizes: ["265/70R17", "265/65R18", "275/55R20"],
    source: "oem_specs",
    sourceNotes: "GM dealer fitment guide",
  });
}

// -----------------------------------------------------------------------------
// Nissan Frontier 2025
// -----------------------------------------------------------------------------
FITMENT_DATA.push({
  year: 2025,
  make: "Nissan",
  model: "Frontier",
  boltPattern: "6x114.3",
  centerBoreMm: 66.1,
  threadSize: "M12x1.25",
  seatType: "conical",
  offsetMinMm: 10,
  offsetMaxMm: 45,
  oemWheelSizes: ["16x7", "17x7.5", "18x7.5"],
  oemTireSizes: ["265/70R16", "265/65R17", "265/60R18"],
  source: "oem_specs",
  sourceNotes: "Nissan dealer fitment guide",
});

// -----------------------------------------------------------------------------
// Ford F-250/F-350 2018
// -----------------------------------------------------------------------------
FITMENT_DATA.push({
  year: 2018,
  make: "Ford",
  model: "F-250",
  boltPattern: "8x170",
  centerBoreMm: 124.9,
  threadSize: "M14x1.5",
  seatType: "conical",
  offsetMinMm: 0,
  offsetMaxMm: 50,
  oemWheelSizes: ["17x7.5", "18x8", "20x8"],
  oemTireSizes: ["265/70R17", "275/70R18", "275/65R20"],
  source: "oem_specs",
  sourceNotes: "Ford dealer fitment guide - Super Duty",
});

FITMENT_DATA.push({
  year: 2018,
  make: "Ford",
  model: "F-350",
  boltPattern: "8x170",
  centerBoreMm: 124.9,
  threadSize: "M14x1.5",
  seatType: "conical",
  offsetMinMm: 0,
  offsetMaxMm: 50,
  oemWheelSizes: ["17x7.5", "18x8", "20x8"],
  oemTireSizes: ["265/70R17", "275/70R18", "275/65R20"],
  source: "oem_specs",
  sourceNotes: "Ford dealer fitment guide - Super Duty SRW",
});

// =============================================================================
// IMPORT FUNCTION
// =============================================================================

async function importFitments() {
  console.log(`\n=== IMPORTING ${FITMENT_DATA.length} TIER 1 FITMENT RECORDS ===\n`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const fitment of FITMENT_DATA) {
    try {
      // Check if already exists
      const existing = await sql`
        SELECT id FROM vehicle_fitments
        WHERE year = ${fitment.year}
          AND LOWER(make) = ${fitment.make.toLowerCase()}
          AND LOWER(model) = ${fitment.model.toLowerCase()}
        LIMIT 1
      `;
      
      if (existing.length > 0) {
        console.log(`  SKIP: ${fitment.year} ${fitment.make} ${fitment.model} (exists)`);
        skipped++;
        continue;
      }
      
      // Generate modification_id
      const modificationId = modId(fitment.make, fitment.model, fitment.year);
      
      // Insert using correct column names from schema
      await sql`
        INSERT INTO vehicle_fitments (
          id,
          year, make, model,
          raw_trim, display_trim, submodel, modification_id,
          bolt_pattern, center_bore_mm, thread_size, seat_type,
          offset_min_mm, offset_max_mm,
          oem_wheel_sizes, oem_tire_sizes,
          source, quality_tier, confidence_tag,
          created_at, updated_at
        ) VALUES (
          ${randomUUID()},
          ${fitment.year},
          ${fitment.make},
          ${fitment.model},
          NULL,
          'Base',
          NULL,
          ${modificationId},
          ${fitment.boltPattern},
          ${fitment.centerBoreMm},
          ${fitment.threadSize},
          ${fitment.seatType},
          ${fitment.offsetMinMm},
          ${fitment.offsetMaxMm},
          ${JSON.stringify(fitment.oemWheelSizes)},
          ${JSON.stringify(fitment.oemTireSizes)},
          ${fitment.source},
          'tier1',
          'HIGH',
          NOW(),
          NOW()
        )
      `;
      
      console.log(`  ✓ ${fitment.year} ${fitment.make} ${fitment.model}`);
      imported++;
      
    } catch (err) {
      console.error(`  ✗ ${fitment.year} ${fitment.make} ${fitment.model}: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  
  // Verify coverage
  console.log(`\nVerifying new coverage...`);
  const coverageCheck = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE LOWER(make) = 'ram' AND LOWER(model) = 'ram 1500') as ram_1500,
      COUNT(*) FILTER (WHERE LOWER(make) = 'ram' AND LOWER(model) = 'ram 2500') as ram_2500,
      COUNT(*) FILTER (WHERE LOWER(make) = 'ram' AND LOWER(model) = 'ram 3500') as ram_3500,
      COUNT(*) FILTER (WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'silverado 2500hd') as silverado_2500,
      COUNT(*) FILTER (WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'silverado 3500hd') as silverado_3500,
      COUNT(*) FILTER (WHERE LOWER(make) = 'gmc' AND LOWER(model) = 'sierra 2500hd') as sierra_2500,
      COUNT(*) FILTER (WHERE LOWER(make) = 'gmc' AND LOWER(model) = 'sierra 3500hd') as sierra_3500,
      COUNT(*) FILTER (WHERE LOWER(make) = 'hyundai' AND LOWER(model) = 'santa fe') as santa_fe
    FROM vehicle_fitments
  `;
  
  console.log('\nPost-import vehicle counts:');
  console.log(coverageCheck[0]);
  
  await sql.end();
}

importFitments().catch(console.error);
