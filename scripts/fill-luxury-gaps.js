const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const genModId = () => 'manual_' + crypto.randomBytes(6).toString('hex');

const records = [
  // ============================================
  // BMW X6 - Fill 2013-2023 (has 2012, 2024, 2025)
  // ============================================
  ...Array.from({length: 11}, (_, i) => ({
    year: 2013 + i, make: 'bmw', model: 'x6', display_trim: 'xDrive35i, xDrive50i',
    bolt_pattern: '5x120', center_bore_mm: 72.6, offset_min_mm: 30, offset_max_mm: 45,
    oem_wheel_sizes: '19x9, 20x10', oem_tire_sizes: '255/50R19, 275/40R20',
    thread_size: 'M14x1.25', seat_type: 'conical'
  })),

  // ============================================
  // BMW X1 - Fill 2015-2021 (has 2014, 2022)
  // ============================================
  ...Array.from({length: 7}, (_, i) => ({
    year: 2015 + i, make: 'bmw', model: 'x1', display_trim: 'xDrive28i, sDrive28i',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: '17x7.5, 18x8, 19x8', oem_tire_sizes: '225/55R17, 225/50R18, 225/45R19',
    thread_size: 'M14x1.25', seat_type: 'conical'
  })),

  // ============================================
  // BMW X4 - Fill 2015-2020 (has 2014, 2021)
  // ============================================
  ...Array.from({length: 6}, (_, i) => ({
    year: 2015 + i, make: 'bmw', model: 'x4', display_trim: 'xDrive28i, xDrive35i, M40i',
    bolt_pattern: '5x120', center_bore_mm: 72.6, offset_min_mm: 35, offset_max_mm: 45,
    oem_wheel_sizes: '18x8, 19x8.5, 20x9', oem_tire_sizes: '245/50R18, 245/45R19, 245/40R20',
    thread_size: 'M14x1.25', seat_type: 'conical'
  })),

  // ============================================
  // BMW 7-Series - Fill gaps 2012-2023
  // ============================================
  ...[2012, 2015, 2016, 2017, 2018, 2020, 2021, 2022, 2023].map(year => ({
    year, make: 'bmw', model: '7-series', display_trim: '740i, 750i, M760i',
    bolt_pattern: '5x120', center_bore_mm: 72.6, offset_min_mm: 24, offset_max_mm: 40,
    oem_wheel_sizes: '18x8, 19x8.5, 20x9', oem_tire_sizes: '245/50R18, 245/45R19, 245/40R20',
    thread_size: 'M14x1.25', seat_type: 'conical'
  })),

  // ============================================
  // AUDI Q3 - Fill 2016-2024 (has 2015, 2025)
  // ============================================
  ...Array.from({length: 9}, (_, i) => ({
    year: 2016 + i, make: 'audi', model: 'q3', display_trim: 'Premium, Premium Plus, Prestige',
    bolt_pattern: '5x112', center_bore_mm: 57.1, offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: '17x7, 18x7.5, 19x8', oem_tire_sizes: '215/60R17, 235/55R18, 235/50R19',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),

  // ============================================
  // AUDI A8 - Fill gaps 2013-2020
  // ============================================
  ...[2013, 2014, 2016, 2018, 2020].map(year => ({
    year, make: 'audi', model: 'a8', display_trim: 'L, L Quattro',
    bolt_pattern: '5x112', center_bore_mm: 66.5, offset_min_mm: 25, offset_max_mm: 40,
    oem_wheel_sizes: '18x8, 19x8.5, 20x9', oem_tire_sizes: '245/55R18, 255/45R19, 265/40R20',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),

  // ============================================
  // AUDI Q8 - Fill 2019-2020
  // ============================================
  ...[2019, 2020].map(year => ({
    year, make: 'audi', model: 'q8', display_trim: 'Premium, Premium Plus, Prestige',
    bolt_pattern: '5x112', center_bore_mm: 66.5, offset_min_mm: 25, offset_max_mm: 40,
    oem_wheel_sizes: '21x9.5, 22x10', oem_tire_sizes: '285/45R21, 285/40R22',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),

  // ============================================
  // AUDI S4 - Fill gaps 2003, 2009, 2017
  // ============================================
  { year: 2003, make: 'audi', model: 's4', display_trim: 'Avant, Sedan', bolt_pattern: '5x112', center_bore_mm: 57.1, offset_min_mm: 35, offset_max_mm: 45, oem_wheel_sizes: '17x7.5, 18x8', oem_tire_sizes: '235/45R17, 245/40R18', thread_size: 'M14x1.5', seat_type: 'ball' },
  { year: 2009, make: 'audi', model: 's4', display_trim: 'Premium, Premium Plus', bolt_pattern: '5x112', center_bore_mm: 66.5, offset_min_mm: 35, offset_max_mm: 45, oem_wheel_sizes: '18x8, 19x8.5', oem_tire_sizes: '245/40R18, 255/35R19', thread_size: 'M14x1.5', seat_type: 'ball' },
  { year: 2017, make: 'audi', model: 's4', display_trim: 'Premium Plus, Prestige', bolt_pattern: '5x112', center_bore_mm: 66.5, offset_min_mm: 30, offset_max_mm: 45, oem_wheel_sizes: '18x8, 19x8.5', oem_tire_sizes: '245/40R18, 255/35R19', thread_size: 'M14x1.5', seat_type: 'ball' },

  // ============================================
  // CADILLAC CT4 - Fill 2021-2023
  // ============================================
  ...Array.from({length: 3}, (_, i) => ({
    year: 2021 + i, make: 'cadillac', model: 'ct4', display_trim: 'Luxury, Premium Luxury, Sport, V',
    bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: '17x8, 18x8.5, 19x9', oem_tire_sizes: '225/50R17, 235/45R18, 245/40R19',
    thread_size: 'M14x1.5', seat_type: 'conical'
  })),

  // ============================================
  // CADILLAC CT5 - Fill 2020
  // ============================================
  { year: 2020, make: 'cadillac', model: 'ct5', display_trim: 'Luxury, Premium Luxury, Sport, V', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '17x8, 18x8.5, 19x9', oem_tire_sizes: '225/55R17, 245/45R18, 245/40R19', thread_size: 'M14x1.5', seat_type: 'conical' },

  // ============================================
  // CADILLAC XT4 - Fill 2022-2024
  // ============================================
  ...Array.from({length: 3}, (_, i) => ({
    year: 2022 + i, make: 'cadillac', model: 'xt4', display_trim: 'Luxury, Premium Luxury, Sport',
    bolt_pattern: '5x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: '18x8, 20x8.5', oem_tire_sizes: '235/60R18, 245/45R20',
    thread_size: 'M12x1.5', seat_type: 'conical'
  })),

  // ============================================
  // JAGUAR E-PACE - Fill 2018-2022
  // ============================================
  ...Array.from({length: 5}, (_, i) => ({
    year: 2018 + i, make: 'jaguar', model: 'e-pace', display_trim: 'S, SE, HSE, R-Dynamic',
    bolt_pattern: '5x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: '17x7.5, 18x8, 19x8', oem_tire_sizes: '235/65R17, 245/55R18, 245/50R19',
    thread_size: 'M12x1.5', seat_type: 'conical'
  })),

  // ============================================
  // LEXUS UX - Fill 2019, 2022-2023
  // ============================================
  ...[2019, 2022, 2023].map(year => ({
    year, make: 'lexus', model: 'ux', display_trim: 'UX 200, UX 250h',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: '17x7, 18x7', oem_tire_sizes: '215/60R17, 225/50R18',
    thread_size: 'M12x1.5', seat_type: 'conical'
  })),

  // ============================================
  // LEXUS LC - Fill 2018-2019
  // ============================================
  ...[2018, 2019].map(year => ({
    year, make: 'lexus', model: 'lc', display_trim: 'LC 500, LC 500h',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: '20x8 front, 20x10.5 rear, 21x9 front, 21x11 rear', oem_tire_sizes: '245/45R20, 275/40R20, 245/40R21, 275/35R21',
    thread_size: 'M14x1.5', seat_type: 'conical'
  })),

  // ============================================
  // MERCEDES-BENZ - Major gap fill
  // ============================================
  // C-Class 2000-2026
  ...Array.from({length: 27}, (_, i) => ({
    year: 2000 + i, make: 'mercedes-benz', model: 'c-class', display_trim: 'C300, C350, C400, C43 AMG, C63 AMG',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: '17x7.5, 18x8, 19x8.5', oem_tire_sizes: '225/50R17, 225/45R18, 235/40R19',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),
  // E-Class 2000-2026
  ...Array.from({length: 27}, (_, i) => ({
    year: 2000 + i, make: 'mercedes-benz', model: 'e-class', display_trim: 'E300, E350, E450, E53 AMG, E63 AMG',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 30, offset_max_mm: 48,
    oem_wheel_sizes: '17x8, 18x8.5, 19x9, 20x9', oem_tire_sizes: '225/55R17, 245/45R18, 245/40R19, 245/35R20',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),
  // S-Class 2000-2026
  ...Array.from({length: 27}, (_, i) => ({
    year: 2000 + i, make: 'mercedes-benz', model: 's-class', display_trim: 'S500, S550, S580, S63 AMG, Maybach',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 25, offset_max_mm: 45,
    oem_wheel_sizes: '18x8.5, 19x9, 20x9.5, 21x10', oem_tire_sizes: '245/50R18, 255/45R19, 255/40R20, 265/35R21',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),
  // GLC 2016-2026
  ...Array.from({length: 11}, (_, i) => ({
    year: 2016 + i, make: 'mercedes-benz', model: 'glc', display_trim: 'GLC 300, GLC 43 AMG, GLC 63 AMG',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: '18x8, 19x8, 20x9', oem_tire_sizes: '235/60R18, 235/55R19, 255/45R20',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),
  // GLE 2015-2026
  ...Array.from({length: 12}, (_, i) => ({
    year: 2015 + i, make: 'mercedes-benz', model: 'gle', display_trim: 'GLE 350, GLE 450, GLE 53 AMG, GLE 63 AMG',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 35, offset_max_mm: 52,
    oem_wheel_sizes: '19x8.5, 20x9, 21x10', oem_tire_sizes: '255/50R19, 275/45R20, 275/40R21',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),
  // GLA 2015-2026
  ...Array.from({length: 12}, (_, i) => ({
    year: 2015 + i, make: 'mercedes-benz', model: 'gla', display_trim: 'GLA 250, GLA 35 AMG, GLA 45 AMG',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: '17x7, 18x7.5, 19x8', oem_tire_sizes: '215/60R17, 235/50R18, 235/45R19',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),
  // CLA 2014-2026
  ...Array.from({length: 13}, (_, i) => ({
    year: 2014 + i, make: 'mercedes-benz', model: 'cla', display_trim: 'CLA 250, CLA 35 AMG, CLA 45 AMG',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 40, offset_max_mm: 52,
    oem_wheel_sizes: '17x7.5, 18x8, 19x8', oem_tire_sizes: '225/45R17, 225/40R18, 235/35R19',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),
  // A-Class 2019-2026
  ...Array.from({length: 8}, (_, i) => ({
    year: 2019 + i, make: 'mercedes-benz', model: 'a-class', display_trim: 'A 220, A 35 AMG',
    bolt_pattern: '5x112', center_bore_mm: 66.6, offset_min_mm: 45, offset_max_mm: 52,
    oem_wheel_sizes: '17x7, 18x7.5, 19x8', oem_tire_sizes: '205/55R17, 225/45R18, 225/40R19',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),

  // ============================================
  // MINOR LUXURY GAP FILLS
  // ============================================
  // BMW M3 gaps
  ...[2007, 2014, 2020].map(year => ({
    year, make: 'bmw', model: 'm3', display_trim: 'Base, Competition',
    bolt_pattern: '5x120', center_bore_mm: 72.6, offset_min_mm: 23, offset_max_mm: 35,
    oem_wheel_sizes: '18x8 front, 18x9 rear, 19x9 front, 19x10 rear', oem_tire_sizes: '245/40R18, 265/40R18, 255/35R19, 275/35R19',
    thread_size: 'M14x1.25', seat_type: 'conical'
  })),
  // BMW M5 gaps  
  ...[2004, 2011].map(year => ({
    year, make: 'bmw', model: 'm5', display_trim: 'Base',
    bolt_pattern: '5x120', center_bore_mm: 72.6, offset_min_mm: 15, offset_max_mm: 30,
    oem_wheel_sizes: '19x8.5 front, 19x9.5 rear, 20x9 front, 20x10 rear', oem_tire_sizes: '255/40R19, 285/35R19, 265/35R20, 295/30R20',
    thread_size: 'M14x1.25', seat_type: 'conical'
  })),
  // Acura MDX 2021
  { year: 2021, make: 'acura', model: 'mdx', display_trim: 'Base, Technology, A-Spec, Advance, Type S', bolt_pattern: '5x120', center_bore_mm: 64.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '19x8.5, 20x9, 21x9.5', oem_tire_sizes: '255/50R19, 265/45R20, 275/40R21', thread_size: 'M14x1.5', seat_type: 'conical' },
  // Cadillac DTS 2008
  { year: 2008, make: 'cadillac', model: 'dts', display_trim: 'Luxury, Performance, Platinum', bolt_pattern: '5x115', center_bore_mm: 70.3, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7.5, 18x8', oem_tire_sizes: '235/55R17, 235/50R18', thread_size: 'M12x1.5', seat_type: 'conical' },
  // Infiniti QX50 2018
  { year: 2018, make: 'infiniti', model: 'qx50', display_trim: 'Luxe, Essential, Sensory, Autograph', bolt_pattern: '5x114.3', center_bore_mm: 66.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '19x8.5, 20x9', oem_tire_sizes: '235/55R19, 255/45R20', thread_size: 'M12x1.25', seat_type: 'conical' },
  // Infiniti QX55 2022-2023
  ...[2022, 2023].map(year => ({
    year, make: 'infiniti', model: 'qx55', display_trim: 'Luxe, Essential, Sensory',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1, offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: '20x9', oem_tire_sizes: '255/45R20',
    thread_size: 'M12x1.25', seat_type: 'conical'
  })),
  // Jaguar F-Type 2013
  { year: 2013, make: 'jaguar', model: 'f-type', display_trim: 'Base, S, V8 S', bolt_pattern: '5x108', center_bore_mm: 63.4, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '18x8 front, 18x9.5 rear, 19x9 front, 19x10.5 rear', oem_tire_sizes: '245/45R18, 275/40R18, 255/40R19, 295/35R19', thread_size: 'M12x1.5', seat_type: 'conical' },
  // Mini Clubman 2015
  { year: 2015, make: 'mini', model: 'clubman', display_trim: 'Cooper, Cooper S, JCW', bolt_pattern: '5x112', center_bore_mm: 66.5, offset_min_mm: 46, offset_max_mm: 52, oem_wheel_sizes: '16x7, 17x7.5, 18x8', oem_tire_sizes: '195/55R16, 205/50R17, 225/40R18', thread_size: 'M14x1.25', seat_type: 'conical' },
  // Maserati GranTurismo 2020-2022
  ...[2020, 2021, 2022].map(year => ({
    year, make: 'maserati', model: 'granturismo', display_trim: 'Sport, MC',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 30, offset_max_mm: 45,
    oem_wheel_sizes: '20x9.5 front, 20x10.5 rear', oem_tire_sizes: '255/35R20, 295/30R20',
    thread_size: 'M14x1.5', seat_type: 'conical'
  })),
  // Volvo V90 2018-2021
  ...[2018, 2019, 2021].map(year => ({
    year, make: 'volvo', model: 'v90', display_trim: 'T5, T6, T8, Cross Country',
    bolt_pattern: '5x108', center_bore_mm: 63.4, offset_min_mm: 45, offset_max_mm: 55,
    oem_wheel_sizes: '18x8, 19x8, 20x8.5', oem_tire_sizes: '245/45R18, 245/40R19, 255/35R20',
    thread_size: 'M14x1.5', seat_type: 'conical'
  })),
  // Audi A3 2004-2005
  ...[2004, 2005].map(year => ({
    year, make: 'audi', model: 'a3', display_trim: '2.0T, 3.2 Quattro',
    bolt_pattern: '5x112', center_bore_mm: 57.1, offset_min_mm: 42, offset_max_mm: 50,
    oem_wheel_sizes: '16x6.5, 17x7, 18x7.5', oem_tire_sizes: '205/55R16, 225/45R17, 225/40R18',
    thread_size: 'M14x1.5', seat_type: 'ball'
  })),
];

async function insertRecords() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  let added = 0, skipped = 0;
  const counts = {};
  
  for (const rec of records) {
    const exists = await pool.query(
      `SELECT id FROM vehicle_fitments WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4`,
      [rec.year, rec.make, rec.model, rec.display_trim]
    );
    
    if (exists.rows.length > 0) {
      skipped++;
      continue;
    }
    
    const wheelSizes = JSON.stringify(rec.oem_wheel_sizes.split(', '));
    const tireSizes = JSON.stringify(rec.oem_tire_sizes.split(', '));
    const modId = genModId();
    
    await pool.query(`
      INSERT INTO vehicle_fitments (
        year, make, model, display_trim, bolt_pattern, center_bore_mm,
        offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
        thread_size, seat_type, modification_id, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      rec.year, rec.make, rec.model, rec.display_trim, rec.bolt_pattern,
      rec.center_bore_mm, rec.offset_min_mm, rec.offset_max_mm, wheelSizes,
      tireSizes, rec.thread_size, rec.seat_type, modId, 'luxury-gap-fill'
    ]);
    
    added++;
    const key = `${rec.make} ${rec.model}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  
  console.log(`✅ Added: ${added}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log('\n📊 Records by vehicle:');
  for (const [k, v] of Object.entries(counts).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log(`\n📈 Total records: ${total.rows[0].count}`);
  
  await pool.end();
}

insertRecords();
