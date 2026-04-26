/**
 * Fix script for Chrysler + Dodge + Jeep missing fitment data (122 records)
 * Uses OEM specifications from Google AI Overview research
 * 
 * Run with: npx ts-node scripts/fix-chrysler-dodge-jeep.ts
 */

import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)?.[1];
if (!url) throw new Error('POSTGRES_URL not found');

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Type definition for fitment data
interface FitmentSpec {
  front_tire_width: number;
  front_tire_aspect: number;
  front_tire_diameter: number;
  front_wheel_width: number;
  front_wheel_diameter: number;
  front_wheel_offset: number;
  // For staggered setups
  rear_tire_width?: number;
  rear_tire_aspect?: number;
  rear_tire_diameter?: number;
  rear_wheel_width?: number;
  rear_wheel_diameter?: number;
  rear_wheel_offset?: number;
  isStaggered?: boolean;
  bolt_pattern?: string;
  center_bore_mm?: number;
}

// ============================================================
// CHRYSLER FITMENT DATA
// ============================================================

// Chrysler 200 (2011-2014 First Gen JS Platform)
// Bolt: 5x114.3, CB: 67.1mm
const chrysler200_2011_2014: FitmentSpec = {
  front_tire_width: 225,
  front_tire_aspect: 55,
  front_tire_diameter: 17,
  front_wheel_width: 6.5,
  front_wheel_diameter: 17,
  front_wheel_offset: 40,
  bolt_pattern: '5x114.3',
  center_bore_mm: 67.1
};

// Chrysler 200 (2015-2017 Second Gen UF Platform)
// Bolt: 5x110, CB: 65.1mm
const chrysler200_2015_2017: FitmentSpec = {
  front_tire_width: 215,
  front_tire_aspect: 55,
  front_tire_diameter: 17,
  front_wheel_width: 7.5,
  front_wheel_diameter: 17,
  front_wheel_offset: 41,
  bolt_pattern: '5x110',
  center_bore_mm: 65.1
};

// Chrysler PT Cruiser (2001-2010)
// Bolt: 5x100, CB: 57.1mm
const ptCruiser: FitmentSpec = {
  front_tire_width: 205,
  front_tire_aspect: 55,
  front_tire_diameter: 16,
  front_wheel_width: 6,
  front_wheel_diameter: 16,
  front_wheel_offset: 40,
  bolt_pattern: '5x100',
  center_bore_mm: 57.1
};

// Chrysler Town & Country (2002-2007 Gen IV)
// Bolt: 5x114.3, CB: 71.5mm
const townCountry_2002_2007: FitmentSpec = {
  front_tire_width: 215,
  front_tire_aspect: 65,
  front_tire_diameter: 16,
  front_wheel_width: 6.5,
  front_wheel_diameter: 16,
  front_wheel_offset: 40,
  bolt_pattern: '5x114.3',
  center_bore_mm: 71.5
};

// Chrysler Town & Country (2008-2016 Gen V)
// Bolt: 5x127, CB: 71.5mm
const townCountry_2008_2016: FitmentSpec = {
  front_tire_width: 225,
  front_tire_aspect: 65,
  front_tire_diameter: 17,
  front_wheel_width: 6.5,
  front_wheel_diameter: 17,
  front_wheel_offset: 40,
  bolt_pattern: '5x127',
  center_bore_mm: 71.5
};

// Chrysler Crossfire (2004-2008) - STAGGERED
// Bolt: 5x112, CB: 66.6mm (Mercedes platform)
const crossfire: FitmentSpec = {
  front_tire_width: 225,
  front_tire_aspect: 40,
  front_tire_diameter: 18,
  front_wheel_width: 7.5,
  front_wheel_diameter: 18,
  front_wheel_offset: 40,
  rear_tire_width: 255,
  rear_tire_aspect: 35,
  rear_tire_diameter: 19,
  rear_wheel_width: 9,
  rear_wheel_diameter: 19,
  rear_wheel_offset: 30,
  isStaggered: true,
  bolt_pattern: '5x112',
  center_bore_mm: 66.6
};

// Chrysler Pacifica old gen (2004-2008)
// Bolt: 5x127 (2005+) or 5x114.3 (2004), CB: 71.5mm
const pacifica_old: FitmentSpec = {
  front_tire_width: 235,
  front_tire_aspect: 65,
  front_tire_diameter: 17,
  front_wheel_width: 7,
  front_wheel_diameter: 17,
  front_wheel_offset: 41,
  bolt_pattern: '5x127',
  center_bore_mm: 71.5
};

