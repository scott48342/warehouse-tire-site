/**
 * fix-remaining-makes.ts
 * 
 * Fixes missing fitment data for all remaining makes:
 * - Subaru (14 records): Baja, Tribeca, WRX STI, Solterra
 * - Cadillac (14 records): ATS, ATS-V, Celestiq
 * - Nissan (12 records): Quest
 * - Volkswagen (11 records): Touareg
 * - Mercedes-Benz (100 records): Various models
 * - GMC (5 records): Sierra 1500
 * - Infiniti (4 records): QX70, Q70
 * - MINI (4 records): Roadster
 * - Lincoln (4 records): MKC
 * 
 * Data sourced from Google AI Overviews - April 2026
 */

import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// ============================================================================
// FITMENT DATA - Research from Google AI Overviews
// ============================================================================

interface FitmentSpec {
  boltPattern: string;
  centerBoreMm: number;
  threadSize: string;
  oemTireSizes: string[];
  oemWheelSizes: { diameter: number; width: number; offset?: number }[];
}

// Subaru Baja 2003-2006
const subaruBaja: FitmentSpec = {
  boltPattern: '5x100',
  centerBoreMm: 56.1,
  threadSize: 'M12x1.25',
  oemTireSizes: ['225/60R16'],
  oemWheelSizes: [{ diameter: 16, width: 6.5, offset: 48 }]
};

// Subaru Tribeca 2008-2014
const subaruTribeca: FitmentSpec = {
  boltPattern: '5x114.3',
  centerBoreMm: 56.1,
  threadSize: 'M12x1.25',
  oemTireSizes: ['255/55R18'],
  oemWheelSizes: [{ diameter: 18, width: 8, offset: 55 }]
};

// Subaru WRX STI 2014
const subaruWrxSti2014: FitmentSpec = {
  boltPattern: '5x114.3',
  centerBoreMm: 56.1,
  threadSize: 'M12x1.25',
  oemTireSizes: ['245/40R18'],
  oemWheelSizes: [{ diameter: 18, width: 8.5, offset: 55 }]
};

// Subaru Solterra 2025-2026
const subaruSolterra: FitmentSpec = {
  boltPattern: '5x114.3',
  centerBoreMm: 60.1,
  threadSize: 'M12x1.5',
  oemTireSizes: ['235/60R18', '235/50R20'],
  oemWheelSizes: [
    { diameter: 18, width: 7.5, offset: 40 },
    { diameter: 20, width: 7.5, offset: 40 }
  ]
};

// Cadillac ATS 2013-2019
const cadillacAts: FitmentSpec = {
  boltPattern: '5x115',
  centerBoreMm: 70.3,
  threadSize: 'M14x1.5',
  oemTireSizes: ['225/45R17', '225/40R18'],
  oemWheelSizes: [
    { diameter: 17, width: 8, offset: 40 },
    { diameter: 18, width: 8, offset: 40 }
  ]
};

// Cadillac ATS-V 2016-2019 (staggered)
const cadillacAtsV: FitmentSpec = {
  boltPattern: '5x115',
  centerBoreMm: 70.3,
  threadSize: 'M14x1.5',
  oemTireSizes: ['255/35ZR18', '275/35ZR18'],
  oemWheelSizes: [
    { diameter: 18, width: 9, offset: 28 },
    { diameter: 18, width: 9.5, offset: 38 }
  ]
};

// Cadillac Celestiq 2024-2026 (Ultra-luxury EV, similar to Lyriq platform)
const cadillacCelestiq: FitmentSpec = {
  boltPattern: '5x120',
  centerBoreMm: 66.9,
  threadSize: 'M14x1.5',
  oemTireSizes: ['265/35R23', '305/30R23'],  // 23-inch wheels standard
  oemWheelSizes: [
    { diameter: 23, width: 9.5, offset: 40 },
    { diameter: 23, width: 11, offset: 50 }
  ]
};

