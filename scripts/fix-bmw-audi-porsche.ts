/**
 * Fix BMW + Audi + Porsche Fitment Data
 * 
 * Based on Google AI Overview research for:
 * - BMW: Z4, M6, M2, M8, X-series, i-series
 * - Audi: S5, A5, A7, allroad, RS series
 * - Porsche: 718, 918, Cayman
 * 
 * Run: npx tsx scripts/fix-bmw-audi-porsche.ts
 */

import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)?.[1];
if (!url) throw new Error('POSTGRES_URL not found');

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// ============================================================================
// BMW FITMENT DATA (Based on Google AI Overview research)
// ============================================================================

const BMW_FITMENTS: Record<string, {
  bolt: string;
  bore: number;
  wheels: Array<{ diameter: number; width: number; offset: number; axle: 'front' | 'rear'; isStock: boolean }>;
  tires: string[];
}> = {
  // Z4 (E85/E86) 2002-2008
  'Z4:2002-2008': {
    bolt: '5x120',
    bore: 72.6,
    wheels: [
      { diameter: 18, width: 8, offset: 47, axle: 'front', isStock: true },
      { diameter: 18, width: 9, offset: 40, axle: 'rear', isStock: true }
    ],
    tires: ['225/40R18', '255/35R18']
  },
  // Z4 (E89) 2009-2016
  'Z4:2009-2016': {
    bolt: '5x120',
    bore: 72.6,
    wheels: [
      { diameter: 18, width: 8, offset: 35, axle: 'front', isStock: true },
      { diameter: 18, width: 8.5, offset: 35, axle: 'rear', isStock: true }
    ],
    tires: ['225/40R18', '255/35R18']
  },
  // Z4 (G29) 2019-2026
  'Z4:2019-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 19, width: 9, offset: 32, axle: 'front', isStock: true },
      { diameter: 19, width: 10, offset: 40, axle: 'rear', isStock: true }
    ],
    tires: ['255/35R19', '275/35R19']
  },
  // M6 (E63/E64) 2005-2010
  'M6:2005-2010': {
    bolt: '5x120',
    bore: 72.6,
    wheels: [
      { diameter: 19, width: 8.5, offset: 12, axle: 'front', isStock: true },
      { diameter: 19, width: 9.5, offset: 17, axle: 'rear', isStock: true }
    ],
    tires: ['255/40R19', '285/35R19']
  },
  // M6 (F12/F13/F06) 2012-2018
  'M6:2012-2018': {
    bolt: '5x120',
    bore: 72.6,
    wheels: [
      { diameter: 20, width: 9.5, offset: 31, axle: 'front', isStock: true },
      { diameter: 20, width: 10.5, offset: 19, axle: 'rear', isStock: true }
    ],
    tires: ['265/35R20', '295/30R20']
  },
  // M2 (F87) 2016-2021 - Uses 5x120
  'M2:2016-2021': {
    bolt: '5x120',
    bore: 72.6,
    wheels: [
      { diameter: 19, width: 9, offset: 29, axle: 'front', isStock: true },
      { diameter: 19, width: 10, offset: 40, axle: 'rear', isStock: true }
    ],
    tires: ['245/35R19', '265/35R19']
  },
  // M2 (G87) 2023-2026 - Uses 5x112
  'M2:2023-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 19, width: 9.5, offset: 20, axle: 'front', isStock: true },
      { diameter: 20, width: 10.5, offset: 20, axle: 'rear', isStock: true }
    ],
    tires: ['275/35R19', '285/30R20']
  },
  // M8 2019-2026 - 5x112
  'M8:2019-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 20, width: 9.5, offset: 26, axle: 'front', isStock: true },
      { diameter: 20, width: 10.5, offset: 35, axle: 'rear', isStock: true }
    ],
    tires: ['275/35R20', '285/35R20']
  },
  // X1 2016-2019 (F48)
  'X1:2016-2019': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 18, width: 7.5, offset: 51, axle: 'front', isStock: true },
      { diameter: 18, width: 7.5, offset: 51, axle: 'rear', isStock: true }
    ],
    tires: ['225/50R18']
  },
  // X1 2025-2026 (U11)
  'X1:2025-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 18, width: 7.5, offset: 47, axle: 'front', isStock: true },
      { diameter: 18, width: 7.5, offset: 47, axle: 'rear', isStock: true }
    ],
    tires: ['225/55R18']
  },
  // X2 2018-2026
  'X2:2018-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 18, width: 7.5, offset: 51, axle: 'front', isStock: true },
      { diameter: 18, width: 7.5, offset: 51, axle: 'rear', isStock: true }
    ],
    tires: ['225/50R18']
  },
  // X4 2017-2018 (F26) - 5x120
  'X4:2017-2018': {
    bolt: '5x120',
    bore: 72.6,
    wheels: [
      { diameter: 19, width: 8, offset: 43, axle: 'front', isStock: true },
      { diameter: 19, width: 9.5, offset: 39, axle: 'rear', isStock: true }
    ],
    tires: ['245/45R19', '275/40R19']
  },
  // X4 M 2020+
  'X4 M:2020-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 21, width: 9.5, offset: 31, axle: 'front', isStock: true },
      { diameter: 21, width: 10.5, offset: 40, axle: 'rear', isStock: true }
    ],
    tires: ['265/40R21', '295/35R21']
  },
  // X6 2008-2014 (E71) - 5x120
  'X6:2008-2014': {
    bolt: '5x120',
    bore: 74.1,
    wheels: [
      { diameter: 19, width: 9, offset: 48, axle: 'front', isStock: true },
      { diameter: 19, width: 10, offset: 21, axle: 'rear', isStock: true }
    ],
    tires: ['255/50R19', '285/45R19']
  },
  // X6 2015-2019 (F16) - 5x120
  'X6:2015-2019': {
    bolt: '5x120',
    bore: 74.1,
    wheels: [
      { diameter: 19, width: 9, offset: 48, axle: 'front', isStock: true },
      { diameter: 19, width: 10, offset: 21, axle: 'rear', isStock: true }
    ],
    tires: ['255/50R19', '285/45R19']
  },
  // X6 2020-2026 (G06) - 5x112
  'X6:2020-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 20, width: 9, offset: 35, axle: 'front', isStock: true },
      { diameter: 20, width: 10.5, offset: 43, axle: 'rear', isStock: true }
    ],
    tires: ['275/45R20', '305/40R20']
  },
  // X7 2019-2026
  'X7:2019-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 21, width: 9.5, offset: 36, axle: 'front', isStock: true },
      { diameter: 21, width: 10.5, offset: 43, axle: 'rear', isStock: true }
    ],
    tires: ['275/45R21', '305/40R21']
  },
  // XM 2023-2026
  'XM:2023-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 23, width: 10, offset: 34, axle: 'front', isStock: true },
      { diameter: 23, width: 11.5, offset: 40, axle: 'rear', isStock: true }
    ],
    tires: ['275/40R23', '315/35R23']
  },
  // Z3 2002
  'Z3:2002': {
    bolt: '5x120',
    bore: 72.6,
    wheels: [
      { diameter: 17, width: 7, offset: 47, axle: 'front', isStock: true },
      { diameter: 17, width: 8.5, offset: 41, axle: 'rear', isStock: true }
    ],
    tires: ['225/45R17', '245/40R17']
  },
  // Z8 2000-2003
  'Z8:2000-2003': {
    bolt: '5x120',
    bore: 72.6,
    wheels: [
      { diameter: 18, width: 8, offset: 13, axle: 'front', isStock: true },
      { diameter: 18, width: 9.5, offset: 12, axle: 'rear', isStock: true }
    ],
    tires: ['245/45R18', '275/40R18']
  },
  // i4 2024-2026
  'i4:2024-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 18, width: 8, offset: 26, axle: 'front', isStock: true },
      { diameter: 18, width: 9, offset: 41, axle: 'rear', isStock: true }
    ],
    tires: ['245/45R18', '255/45R18']
  },
  // i5 2026
  'i5:2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 19, width: 8.5, offset: 22, axle: 'front', isStock: true },
      { diameter: 19, width: 9.5, offset: 35, axle: 'rear', isStock: true }
    ],
    tires: ['245/45R19', '275/40R19']
  },
  // i7 2025-2026
  'i7:2025-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 20, width: 9, offset: 22, axle: 'front', isStock: true },
      { diameter: 20, width: 10, offset: 35, axle: 'rear', isStock: true }
    ],
    tires: ['255/45R20', '285/40R20']
  },
  // i8 2016-2020
  'i8:2016-2020': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 20, width: 7.5, offset: 40, axle: 'front', isStock: true },
      { diameter: 20, width: 9, offset: 46, axle: 'rear', isStock: true }
    ],
    tires: ['195/50R20', '245/40R20']
  },
  // iX 2022-2026
  'iX:2022-2026': {
    bolt: '5x112',
    bore: 66.6,
    wheels: [
      { diameter: 21, width: 9.5, offset: 30, axle: 'front', isStock: true },
      { diameter: 21, width: 10.5, offset: 43, axle: 'rear', isStock: true }
    ],
    tires: ['265/45R21', '295/40R21']
  }
};