// Chrysler Sebring (2000-2006 Gen 2)
// Bolt: 5x100, CB: 57.1mm
const sebring_2000_2006: FitmentSpec = {
  front_tire_width: 205,
  front_tire_aspect: 60,
  front_tire_diameter: 16,
  front_wheel_width: 6.5,
  front_wheel_diameter: 16,
  front_wheel_offset: 40,
  bolt_pattern: '5x100',
  center_bore_mm: 57.1
};

// Chrysler Sebring (2007-2010 Gen 3 JS)
// Bolt: 5x114.3, CB: 67.1mm
const sebring_2007_2010: FitmentSpec = {
  front_tire_width: 215,
  front_tire_aspect: 55,
  front_tire_diameter: 17,
  front_wheel_width: 6.5,
  front_wheel_diameter: 17,
  front_wheel_offset: 40,
  bolt_pattern: '5x114.3',
  center_bore_mm: 67.1
};

// ============================================================
// DODGE FITMENT DATA  
// ============================================================

// Dodge Journey (2009-2020)
// Bolt: 5x127, CB: 71.5mm
const journey: FitmentSpec = {
  front_tire_width: 225,
  front_tire_aspect: 55,
  front_tire_diameter: 17,
  front_wheel_width: 6.5,
  front_wheel_diameter: 17,
  front_wheel_offset: 42,
  bolt_pattern: '5x127',
  center_bore_mm: 71.5
};

// Dodge Dart (2013-2016)
// Bolt: 5x110, CB: 65.1mm (same as Chrysler 200 UF)
const dart: FitmentSpec = {
  front_tire_width: 205,
  front_tire_aspect: 55,
  front_tire_diameter: 16,
  front_wheel_width: 7,
  front_wheel_diameter: 16,
  front_wheel_offset: 40,
  bolt_pattern: '5x110',
  center_bore_mm: 65.1
};

// Dodge Viper (2000-2002 Gen 2 SR II) - STAGGERED
// Bolt: 5x114.3, CB: 71.5mm
const viper_2000_2002: FitmentSpec = {
  front_tire_width: 275,
  front_tire_aspect: 35,
  front_tire_diameter: 18,
  front_wheel_width: 10,
  front_wheel_diameter: 18,
  front_wheel_offset: 51,
  rear_tire_width: 335,
  rear_tire_aspect: 30,
  rear_tire_diameter: 18,
  rear_wheel_width: 13,
  rear_wheel_diameter: 18,
  rear_wheel_offset: 71,
  isStaggered: true,
  bolt_pattern: '5x114.3',
  center_bore_mm: 71.5
};

// Dodge Viper (2003-2006 Gen 3 ZB I) - STAGGERED
const viper_2003_2006: FitmentSpec = {
  front_tire_width: 275,
  front_tire_aspect: 35,
  front_tire_diameter: 18,
  front_wheel_width: 10,
  front_wheel_diameter: 18,
  front_wheel_offset: 51,
  rear_tire_width: 345,
  rear_tire_aspect: 30,
  rear_tire_diameter: 19,
  rear_wheel_width: 13,
  rear_wheel_diameter: 19,
  rear_wheel_offset: 71,
  isStaggered: true,
  bolt_pattern: '5x114.3',
  center_bore_mm: 71.5
};

// Dodge Viper (2008-2010 Gen 4 ZB II) - STAGGERED
const viper_2008_2010: FitmentSpec = {
  front_tire_width: 295,
  front_tire_aspect: 30,
  front_tire_diameter: 18,
  front_wheel_width: 10,
  front_wheel_diameter: 18,
  front_wheel_offset: 51,
  rear_tire_width: 345,
  rear_tire_aspect: 30,
  rear_tire_diameter: 19,
  rear_wheel_width: 13,
  rear_wheel_diameter: 19,
  rear_wheel_offset: 71,
  isStaggered: true,
  bolt_pattern: '5x114.3',
  center_bore_mm: 71.5
};