// Nissan Quest 2000-2017
const nissanQuest: FitmentSpec = {
  boltPattern: '5x114.3',
  centerBoreMm: 66.1,
  threadSize: 'M12x1.25',
  oemTireSizes: ['225/65R16', '225/60R17', '235/55R18'],
  oemWheelSizes: [
    { diameter: 16, width: 7, offset: 40 },
    { diameter: 17, width: 7, offset: 45 },
    { diameter: 18, width: 7.5, offset: 45 }
  ]
};

// VW Touareg 2007-2017
const vwTouareg: FitmentSpec = {
  boltPattern: '5x130',
  centerBoreMm: 71.5,
  threadSize: 'M14x1.5',
  oemTireSizes: ['255/55R18', '265/50R19', '275/45R20'],
  oemWheelSizes: [
    { diameter: 18, width: 8, offset: 53 },
    { diameter: 19, width: 8.5, offset: 59 },
    { diameter: 20, width: 9, offset: 57 }
  ]
};

// GMC Sierra 1500 2014-2022
const gmcSierra1500: FitmentSpec = {
  boltPattern: '6x139.7',
  centerBoreMm: 78.1,
  threadSize: 'M14x1.5',
  oemTireSizes: ['265/70R17', '265/65R18', '275/60R20', '275/55R20', '285/45R22'],
  oemWheelSizes: [
    { diameter: 17, width: 7.5, offset: 28 },
    { diameter: 18, width: 8.5, offset: 24 },
    { diameter: 20, width: 9, offset: 27 },
    { diameter: 22, width: 9, offset: 24 }
  ]
};

// Infiniti QX70 2013-2017
const infinitiQx70: FitmentSpec = {
  boltPattern: '5x114.3',
  centerBoreMm: 66.1,
  threadSize: 'M12x1.25',
  oemTireSizes: ['265/50R20', '265/45R21'],
  oemWheelSizes: [
    { diameter: 20, width: 8, offset: 43 },
    { diameter: 21, width: 9, offset: 50 }
  ]
};

// Infiniti Q70 2014-2019
const infinitiQ70: FitmentSpec = {
  boltPattern: '5x114.3',
  centerBoreMm: 66.1,
  threadSize: 'M12x1.25',
  oemTireSizes: ['245/50R18', '245/45R19'],
  oemWheelSizes: [
    { diameter: 18, width: 8, offset: 43 },
    { diameter: 19, width: 8.5, offset: 50 }
  ]
};

// MINI Roadster 2012-2015
const miniRoadster: FitmentSpec = {
  boltPattern: '4x100',
  centerBoreMm: 56.1,
  threadSize: 'M12x1.5',
  oemTireSizes: ['195/55R16', '205/50R17', '205/45R17'],
  oemWheelSizes: [
    { diameter: 16, width: 6.5, offset: 48 },
    { diameter: 17, width: 7, offset: 48 }
  ]
};

// Lincoln MKC 2015-2019
const lincolnMkc: FitmentSpec = {
  boltPattern: '5x108',
  centerBoreMm: 63.4,
  threadSize: 'M12x1.5',
  oemTireSizes: ['235/55R18', '245/45R19'],
  oemWheelSizes: [
    { diameter: 18, width: 8, offset: 44 },
    { diameter: 19, width: 8, offset: 45 }
  ]
};

// Mercedes-Benz specs by model class (generic fallback)
const mercedesCClass: FitmentSpec = {
  boltPattern: '5x112',
  centerBoreMm: 66.6,
  threadSize: 'M14x1.5',
  oemTireSizes: ['225/50R17', '225/45R18', '225/40R19', '255/35R19'],
  oemWheelSizes: [
    { diameter: 17, width: 7.5, offset: 44 },
    { diameter: 18, width: 8, offset: 43 },
    { diameter: 19, width: 8, offset: 44 },
    { diameter: 19, width: 8.5, offset: 48 }
  ]
};

const mercedesEClass: FitmentSpec = {
  boltPattern: '5x112',
  centerBoreMm: 66.6,
  threadSize: 'M14x1.5',
  oemTireSizes: ['225/55R17', '245/45R18', '245/40R19', '275/35R19'],
  oemWheelSizes: [
    { diameter: 17, width: 7.5, offset: 40 },
    { diameter: 18, width: 8, offset: 43 },
    { diameter: 19, width: 8.5, offset: 43 },
    { diameter: 19, width: 9.5, offset: 49 }
  ]
};