// ============================================================================
// AUDI FITMENT DATA
// ============================================================================

const AUDI_FITMENTS: Record<string, {
  bolt: string;
  bore: number;
  wheels: Array<{ diameter: number; width: number; offset: number; axle: 'front' | 'rear'; isStock: boolean }>;
  tires: string[];
}> = {
  // S5 2010-2017 (B8/B8.5)
  'S5:2010-2017': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 19, width: 8.5, offset: 29, axle: 'front', isStock: true },
      { diameter: 19, width: 8.5, offset: 29, axle: 'rear', isStock: true }
    ],
    tires: ['255/35R19']
  },
  // S5 2018-2022 (B9)
  'S5:2018-2022': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 19, width: 8.5, offset: 32, axle: 'front', isStock: true },
      { diameter: 19, width: 8.5, offset: 32, axle: 'rear', isStock: true }
    ],
    tires: ['255/35R19']
  },
  // A5 2010-2017 (B8)
  'a5:2010-2017': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 18, width: 8, offset: 35, axle: 'front', isStock: true },
      { diameter: 18, width: 8, offset: 35, axle: 'rear', isStock: true }
    ],
    tires: ['245/40R18']
  },
  // A5 2018+
  'a5:2018-2023': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 18, width: 8, offset: 35, axle: 'front', isStock: true },
      { diameter: 18, width: 8, offset: 35, axle: 'rear', isStock: true }
    ],
    tires: ['245/40R18']
  },
  // A7 2014-2018
  'a7:2014-2018': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 19, width: 8.5, offset: 32, axle: 'front', isStock: true },
      { diameter: 19, width: 8.5, offset: 32, axle: 'rear', isStock: true }
    ],
    tires: ['255/40R19']
  },
  // A7 2019-2023
  'a7:2019-2023': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 19, width: 8.5, offset: 32, axle: 'front', isStock: true },
      { diameter: 19, width: 8.5, offset: 32, axle: 'rear', isStock: true }
    ],
    tires: ['255/40R19']
  },
  // A8 2000-2007 (D2/D3)
  'a8:2000-2007': {
    bolt: '5x112',
    bore: 57.1,
    wheels: [
      { diameter: 18, width: 8, offset: 45, axle: 'front', isStock: true },
      { diameter: 18, width: 8, offset: 45, axle: 'rear', isStock: true }
    ],
    tires: ['245/45R18']
  },
  // allroad 2001-2005
  'allroad:2001-2005': {
    bolt: '5x112',
    bore: 57.1,
    wheels: [
      { diameter: 17, width: 7.5, offset: 35, axle: 'front', isStock: true },
      { diameter: 17, width: 7.5, offset: 35, axle: 'rear', isStock: true }
    ],
    tires: ['225/55R17']
  },
  // allroad 2013-2016 (C7)
  'allroad:2013-2016': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 18, width: 8, offset: 39, axle: 'front', isStock: true },
      { diameter: 18, width: 8, offset: 39, axle: 'rear', isStock: true }
    ],
    tires: ['245/45R18']
  },
  // e-tron 2022-2023
  'e-tron:2022-2023': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 20, width: 9, offset: 33, axle: 'front', isStock: true },
      { diameter: 20, width: 9, offset: 33, axle: 'rear', isStock: true }
    ],
    tires: ['255/50R20']
  },
  // A6 e-tron 2025
  'A6 e-tron:2025': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 20, width: 9, offset: 33, axle: 'front', isStock: true },
      { diameter: 20, width: 9, offset: 33, axle: 'rear', isStock: true }
    ],
    tires: ['255/45R20']
  },
  // RS6 2020-2022
  'rs6:2020-2022': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 22, width: 10, offset: 25, axle: 'front', isStock: true },
      { diameter: 22, width: 10, offset: 25, axle: 'rear', isStock: true }
    ],
    tires: ['285/30R22']
  },
  // RS7 2014-2016
  'rs7:2014-2016': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 20, width: 9, offset: 37, axle: 'front', isStock: true },
      { diameter: 20, width: 9, offset: 37, axle: 'rear', isStock: true }
    ],
    tires: ['275/35R20']
  },
  // S3 2015-2018
  's3:2015-2018': {
    bolt: '5x112',
    bore: 57.1,
    wheels: [
      { diameter: 18, width: 7.5, offset: 51, axle: 'front', isStock: true },
      { diameter: 18, width: 7.5, offset: 51, axle: 'rear', isStock: true }
    ],
    tires: ['225/40R18']
  },
  // S6 2000-2003
  's6:2000-2003': {
    bolt: '5x112',
    bore: 57.1,
    wheels: [
      { diameter: 17, width: 7.5, offset: 35, axle: 'front', isStock: true },
      { diameter: 17, width: 7.5, offset: 35, axle: 'rear', isStock: true }
    ],
    tires: ['235/45R17']
  },
  // S6 2009-2017
  's6:2009-2017': {
    bolt: '5x112',
    bore: 66.5,
    wheels: [
      { diameter: 19, width: 8.5, offset: 29, axle: 'front', isStock: true },
      { diameter: 19, width: 8.5, offset: 29, axle: 'rear', isStock: true }
    ],
    tires: ['255/40R19']
  }
};

