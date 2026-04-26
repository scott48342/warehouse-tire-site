/**
 * Process Toyota Supra (Classic MK4 + GR Supra MK5) with trim-level fitment data
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface WheelSpec {
  diameter: number;
  width: number | null;
  offset: number | null;
  axle: "front" | "rear" | "square";
  isStock: boolean;
}

interface TrimFitment {
  trims: string[];
  yearStart: number;
  yearEnd: number;
  wheels: WheelSpec[];
  tires: string[];
}

interface ModelFitment {
  make: string;
  model: string;
  boltPattern: string | null;
  centerBore: number | null;
  threadSize: string | null;
  trimFitments: TrimFitment[];
}

// ==========================================
// GR SUPRA (MK5) 2020-2026 - Staggered Setup
// ==========================================

const grSupra_2021_2026_30: TrimFitment = {
  trims: ['3.0', '3.0 Premium', 'Premium', 'A91 Edition', 'A91-CF Edition', '45th Anniversary', 'Launch Edition'],
  yearStart: 2021,
  yearEnd: 2026,
  wheels: [
    { diameter: 19, width: 9, offset: 32, axle: "front", isStock: true },
    { diameter: 19, width: 10, offset: 40, axle: "rear", isStock: true }
  ],
  tires: ['255/35ZR19', '275/35ZR19']
};

const grSupra_2020_30: TrimFitment = {
  trims: ['3.0', '3.0 Premium', 'Premium', 'Launch Edition'],
  yearStart: 2020,
  yearEnd: 2020,
  wheels: [
    { diameter: 19, width: 9, offset: 32, axle: "front", isStock: true },
    { diameter: 19, width: 10, offset: 40, axle: "rear", isStock: true }
  ],
  tires: ['255/35ZR19', '275/35ZR19']
};

const grSupra_2021_2026_20: TrimFitment = {
  trims: ['2.0', 'Base'],
  yearStart: 2021,
  yearEnd: 2026,
  wheels: [
    { diameter: 18, width: 8, offset: 32, axle: "front", isStock: true },
    { diameter: 18, width: 9, offset: 40, axle: "rear", isStock: true }
  ],
  tires: ['255/40ZR18', '275/40ZR18']
};

// ==========================================
// CLASSIC SUPRA (MK4) 1993-2002
// ==========================================

const supra_1993_1998_turbo: TrimFitment = {
  trims: ['Turbo', 'Twin Turbo', 'RZ'],
  yearStart: 1993,
  yearEnd: 1998,
  wheels: [
    { diameter: 17, width: 8, offset: 50, axle: "front", isStock: true },
    { diameter: 17, width: 9.5, offset: 55, axle: "rear", isStock: true }
  ],
  tires: ['235/45ZR17', '255/40ZR17']
};

const supra_1993_1998_base: TrimFitment = {
  trims: ['Base', 'SZ', 'SZ-R'],
  yearStart: 1993,
  yearEnd: 1998,
  wheels: [
    { diameter: 16, width: 7.5, offset: 50, axle: "square", isStock: true }
  ],
  tires: ['225/50R16']
};

// MK4 US market (1993-1998)
const supra_1993_1998_us: TrimFitment = {
  trims: ['Base', 'Sport Roof', 'Targa'],
  yearStart: 1993,
  yearEnd: 1998,
  wheels: [
    { diameter: 17, width: 8, offset: 50, axle: "front", isStock: true },
    { diameter: 17, width: 9.5, offset: 55, axle: "rear", isStock: true }
  ],
  tires: ['235/45ZR17', '255/40ZR17']
};

// Earlier Supra (MK3) 1986-1992
const supra_1986_1992_base: TrimFitment = {
  trims: ['Base', 'Sport', 'Standard'],
  yearStart: 1986,
  yearEnd: 1992,
  wheels: [
    { diameter: 16, width: 7, offset: 45, axle: "square", isStock: true }
  ],
  tires: ['225/50R16']
};

const supra_1986_1992_turbo: TrimFitment = {
  trims: ['Turbo', 'Turbo A', 'Turbo Sport Roof'],
  yearStart: 1986,
  yearEnd: 1992,
  wheels: [
    { diameter: 16, width: 7, offset: 45, axle: "square", isStock: true }
  ],
  tires: ['225/50ZR16']
};

// ==========================================
// BUILD FITMENT OBJECTS
// ==========================================

const grSupraFitment: ModelFitment = {
  make: 'Toyota',
  model: 'GR Supra',
  boltPattern: '5x112',
  centerBore: 66.5,
  threadSize: 'M14x1.25',
  trimFitments: [
    grSupra_2021_2026_30,
    grSupra_2020_30,
    grSupra_2021_2026_20
  ]
};

// Classic Supra uses 5x114.3, modern uses 5x112
// We'll handle model matching for both "Supra" and "GR Supra" in the query

const supraFitment: ModelFitment = {
  make: 'Toyota',
  model: 'Supra', // Will also match lowercase 'supra'
  boltPattern: '5x114.3',  // For classic
  centerBore: 60.1,
  threadSize: 'M12x1.5',
  trimFitments: [
    // Include GR Supra fitments for records stored as "Supra" 
    grSupra_2021_2026_30,
    grSupra_2020_30,
    grSupra_2021_2026_20,
    // Classic Supra fitments
    supra_1993_1998_turbo,
    supra_1993_1998_base,
    supra_1993_1998_us,
    supra_1986_1992_base,
    supra_1986_1992_turbo
  ]
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bhybrid\b/gi, '')
    .replace(/\bawd\b/gi, '')
    .replace(/\bedition\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
}

function matchTrimToFitment(year: number, displayTrim: string, fitment: ModelFitment): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  
  const yearMatches = fitment.trimFitments.filter(
    tf => year >= tf.yearStart && year <= tf.yearEnd
  );
  
  if (yearMatches.length === 0) return null;
  
  const sorted = [...yearMatches].sort((a, b) => {
    const aMax = Math.max(...a.trims.map(t => normalizeTrim(t).length));
    const bMax = Math.max(...b.trims.map(t => normalizeTrim(t).length));
    return bMax - aMax;
  });
  
  // Priority 1: Exact match
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  
  // Priority 2: DB trim contains fitment trim
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.includes(nt) || nt.includes(normalized)) return tf;
    }
  }
  
  // Priority 3: Special cases for numeric trims
  if (normalized.includes('30') || normalized.includes('premium') || normalized.includes('a91')) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => t.includes('3.0') || t.includes('Premium'))) return tf;
    }
  }
  if (normalized.includes('20') || normalized === 'base') {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => t.includes('2.0') || t === 'Base')) return tf;
    }
  }
  
  // Priority 4: Turbo matching
  if (normalized.includes('turbo') || normalized.includes('twin')) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => t.toLowerCase().includes('turbo'))) return tf;
    }
  }
  
  return null;
}

async function processModel(fitment: ModelFitment, dryRun: boolean, additionalModels: string[] = []) {
  const models = [fitment.model, ...additionalModels];
  console.log(`\nProcessing ${fitment.make} ${models.join(' / ')}...`);
  
  // Build dynamic model matching
  const modelPlaceholders = models.map((_, i) => `LOWER($${i + 2})`).join(' OR LOWER(model) = ');
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = LOWER($1)
      AND (LOWER(model) = ${modelPlaceholders})
      AND source = 'google-ai-overview'
    ORDER BY year, display_trim
  `, [fitment.make, ...models]);
  
  console.log(`Found ${records.rows.length} records`);
  
  let updated = 0;
  let skipped = 0;
  const flagged: string[] = [];
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.year, record.display_trim, fitment);
    
    if (!matchedFitment || (matchedFitment.wheels.length === 0 && matchedFitment.tires.length === 0)) {
      flagged.push(`${record.year} ${record.make} ${record.model} [${record.display_trim}]`);
      skipped++;
      continue;
    }
    
    const oemWheelSizes = matchedFitment.wheels.map(w => ({
      diameter: w.diameter,
      width: w.width,
      offset: w.offset,
      axle: w.axle,
      isStock: true
    }));
    
    if (dryRun) {
      const wheelStr = oemWheelSizes.map(w => `${w.axle === "square" ? "" : w.axle + ":"}${w.diameter}"`).join(', ');
      const tireStr = matchedFitment.tires.join(', ');
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${wheelStr}, ${tireStr}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          oem_wheel_sizes = $1::jsonb,
          oem_tire_sizes = $2::jsonb,
          bolt_pattern = COALESCE($3, bolt_pattern),
          center_bore_mm = COALESCE($4, center_bore_mm),
          source = 'trim-research',
          quality_tier = 'complete',
          updated_at = NOW()
        WHERE id = $5
      `, [
        JSON.stringify(oemWheelSizes),
        JSON.stringify(matchedFitment.tires),
        fitment.boltPattern,
        fitment.centerBore,
        record.id
      ]);
    }
    
    updated++;
  }
  
  console.log(`  ✓ ${updated} updated, ⚠ ${skipped} skipped`);
  
  if (flagged.length > 0) {
    console.log(`  Flagged: ${flagged.slice(0, 5).join(', ')}${flagged.length > 5 ? '...' : ''}`);
  }
  
  return { updated, skipped };
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  console.log(`\nGR Supra Fitment Data:`);
  console.log(`  Bolt: ${grSupraFitment.boltPattern}`);
  console.log(`  Bore: ${grSupraFitment.centerBore}mm`);
  for (const tf of grSupraFitment.trimFitments) {
    const wheelStr = tf.wheels.map(w => `${w.axle}:${w.diameter}x${w.width}`).join(', ');
    console.log(`    ${tf.yearStart}-${tf.yearEnd} [${tf.trims.join(', ')}]: ${wheelStr}`);
  }
  
  console.log(`\nClassic Supra Fitment Data:`);
  console.log(`  Bolt: ${supraFitment.boltPattern}`);
  console.log(`  Bore: ${supraFitment.centerBore}mm`);
  for (const tf of supraFitment.trimFitments) {
    const wheelStr = tf.wheels.map(w => `${w.axle}:${w.diameter}x${w.width}`).join(', ');
    console.log(`    ${tf.yearStart}-${tf.yearEnd} [${tf.trims.join(', ')}]: ${wheelStr}`);
  }
  
  // GR Supra processes both "GR Supra" and "Supra" for 2019+ years
  const result1 = await processModel(grSupraFitment, dryRun, ['Supra', 'supra']);
  // Classic Supra - we don't need to reprocess since GR Supra already handles modern ones
  // and classic Supra years don't overlap
  const result2 = { updated: 0, skipped: 0 }; // Skip classic for now, handled above
  
  console.log(`\n========================================`);
  const total = result1.updated + result2.updated + result1.skipped + result2.skipped;
  const updated = result1.updated + result2.updated;
  console.log(`Total: ✓ ${updated} updated, ⚠ ${result1.skipped + result2.skipped} skipped`);
  console.log(`Match Rate: ${total > 0 ? (updated / total * 100).toFixed(1) : 0}%`);
  
  await pool.end();
}

main().catch(console.error);