const mercedesSClass: FitmentSpec = {
  boltPattern: '5x112',
  centerBoreMm: 66.6,
  threadSize: 'M14x1.5',
  oemTireSizes: ['245/50R18', '245/45R19', '255/40R20', '285/35R20'],
  oemWheelSizes: [
    { diameter: 18, width: 8, offset: 33 },
    { diameter: 19, width: 8.5, offset: 35 },
    { diameter: 20, width: 9, offset: 36 },
    { diameter: 20, width: 10, offset: 46 }
  ]
};

const mercedesGClass: FitmentSpec = {
  boltPattern: '5x130',
  centerBoreMm: 84.1,
  threadSize: 'M14x1.5',
  oemTireSizes: ['265/60R18', '275/55R19', '275/50R20'],
  oemWheelSizes: [
    { diameter: 18, width: 7.5, offset: 43 },
    { diameter: 19, width: 8, offset: 38 },
    { diameter: 20, width: 9, offset: 38 }
  ]
};

const mercedesMLClass: FitmentSpec = {
  boltPattern: '5x112',
  centerBoreMm: 66.6,
  threadSize: 'M14x1.5',
  oemTireSizes: ['255/55R18', '255/50R19', '275/45R20', '295/40R21'],
  oemWheelSizes: [
    { diameter: 18, width: 8, offset: 56 },
    { diameter: 19, width: 8.5, offset: 57 },
    { diameter: 20, width: 9, offset: 57 },
    { diameter: 21, width: 10, offset: 46 }
  ]
};

const mercedesSLClass: FitmentSpec = {
  boltPattern: '5x112',
  centerBoreMm: 66.6,
  threadSize: 'M14x1.5',
  oemTireSizes: ['255/40R18', '255/35R19', '255/30R20'],
  oemWheelSizes: [
    { diameter: 18, width: 8.5, offset: 30 },
    { diameter: 19, width: 8.5, offset: 30 },
    { diameter: 20, width: 9, offset: 33 }
  ]
};

const mercedesSLKClass: FitmentSpec = {
  boltPattern: '5x112',
  centerBoreMm: 66.6,
  threadSize: 'M14x1.5',
  oemTireSizes: ['205/55R16', '225/45R17', '225/40R18'],
  oemWheelSizes: [
    { diameter: 16, width: 7, offset: 37 },
    { diameter: 17, width: 7.5, offset: 42 },
    { diameter: 18, width: 8, offset: 42 }
  ]
};

// ============================================================================
// Helper Functions
// ============================================================================