// ============================================================================
// PORSCHE FITMENT DATA
// ============================================================================

const PORSCHE_FITMENTS: Record<string, {
  bolt: string;
  bore: number;
  wheels: Array<{ diameter: number; width: number; offset: number; axle: 'front' | 'rear'; isStock: boolean }>;
  tires: string[];
}> = {
  // 718 Cayman/Boxster 2017-2025
  '718:2017-2025': {
    bolt: '5x130',
    bore: 71.6,
    wheels: [
      { diameter: 19, width: 8, offset: 57, axle: 'front', isStock: true },
      { diameter: 19, width: 9.5, offset: 45, axle: 'rear', isStock: true }
    ],
    tires: ['235/40R19', '265/40R19']
  },
  // 918 Spyder 2014-2015
  '918:2014-2015': {
    bolt: '5x130',
    bore: 71.6,
    wheels: [
      { diameter: 20, width: 9.5, offset: 50, axle: 'front', isStock: true },
      { diameter: 21, width: 12.5, offset: 48, axle: 'rear', isStock: true }
    ],
    tires: ['265/35R20', '325/30R21']
  },
  // Cayman 987 (2008-2012)
  'cayman:2008-2012': {
    bolt: '5x130',
    bore: 71.6,
    wheels: [
      { diameter: 18, width: 8, offset: 57, axle: 'front', isStock: true },
      { diameter: 18, width: 9, offset: 43, axle: 'rear', isStock: true }
    ],
    tires: ['235/40R18', '265/40R18']
  },
  // Cayman 981 (2013-2016)
  'cayman:2013-2016': {
    bolt: '5x130',
    bore: 71.6,
    wheels: [
      { diameter: 19, width: 8, offset: 57, axle: 'front', isStock: true },
      { diameter: 19, width: 9.5, offset: 45, axle: 'rear', isStock: true }
    ],
    tires: ['235/40R19', '265/40R19']
  }
};

