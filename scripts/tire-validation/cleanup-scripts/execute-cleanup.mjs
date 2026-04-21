#!/usr/bin/env node
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const envPath = join(__dirname, '..', '..', '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log('\n🔧 TIRE DATA CLEANUP - EXECUTING');
  console.log('='.repeat(60));
  
  // Get before counts
  const beforeTotal = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
  const beforeEmpty = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb
  `);
  
  console.log(`\n📊 BEFORE:`);
  console.log(`   Total records: ${beforeTotal.rows[0].count}`);
  console.log(`   Empty records: ${beforeEmpty.rows[0].count}`);

  // ============================================================
  // STEP 1: DELETE PHANTOM YEARS
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('1️⃣  DELETING PHANTOM YEARS...');
  console.log('='.repeat(60));
  
  const phantomResult = await client.query(`
    DELETE FROM vehicle_fitments
    WHERE 
      (make ILIKE 'Toyota' AND model ILIKE 'FJ Cruiser' AND year > 2014)
      OR (make ILIKE 'Toyota' AND model ILIKE 'Land Cruiser' AND year BETWEEN 2021 AND 2023)
      OR (make ILIKE 'Toyota' AND model ILIKE 'Prius Plug-in' AND year > 2015)
      OR (make ILIKE 'Toyota' AND model ILIKE 'Prius V' AND year > 2017)
      OR (make ILIKE 'Toyota' AND model ILIKE 'Yaris' AND year > 2020)
      OR (make ILIKE 'Toyota' AND model ILIKE 'Venza' AND year IN (2016, 2017, 2018, 2019, 2020))
      OR (make ILIKE 'Toyota' AND model ILIKE 'Supra' AND year BETWEEN 2000 AND 2018)
      OR (make ILIKE 'Toyota' AND model ILIKE 'GR86' AND year < 2022)
      OR (make ILIKE 'Toyota' AND model ILIKE 'Mirai' AND year < 2016)
      OR (make ILIKE 'Volkswagen' AND model ILIKE 'Beetle' AND year > 2019)
      OR (make ILIKE 'Volkswagen' AND model ILIKE 'ID.4' AND year < 2021)
      OR (make ILIKE 'Volkswagen' AND model ILIKE 'Passat' AND year > 2022)
      OR (make ILIKE 'Volkswagen' AND model ILIKE 'Taos' AND year < 2022)
      OR (make ILIKE 'Volkswagen' AND model ILIKE 'Touareg' AND year > 2017)
      OR (make ILIKE 'Volkswagen' AND model ILIKE 'Tiguan' AND year < 2009)
      OR (make ILIKE 'Subaru' AND model ILIKE '%WRX%STI%' AND year > 2021)
      OR (make ILIKE 'Volvo' AND model ILIKE 'S60' AND year IN (2000, 2010))
      OR (make ILIKE 'Volvo' AND model ILIKE 'V60' AND year BETWEEN 2010 AND 2014)
      OR (make ILIKE 'Volvo' AND model ILIKE 'XC40' AND year < 2019)
      OR (make ILIKE 'Volvo' AND model ILIKE 'XC60' AND year < 2010)
      OR (make ILIKE 'Volvo' AND model ILIKE 'XC90' AND year = 2015)
      OR (make ILIKE 'Lexus' AND model ILIKE 'NX' AND year < 2015)
      OR (make ILIKE 'Lexus' AND model ILIKE 'RC' AND year < 2015)
      OR (make ILIKE 'Kia' AND model ILIKE 'EV6' AND year < 2022)
      OR (make ILIKE 'Kia' AND model ILIKE 'EV9' AND year < 2024)
      OR (make ILIKE 'Kia' AND model ILIKE 'Forte' AND year < 2010)
      OR (make ILIKE 'Kia' AND model ILIKE 'Niro' AND year < 2017)
  `);
  console.log(`   ✅ Deleted ${phantomResult.rowCount} phantom year records`);

  // ============================================================
  // STEP 2: DELETE NON-US VEHICLES
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('2️⃣  DELETING NON-US VEHICLES...');
  console.log('='.repeat(60));
  
  const nonUSResult = await client.query(`
    DELETE FROM vehicle_fitments
    WHERE model ILIKE ANY(ARRAY[
      'Allex', 'Altezza', 'Altezza-Gita', 'Aristo', 'Avensis%', 'Blade', 'Caldina',
      'Celsior', 'Century', 'Chaser', 'Corona', 'Corolla Axio', 'Corolla Fielder',
      'Corolla Rumion', 'Corolla Runx', 'Corolla Spacio', 'Crown', 'Duet',
      'Estima', 'Funcargo', 'Gaia', 'Grand HiAce', 'Harrier', 'Hilux-Surf', 'Hilux Surf',
      'Ipsum', 'Isis', 'Ist', 'JPN Taxi', 'JPN-Taxi', 'Kluger', 'Land Cruiser Cygnus',
      'Lite Ace%', 'Lite-Ace%', 'Mark II%', 'Mark-II%', 'Mark X', 'Mark-X', 
      'Mega Cruiser', 'MR-S', 'MR2 Roadster', 'Nadia', 'Noah', 'Opa', 'Origin', 
      'Passo', 'Picnic', 'Platz', 'Porte', 'Premio', 'Proace%', 'Probox', 'Pronard', 
      'Ractis', 'Raize', 'Raum', 'Regius', 'Roomy', 'Rush', 'Sai', 'Sienta', 
      'Soarer', 'Spade', 'Starlet%', 'Succeed', 'Tank', 'TownAce%', 'Town-Ace%',
      'Touring HiAce', 'Touring-HiAce', 'Vellfire', 'Verossa', 'Vista%', 'Vitz', 
      'Voxy', 'Will%', 'Windom', 'Wish', 'Yaris Cross', 'Yaris-Cross',
      'Avanza', 'Calya', 'C-Pod', 'Fortuner', 'Glanza', 'Hilux-Champ', 'Hilux Champ',
      'Hilux-Rangga', 'Hilux Rangga', 'Hilux-Stout', 'Hilux Stout', 'Innova%',
      'Kijang%', 'Nav1', 'Quantum', 'Rukus', 'Tamaraw', 'Urban Cruiser', 'Veloz',
      'Wigo', 'Yaris Ativ', 'Yaris-Ativ', 'Yaris Heykers', 'Yaris-Heykers', 
      'Yaris R', 'Yaris-R', 'Zelas', 'Zenix',
      'Amarok', 'Arteon SR', 'Bora', 'Clasico', 'Cross Lavida', 'Cross-Lavida',
      'Cross Santana', 'Cross-Santana', 'CrossPolo', 'Fox', 'Gol', 
      'ID.4 Crozz', 'ID.4-Crozz', 'ID.4 X', 'ID.4-X', 'ID Unyx', 'ID-Unyx', 'ID.3',
      'Jetta City', 'Jetta-City', 'Jetta King', 'Jetta-King', 'Jetta Pioneer', 
      'Jetta-Pioneer', 'Jetta VS5', 'Jetta VS7', 'Lamando', 'Lavida', 'Lupo', 
      'Magotan', 'Nivus', 'Parati', 'Phaeton', 'Pointer', 'Polo', 'Polo%',
      'Sagitar', 'Santana', 'Saveiro', 'Scirocco', 'Sedan', 'Sharan', 'SpaceFox',
      'Sportvan', 'Suran', 'T-Cross', 'T-Roc', 'Tacqua', 'Taigo', 'Tayron%',
      'Teramont', 'Tharu%', 'Touran', 'Up', 'Vento', 'Voyage',
      'V40', 'V40%', 'C30',
      'Avella', 'Besta', 'Carens', 'Carstar', 'Ceed', 'Cerato', 'Enterprise',
      'Grand Carnival', 'K3', 'K7', 'K9', 'Lotze', 'Magentis', 'Morning',
      'Opirus', 'Pegas', 'Picanto', 'Pride', 'ProCeed', 'Quoris', 'Ray',
      'Rio X', 'Rio-X', 'Shuma', 'Sonet', 'Stonic', 'Venga', 'XCeed'
    ])
  `);
  console.log(`   ✅ Deleted ${nonUSResult.rowCount} non-US vehicle records`);

  // ============================================================
  // STEP 3: FIX TIRE SIZES
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('3️⃣  FIXING TIRE SIZES...');
  console.log('='.repeat(60));
  
  let fixedCount = 0;
  
  // Toyota fixes
  let r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["215/65R17", "225/55R18"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Corolla Cross' AND year BETWEEN 2022 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["175/65R14", "185/65R14"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Corolla' AND year BETWEEN 2000 AND 2002`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["235/40R18", "245/40R18"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE '%GR%Corolla%' AND year BETWEEN 2023 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["245/70R17", "265/70R18", "265/60R20", "265/55R20"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE '4Runner' AND year BETWEEN 2025 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["265/75R16", "265/70R17"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'FJ Cruiser' AND year BETWEEN 2007 AND 2014`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["255/65R18", "255/55R20", "255/50R21"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Grand Highlander' AND year BETWEEN 2024 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["265/60R20", "265/50R22", "285/65R18"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Sequoia' AND year BETWEEN 2023 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["265/60R20", "265/70R18", "275/55R20", "285/65R18"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Tundra' AND year BETWEEN 2022 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["235/65R17", "235/60R18", "235/50R20"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Sienna' AND year BETWEEN 2021 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["205/65R16", "215/55R17", "225/45R18"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Camry' AND year BETWEEN 2012 AND 2014`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["215/60R16", "215/55R17"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Avalon' AND year BETWEEN 2005 AND 2012`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["225/60R18", "225/55R19"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Venza' AND year BETWEEN 2021 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["245/70R18", "265/70R18", "265/60R20"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Land Cruiser' AND year BETWEEN 2024 AND 2026`);
  fixedCount += r.rowCount;
  
  // Lexus fixes
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["265/65R18", "265/55R20", "265/50R22"]'::jsonb WHERE make ILIKE 'Lexus' AND model ILIKE 'LX%' AND year BETWEEN 2022 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["275/70R16"]'::jsonb WHERE make ILIKE 'Lexus' AND model ILIKE 'LX%' AND year BETWEEN 2000 AND 2007`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["235/45R18", "235/40R19", "255/35R19", "265/35R19"]'::jsonb WHERE make ILIKE 'Lexus' AND model ILIKE 'RC%' AND year BETWEEN 2015 AND 2025`);
  fixedCount += r.rowCount;
  
  // VW fixes
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["245/45R18", "245/40R19", "245/35R20"]'::jsonb WHERE make ILIKE 'Volkswagen' AND model ILIKE 'Arteon' AND year BETWEEN 2020 AND 2025`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["225/45R17", "225/40R18", "235/35R19"]'::jsonb WHERE make ILIKE 'Volkswagen' AND model ILIKE 'GTI' AND year BETWEEN 2022 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["205/65R16", "205/60R16", "205/55R17", "225/45R18"]'::jsonb WHERE make ILIKE 'Volkswagen' AND model ILIKE 'Jetta' AND model NOT ILIKE '%GLI%' AND year BETWEEN 2019 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["195/65R15", "205/55R16", "225/45R17"]'::jsonb WHERE make ILIKE 'Volkswagen' AND model ILIKE 'Passat' AND year BETWEEN 2000 AND 2005`);
  fixedCount += r.rowCount;
  
  // Volvo fixes
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["235/45R18", "235/40R19", "245/40R19", "255/35R20"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'S60' AND year BETWEEN 2019 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["205/55R16", "215/55R16", "225/45R17", "235/40R18"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'S60' AND year BETWEEN 2001 AND 2009`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["225/70R16", "235/65R17", "235/60R18", "255/50R19", "255/45R20"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'XC90' AND year BETWEEN 2003 AND 2014`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["245/45R18", "255/40R19", "255/35R20"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'S90' AND year BETWEEN 2017 AND 2026`);
  fixedCount += r.rowCount;
  
  // Suzuki fixes
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["235/60R16", "225/70R16"]'::jsonb WHERE make ILIKE 'Suzuki' AND model ILIKE 'Grand Vitara' AND year BETWEEN 2000 AND 2005`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["215/60R16", "215/55R17", "235/45R18"]'::jsonb WHERE make ILIKE 'Suzuki' AND model ILIKE 'Kizashi' AND year BETWEEN 2010 AND 2013`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["195/65R15", "205/60R16", "205/50R17"]'::jsonb WHERE make ILIKE 'Suzuki' AND model ILIKE 'SX4' AND year BETWEEN 2007 AND 2013`);
  fixedCount += r.rowCount;
  
  // Kia fixes
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["205/55R16", "215/45R17", "225/40R18"]'::jsonb WHERE make ILIKE 'Kia' AND model ILIKE 'Forte%' AND year BETWEEN 2019 AND 2026`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["255/60R19", "275/50R20", "285/45R21"]'::jsonb WHERE make ILIKE 'Kia' AND model ILIKE 'EV9' AND year BETWEEN 2024 AND 2026`);
  fixedCount += r.rowCount;
  
  // Prius fixes
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["175/65R14"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Prius' AND model NOT ILIKE '%V%' AND model NOT ILIKE '%Prime%' AND model NOT ILIKE '%Plug%' AND year BETWEEN 2000 AND 2003`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["185/65R15", "195/55R16"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Prius' AND model NOT ILIKE '%V%' AND model NOT ILIKE '%Prime%' AND model NOT ILIKE '%Plug%' AND year BETWEEN 2004 AND 2009`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["195/65R15", "215/45R17"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Prius' AND model NOT ILIKE '%V%' AND model NOT ILIKE '%Prime%' AND model NOT ILIKE '%Plug%' AND year BETWEEN 2010 AND 2022`);
  fixedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["195/60R17", "195/50R19"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Prius' AND model NOT ILIKE '%V%' AND model NOT ILIKE '%Prime%' AND model NOT ILIKE '%Plug%' AND year BETWEEN 2023 AND 2026`);
  fixedCount += r.rowCount;
  
  console.log(`   ✅ Fixed ${fixedCount} tire size records`);

  // ============================================================
  // STEP 4: POPULATE EMPTY RECORDS
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('4️⃣  POPULATING EMPTY RECORDS...');
  console.log('='.repeat(60));
  
  let populatedCount = 0;
  
  // VW
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["195/65R15", "205/55R16", "225/45R17"]'::jsonb WHERE make ILIKE 'Volkswagen' AND model ILIKE 'Golf SportWagen' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["195/65R15", "205/55R16", "225/45R17"]'::jsonb WHERE make ILIKE 'Volkswagen' AND model ILIKE 'Rabbit' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["225/65R16", "225/65R17"]'::jsonb WHERE make ILIKE 'Volkswagen' AND model ILIKE 'Routan' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  // Volvo
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["205/55R16", "205/50R17", "215/45R18"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'V50' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["235/50R19", "245/45R20", "245/40R21"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'V90 Cross Country' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["195/65R15", "205/55R16", "205/50R17", "215/45R18"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'S40' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["225/50R17", "235/50R17", "245/40R18", "245/35R19"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'S80' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["235/50R19", "235/45R20", "255/40R20"]'::jsonb WHERE make ILIKE 'Volvo' AND model ILIKE 'C40' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  // Toyota
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["205/65R15", "215/60R16", "215/55R17"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'Solara' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["215/60R17", "225/50R18"]'::jsonb WHERE make ILIKE 'Toyota' AND model ILIKE 'C-HR' AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["205/55R16", "215/45R17", "215/40R18"]'::jsonb WHERE make ILIKE 'Toyota' AND (model ILIKE '86' OR model ILIKE 'GT-86' OR model ILIKE 'GT86') AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  // Subaru
  r = await client.query(`UPDATE vehicle_fitments SET oem_tire_sizes = '["245/40R18", "245/35R19"]'::jsonb WHERE make ILIKE 'Subaru' AND model ILIKE '%WRX%STI%' AND year BETWEEN 2014 AND 2021 AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)`);
  populatedCount += r.rowCount;
  
  console.log(`   ✅ Populated ${populatedCount} empty records`);

  // ============================================================
  // FINAL COUNTS
  // ============================================================
  const afterTotal = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
  const afterEmpty = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb
  `);
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 CLEANUP COMPLETE!');
  console.log('='.repeat(60));
  console.log(`\n📊 RESULTS:`);
  console.log(`   Before: ${beforeTotal.rows[0].count} records (${beforeEmpty.rows[0].count} empty)`);
  console.log(`   After:  ${afterTotal.rows[0].count} records (${afterEmpty.rows[0].count} empty)`);
  console.log(`   Deleted: ${parseInt(beforeTotal.rows[0].count) - parseInt(afterTotal.rows[0].count)} records`);
  console.log(`   Fixed:   ${fixedCount} tire size records`);
  console.log(`   Populated: ${populatedCount} empty records`);
  
  // Verify key fixes
  console.log('\n📌 VERIFICATION (sample corrected records):');
  const verify = await client.query(`
    SELECT make, model, year, oem_tire_sizes::text as sizes
    FROM vehicle_fitments
    WHERE (make ILIKE 'Toyota' AND model ILIKE '%GR%Corolla%' AND year = 2024)
       OR (make ILIKE 'Volkswagen' AND model ILIKE 'GTI' AND year = 2024)
       OR (make ILIKE 'Lexus' AND model ILIKE 'LX%' AND year = 2024)
    ORDER BY make, model
  `);
  for (const row of verify.rows) {
    console.log(`   ${row.make} ${row.model} ${row.year}: ${row.sizes}`);
  }
  
  console.log('\n✅ Done! Remember to clear the tire cache.\n');
  
  await client.end();
}

main().catch(console.error);