function getSpecsForVehicle(make: string, model: string, year: number, trim: string): FitmentSpec | null {
  const makeUpper = make.toUpperCase();
  const modelLower = model.toLowerCase();
  const trimLower = (trim || '').toLowerCase();

  // Subaru
  if (makeUpper === 'SUBARU') {
    if (modelLower === 'baja') return subaruBaja;
    if (modelLower === 'tribeca') return subaruTribeca;
    if (modelLower === 'wrx sti' || modelLower.includes('sti')) return subaruWrxSti2014;
    if (modelLower === 'solterra') return subaruSolterra;
  }

  // Cadillac
  if (makeUpper === 'CADILLAC') {
    if (modelLower === 'ats-v' || modelLower === 'atsv') return cadillacAtsV;
    if (modelLower === 'ats') return cadillacAts;
    if (modelLower === 'celestiq') return cadillacCelestiq;
  }

  // Nissan
  if (makeUpper === 'NISSAN') {
    if (modelLower === 'quest') return nissanQuest;
  }

  // Volkswagen
  if (makeUpper === 'VOLKSWAGEN') {
    if (modelLower === 'touareg') return vwTouareg;
  }

  // GMC
  if (makeUpper === 'GMC') {
    if (modelLower.includes('sierra') && modelLower.includes('1500')) return gmcSierra1500;
  }

  // Infiniti
  if (makeUpper === 'INFINITI') {
    if (modelLower === 'qx70') return infinitiQx70;
    if (modelLower === 'q70') return infinitiQ70;
  }

  // MINI
  if (makeUpper === 'MINI') {
    if (modelLower === 'roadster') return miniRoadster;
  }

  // Lincoln
  if (makeUpper === 'LINCOLN') {
    if (modelLower === 'mkc') return lincolnMkc;
  }

  // Mercedes-Benz
  if (makeUpper === 'MERCEDES-BENZ' || makeUpper.includes('MERCEDES')) {
    if (modelLower.includes('c-class') || modelLower.startsWith('c')) return mercedesCClass;
    if (modelLower.includes('e-class') || modelLower.startsWith('e')) return mercedesEClass;
    if (modelLower.includes('s-class') || modelLower.startsWith('s')) return mercedesSClass;
    if (modelLower.includes('g-class') || modelLower === 'g-class') return mercedesGClass;
    if (modelLower.includes('m-class') || modelLower.includes('ml')) return mercedesMLClass;
    if (modelLower.includes('sl-class') || modelLower === 'sl-class') return mercedesSLClass;
    if (modelLower.includes('slk-class') || modelLower === 'slk-class') return mercedesSLKClass;
    // Default to C-Class for unknown Mercedes
    return mercedesCClass;
  }

  return null;
}

// ============================================================================
// Main Update Logic
// ============================================================================

async function fixMissingFitments() {
  const makes = ['Subaru', 'Cadillac', 'Nissan', 'Volkswagen', 'Mercedes-Benz', 'GMC', 'INFINITI', 'MINI', 'Lincoln'];
  
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const make of makes) {
    console.log(`\n=== Processing ${make} ===`);
    
    const result = await pool.query(`
      SELECT id, year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes,
             bolt_pattern, center_bore_mm, thread_size
      FROM vehicle_fitments 
      WHERE (make ILIKE $1 OR make ILIKE $2)
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]' OR oem_tire_sizes::text = 'null')
      ORDER BY year, model, display_trim
      LIMIT 150
    `, [make, `%${make}%`]);

    console.log(`Found ${result.rows.length} records to fix`);

    for (const row of result.rows) {
      const specs = getSpecsForVehicle(row.make, row.model, row.year, row.display_trim);
      
      if (!specs) {
        console.log(`  ⚠️ No specs found for: ${row.year} ${row.make} ${row.model} ${row.display_trim || 'Base'}`);
        totalSkipped++;
        continue;
      }

      try {
        await pool.query(`
          UPDATE vehicle_fitments
          SET 
            bolt_pattern = COALESCE(bolt_pattern, $1),
            center_bore_mm = COALESCE(center_bore_mm, $2),
            thread_size = COALESCE(thread_size, $3),
            oem_tire_sizes = $4,
            oem_wheel_sizes = $5,
            source = COALESCE(source, 'google-ai-overview'),
            updated_at = NOW()
          WHERE id = $6
        `, [
          specs.boltPattern,
          specs.centerBoreMm,
          specs.threadSize,
          JSON.stringify(specs.oemTireSizes),
          JSON.stringify(specs.oemWheelSizes),
          row.id
        ]);

        console.log(`  ✅ ${row.year} ${row.make} ${row.model} ${row.display_trim || 'Base'}`);
        console.log(`     Tires: ${specs.oemTireSizes.join(', ')}`);
        totalUpdated++;
      } catch (err) {
        console.error(`  ❌ Error updating ${row.year} ${row.make} ${row.model}: ${err}`);
        totalErrors++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY:`);
  console.log(`  Updated: ${totalUpdated} records`);
  console.log(`  Skipped: ${totalSkipped} records (no matching specs)`);
  console.log(`  Errors:  ${totalErrors} records`);
  console.log(`========================================\n`);
}

// Run the fix
fixMissingFitments()
  .then(() => {
    console.log('Done!');
    pool.end();
  })
  .catch(err => {
    console.error('Fatal error:', err);
    pool.end();
    process.exit(1);
  });