// Helper to find matching fitment rule
function findFitmentRule(make: string, model: string, year: number): typeof BMW_FITMENTS[string] | null {
  const fitments = make === 'BMW' ? BMW_FITMENTS 
    : make === 'Audi' ? AUDI_FITMENTS 
    : make === 'Porsche' ? PORSCHE_FITMENTS 
    : {};
  
  // Try exact model:year-range match
  for (const [key, data] of Object.entries(fitments)) {
    const [modelKey, yearRange] = key.split(':');
    if (modelKey.toLowerCase() !== model.toLowerCase()) continue;
    
    if (yearRange.includes('-')) {
      const [startYear, endYear] = yearRange.split('-').map(Number);
      if (year >= startYear && year <= endYear) return data;
    } else if (parseInt(yearRange) === year) {
      return data;
    }
  }
  
  return null;
}

async function fixFitments() {
  console.log('🔧 Fixing BMW + Audi + Porsche fitments...\n');
  
  // Get all missing records
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim as trim, bolt_pattern, center_bore_mm, 
           oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make IN ('BMW', 'Audi', 'Porsche')
      AND (oem_wheel_sizes = '[]'::jsonb OR oem_tire_sizes = '[]'::jsonb 
           OR oem_wheel_sizes IS NULL OR oem_tire_sizes IS NULL)
    ORDER BY make, model, year
  `);
  
  console.log(`Found ${result.rows.length} missing records\n`);
  
  let updated = 0;
  let failed = 0;
  const failedRecords: Array<{ year: number; make: string; model: string; trim: string }> = [];
  
  for (const row of result.rows) {
    const { id, year, make, model, trim } = row;
    
    // Find matching fitment rule
    const fitment = findFitmentRule(make, model, year);
    
    if (!fitment) {
      console.log(`⚠️  No fitment rule for ${year} ${make} ${model} ${trim}`);
      failed++;
      failedRecords.push({ year, make, model, trim });
      continue;
    }
    
    // Build wheel sizes JSON
    const wheelSizes = fitment.wheels.map(w => ({
      diameter: w.diameter,
      width: w.width,
      offset: w.offset,
      axle: w.axle,
      isStock: w.isStock
    }));
    
    // Update the record
    await pool.query(`
      UPDATE vehicle_fitments
      SET 
        bolt_pattern = $1,
        center_bore_mm = $2,
        oem_wheel_sizes = $3::jsonb,
        oem_tire_sizes = $4::jsonb,
        quality_tier = 'complete',
        source = 'google-ai-overview',
        updated_at = NOW()
      WHERE id = $5
    `, [
      fitment.bolt,
      fitment.bore,
      JSON.stringify(wheelSizes),
      JSON.stringify(fitment.tires),
      id
    ]);
    
    console.log(`✅ ${year} ${make} ${model} ${trim} → ${fitment.wheels[0].diameter}" wheels`);
    updated++;
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  
  if (failedRecords.length > 0) {
    console.log(`\n❌ Failed records (need manual rules):`);
    for (const r of failedRecords) {
      console.log(`   ${r.year} ${r.make} ${r.model} ${r.trim}`);
    }
  }
  
  await pool.end();
}

fixFitments().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