// Dodge Viper (2013-2017 Gen 5 VX I) - STAGGERED
const viper_2013_2017: FitmentSpec = {
  front_tire_width: 295,
  front_tire_aspect: 30,
  front_tire_diameter: 18,
  front_wheel_width: 10.5,
  front_wheel_diameter: 18,
  front_wheel_offset: 0,
  rear_tire_width: 355,
  rear_tire_aspect: 30,
  rear_tire_diameter: 19,
  rear_wheel_width: 13,
  rear_wheel_diameter: 19,
  rear_wheel_offset: 0,
  isStaggered: true,
  bolt_pattern: '5x114.3',
  center_bore_mm: 71.5
};

// ============================================================
// JEEP FITMENT DATA
// ============================================================

// Jeep Grand Cherokee (1999-2004 WJ)
// Bolt: 5x127, CB: 71.5mm
const grandCherokee_1999_2004: FitmentSpec = {
  front_tire_width: 245,
  front_tire_aspect: 70,
  front_tire_diameter: 16,
  front_wheel_width: 7,
  front_wheel_diameter: 16,
  front_wheel_offset: 44,
  bolt_pattern: '5x127',
  center_bore_mm: 71.5
};

// Jeep Grand Cherokee (2005-2010 WK)
// Bolt: 5x127, CB: 71.5mm
const grandCherokee_2005_2010: FitmentSpec = {
  front_tire_width: 245,
  front_tire_aspect: 65,
  front_tire_diameter: 17,
  front_wheel_width: 7.5,
  front_wheel_diameter: 17,
  front_wheel_offset: 50,
  bolt_pattern: '5x127',
  center_bore_mm: 71.5
};

// Jeep Grand Wagoneer (2022-2025)
// Bolt: 5x127, CB: 71.5mm
const grandWagoneer: FitmentSpec = {
  front_tire_width: 275,
  front_tire_aspect: 50,
  front_tire_diameter: 20,
  front_wheel_width: 8.5,
  front_wheel_diameter: 20,
  front_wheel_offset: 44,
  bolt_pattern: '5x127',
  center_bore_mm: 71.5
};

// Jeep Wagoneer (2022-2025)
// Bolt: 5x127, CB: 71.5mm
const wagoneer: FitmentSpec = {
  front_tire_width: 275,
  front_tire_aspect: 50,
  front_tire_diameter: 20,
  front_wheel_width: 8.5,
  front_wheel_diameter: 20,
  front_wheel_offset: 44,
  bolt_pattern: '5x127',
  center_bore_mm: 71.5
};

// Jeep Liberty (2002-2007 KJ)
// Bolt: 5x114.3, CB: 71.5mm
const liberty_2002_2007: FitmentSpec = {
  front_tire_width: 235,
  front_tire_aspect: 70,
  front_tire_diameter: 16,
  front_wheel_width: 7,
  front_wheel_diameter: 16,
  front_wheel_offset: 40,
  bolt_pattern: '5x114.3',
  center_bore_mm: 71.5
};

// Jeep Liberty (2008-2012 KK)
// Bolt: 5x114.3, CB: 71.5mm
const liberty_2008_2012: FitmentSpec = {
  front_tire_width: 235,
  front_tire_aspect: 65,
  front_tire_diameter: 17,
  front_wheel_width: 7,
  front_wheel_diameter: 17,
  front_wheel_offset: 40,
  bolt_pattern: '5x114.3',
  center_bore_mm: 71.5
};

// ============================================================
// MAPPING FUNCTION
// ============================================================

function getFitmentSpec(make: string, model: string, year: number): FitmentSpec | null {
  const makeUpper = make.toUpperCase();
  const modelLower = model.toLowerCase();
  
  // CHRYSLER
  if (makeUpper === 'CHRYSLER') {
    if (modelLower === '200') {
      if (year >= 2015 && year <= 2017) return chrysler200_2015_2017;
      if (year >= 2011 && year <= 2014) return chrysler200_2011_2014;
    }
    if (modelLower === 'pt cruiser' || modelLower.includes('pt cruiser')) {
      return ptCruiser;
    }
    if (modelLower === 'town & country' || modelLower.includes('town')) {
      if (year >= 2008 && year <= 2016) return townCountry_2008_2016;
      if (year >= 2002 && year <= 2007) return townCountry_2002_2007;
    }
    if (modelLower === 'crossfire') {
      return crossfire;
    }
    if (modelLower === 'pacifica') {
      // Old gen Pacifica
      if (year >= 2004 && year <= 2008) return pacifica_old;
    }
    if (modelLower === 'sebring') {
      if (year >= 2007 && year <= 2010) return sebring_2007_2010;
      if (year >= 2000 && year <= 2006) return sebring_2000_2006;
    }
  }
  
  // DODGE
  if (makeUpper === 'DODGE') {
    if (modelLower === 'journey') {
      return journey;
    }
    if (modelLower === 'dart') {
      return dart;
    }
    if (modelLower === 'viper') {
      if (year >= 2013 && year <= 2017) return viper_2013_2017;
      if (year >= 2008 && year <= 2010) return viper_2008_2010;
      if (year >= 2003 && year <= 2006) return viper_2003_2006;
      if (year >= 2000 && year <= 2002) return viper_2000_2002;
    }
  }
  
  // JEEP
  if (makeUpper === 'JEEP') {
    if (modelLower === 'grand cherokee') {
      if (year >= 2005 && year <= 2010) return grandCherokee_2005_2010;
      if (year >= 1999 && year <= 2004) return grandCherokee_1999_2004;
    }
    if (modelLower === 'grand wagoneer') {
      return grandWagoneer;
    }
    if (modelLower === 'wagoneer') {
      return wagoneer;
    }
    if (modelLower === 'liberty') {
      if (year >= 2008 && year <= 2012) return liberty_2008_2012;
      if (year >= 2002 && year <= 2007) return liberty_2002_2007;
    }
  }
  
  return null;
}

// Create OEM tire/wheel size JSON
function createOEMJson(spec: FitmentSpec) {
  const tireSize = `${spec.front_tire_width}/${spec.front_tire_aspect}R${spec.front_tire_diameter}`;
  const wheelSize = `${spec.front_wheel_diameter}x${spec.front_wheel_width}`;
  
  const wheelJson = [{
    diameter: spec.front_wheel_diameter,
    width: spec.front_wheel_width,
    offset: spec.front_wheel_offset
  }];
  
  const tireJson = [{
    width: spec.front_tire_width,
    aspectRatio: spec.front_tire_aspect,
    diameter: spec.front_tire_diameter,
    size: tireSize
  }];
  
  // Add rear sizes for staggered
  if (spec.isStaggered && spec.rear_wheel_diameter) {
    const rearTireSize = `${spec.rear_tire_width}/${spec.rear_tire_aspect}R${spec.rear_tire_diameter}`;
    
    wheelJson.push({
      diameter: spec.rear_wheel_diameter!,
      width: spec.rear_wheel_width!,
      offset: spec.rear_wheel_offset!
    });
    
    tireJson.push({
      width: spec.rear_tire_width!,
      aspectRatio: spec.rear_tire_aspect!,
      diameter: spec.rear_tire_diameter!,
      size: rearTireSize
    });
  }
  
  return { wheelJson: JSON.stringify(wheelJson), tireJson: JSON.stringify(tireJson) };
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('Starting Chrysler + Dodge + Jeep fitment fix...\n');
  
  // Get all missing records
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE make IN ('Chrysler', 'Dodge', 'Jeep')
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    ORDER BY make, model, year
  `);
  
  console.log(`Found ${result.rows.length} missing records\n`);
  
  let updated = 0;
  let skipped = 0;
  let errors: string[] = [];
  
  for (const row of result.rows) {
    const { id, year, make, model, display_trim } = row;
    const spec = getFitmentSpec(make, model, year);
    
    if (!spec) {
      errors.push(`No spec found: ${year} ${make} ${model} ${display_trim || ''}`);
      skipped++;
      continue;
    }
    
    const { wheelJson, tireJson } = createOEMJson(spec);
    
    try {
      await pool.query(`
        UPDATE vehicle_fitments SET
          oem_wheel_sizes = $1::jsonb,
          oem_tire_sizes = $2::jsonb,
          bolt_pattern = $3,
          center_bore_mm = $4,
          updated_at = NOW()
        WHERE id = $5
      `, [wheelJson, tireJson, spec.bolt_pattern, spec.center_bore_mm, id]);
      
      console.log(`✓ Updated: ${year} ${make} ${model} ${display_trim || 'Base'}`);
      updated++;
    } catch (err: any) {
      errors.push(`DB Error for ${year} ${make} ${model}: ${err.message}`);
      skipped++;
    }
  }
  
  console.log('\n========================================');
  console.log(`Summary:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log('========================================\n');
  
  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
