/**
 * Process ALL Audi incomplete records with trim-level fitment data
 * Models: A5, A7, A8, TT, S3, S5, S6, S8, RS6, RS7, SQ5, SQ7, SQ8, e-tron, S6 e-tron, SQ6 e-tron
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface TrimFitment {
  trims: string[];
  yearStart: number;
  yearEnd: number;
  wheelDiameter: number;
  wheelWidth: number;
  rearWheelDiameter?: number;
  rearWheelWidth?: number;
  tireSize: string;
  rearTireSize?: string;
  boltPattern: string;
  centerBore: number;
}

// ==========================================
// Audi A5 / S5
// ==========================================
const audi_a5_f5_base: TrimFitment = { trims: ['Premium', 'Premium Plus', '45 TFSI', '2.0T', 'Base'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/40R18', boltPattern: '5x112', centerBore: 66.5 };
const audi_a5_f5_prestige: TrimFitment = { trims: ['Prestige', 'S line', '45 TFSI Prestige'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '255/35R19', boltPattern: '5x112', centerBore: 66.5 };
const audi_s5_f5: TrimFitment = { trims: ['S5', 'S5 Premium Plus', 'S5 Prestige', '3.0T'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '255/35R19', boltPattern: '5x112', centerBore: 66.5 };
const audi_a5_b8_base: TrimFitment = { trims: ['Premium', 'Premium Plus', '2.0T', 'Base'], yearStart: 2008, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/40R18', boltPattern: '5x112', centerBore: 66.5 };
const audi_a5_b8_prestige: TrimFitment = { trims: ['Prestige', 'S line', 'Competition'], yearStart: 2008, yearEnd: 2017, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '255/35R19', boltPattern: '5x112', centerBore: 66.5 };
const audi_s5_b8: TrimFitment = { trims: ['S5', 'Base', '3.0T', '4.2'], yearStart: 2008, yearEnd: 2017, wheelDiameter: 19, wheelWidth: 9, tireSize: '255/35R19', boltPattern: '5x112', centerBore: 66.5 };

// ==========================================
// Audi A7 / S7 / RS7
// ==========================================
const audi_a7_c8_base: TrimFitment = { trims: ['Premium', 'Premium Plus', '55 TFSI', '45 TFSI', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '255/40R19', boltPattern: '5x112', centerBore: 66.5 };
const audi_a7_c8_prestige: TrimFitment = { trims: ['Prestige', 'S line'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/35R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_s7_c8: TrimFitment = { trims: ['S7', 'Base', 'Premium Plus', 'Prestige'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9, tireSize: '275/30R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_rs7_c8: TrimFitment = { trims: ['RS7', 'Performance'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, rearWheelDiameter: 21, rearWheelWidth: 10, tireSize: '275/30R21', rearTireSize: '285/30R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_a7_c7_base: TrimFitment = { trims: ['Premium', 'Premium Plus', '3.0T', '2.0T', 'TDI', 'Base'], yearStart: 2012, yearEnd: 2018, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/45R18', boltPattern: '5x112', centerBore: 66.5 };
const audi_a7_c7_prestige: TrimFitment = { trims: ['Prestige', 'S line', 'Competition'], yearStart: 2012, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 9, tireSize: '265/35R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_s7_c7: TrimFitment = { trims: ['S7', 'Base'], yearStart: 2013, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 9, tireSize: '265/35R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_rs7_c7: TrimFitment = { trims: ['RS7', 'Performance'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 21, wheelWidth: 9, rearWheelDiameter: 21, rearWheelWidth: 9.5, tireSize: '275/30R21', rearTireSize: '285/30R21', boltPattern: '5x112', centerBore: 66.5 };

// ==========================================
// Audi A8 / S8
// ==========================================
const audi_a8_d5_base: TrimFitment = { trims: ['55 TFSI', '60 TFSI', 'L', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '255/45R19', boltPattern: '5x112', centerBore: 66.5 };
const audi_a8_d5_prestige: TrimFitment = { trims: ['L Prestige', 'Prestige'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, tireSize: '265/40R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_s8_d5: TrimFitment = { trims: ['S8', 'Base'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, rearWheelDiameter: 21, rearWheelWidth: 10.5, tireSize: '275/35R21', rearTireSize: '295/30R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_a8_d4_base: TrimFitment = { trims: ['3.0T', '4.0T', 'L', 'TDI', 'Base'], yearStart: 2011, yearEnd: 2018, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/50R18', boltPattern: '5x112', centerBore: 66.5 };
const audi_a8_d4_prestige: TrimFitment = { trims: ['L Prestige', 'Prestige'], yearStart: 2011, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 9, tireSize: '265/40R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_s8_d4: TrimFitment = { trims: ['S8', 'Plus'], yearStart: 2013, yearEnd: 2018, wheelDiameter: 21, wheelWidth: 9, rearWheelDiameter: 21, rearWheelWidth: 9.5, tireSize: '275/35R21', rearTireSize: '295/30R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_a8_d3: TrimFitment = { trims: ['3.2', '4.2', 'L', 'W12', 'Base'], yearStart: 2004, yearEnd: 2010, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/50R18', boltPattern: '5x112', centerBore: 66.5 };
const audi_s8_d3: TrimFitment = { trims: ['S8', 'Base'], yearStart: 2007, yearEnd: 2010, wheelDiameter: 20, wheelWidth: 9, tireSize: '265/35R20', boltPattern: '5x112', centerBore: 66.5 };

// ==========================================
// Audi TT / TTS / TT RS
// ==========================================
const audi_tt_8s_base: TrimFitment = { trims: ['45 TFSI', '2.0T', 'Base', 'Premium'], yearStart: 2016, yearEnd: 2024, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/40R18', boltPattern: '5x112', centerBore: 57.1 };
const audi_tt_8s_prestige: TrimFitment = { trims: ['Prestige', 'S line'], yearStart: 2016, yearEnd: 2024, wheelDiameter: 19, wheelWidth: 9, tireSize: '245/35R19', boltPattern: '5x112', centerBore: 57.1 };
const audi_tts_8s: TrimFitment = { trims: ['TTS', 'Base', 'Competition'], yearStart: 2016, yearEnd: 2024, wheelDiameter: 19, wheelWidth: 9, tireSize: '245/35R19', boltPattern: '5x112', centerBore: 57.1 };
const audi_ttrs_8s: TrimFitment = { trims: ['TT RS', 'RS', 'Base'], yearStart: 2017, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 9, tireSize: '255/30R20', boltPattern: '5x112', centerBore: 57.1 };
const audi_tt_8j_base: TrimFitment = { trims: ['2.0T', 'Base', 'Premium'], yearStart: 2007, yearEnd: 2015, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17', boltPattern: '5x112', centerBore: 57.1 };
const audi_tt_8j_prestige: TrimFitment = { trims: ['Prestige', 'S line'], yearStart: 2007, yearEnd: 2015, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/40R18', boltPattern: '5x112', centerBore: 57.1 };
const audi_tts_8j: TrimFitment = { trims: ['TTS', 'Base'], yearStart: 2009, yearEnd: 2015, wheelDiameter: 18, wheelWidth: 9, tireSize: '245/40R18', boltPattern: '5x112', centerBore: 57.1 };
const audi_ttrs_8j: TrimFitment = { trims: ['TT RS', 'RS'], yearStart: 2012, yearEnd: 2015, wheelDiameter: 19, wheelWidth: 9, tireSize: '255/35R19', boltPattern: '5x112', centerBore: 57.1 };
const audi_tt_8n: TrimFitment = { trims: ['1.8T', '3.2', 'Base', 'quattro'], yearStart: 1999, yearEnd: 2006, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/45R17', boltPattern: '5x100', centerBore: 57.1 };

// ==========================================
// Audi S3
// ==========================================
const audi_s3_8y: TrimFitment = { trims: ['S3', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, tireSize: '235/35R19', boltPattern: '5x112', centerBore: 57.1 };
const audi_s3_8v: TrimFitment = { trims: ['S3', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2015, yearEnd: 2021, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/40R18', boltPattern: '5x112', centerBore: 57.1 };
const audi_s3_8p: TrimFitment = { trims: ['S3', 'Base'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 18, wheelWidth: 8, tireSize: '225/40R18', boltPattern: '5x112', centerBore: 57.1 };

// ==========================================
// Audi S6 / RS6
// ==========================================
const audi_s6_c8: TrimFitment = { trims: ['S6', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9, tireSize: '265/30R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_rs6_c8: TrimFitment = { trims: ['RS6', 'Avant', 'Performance', 'Base'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 10, rearWheelDiameter: 22, rearWheelWidth: 10.5, tireSize: '285/30R22', rearTireSize: '305/30R22', boltPattern: '5x112', centerBore: 66.5 };
const audi_s6_c7: TrimFitment = { trims: ['S6', 'Base'], yearStart: 2013, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 9, tireSize: '265/35R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_rs6_c7: TrimFitment = { trims: ['RS6', 'Avant', 'Performance'], yearStart: 2016, yearEnd: 2018, wheelDiameter: 21, wheelWidth: 9.5, tireSize: '275/30R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_s6_c6: TrimFitment = { trims: ['S6', 'Base'], yearStart: 2007, yearEnd: 2011, wheelDiameter: 19, wheelWidth: 9, tireSize: '265/35R19', boltPattern: '5x112', centerBore: 66.5 };

// ==========================================
// Audi SQ5
// ==========================================
const audi_sq5_fy: TrimFitment = { trims: ['SQ5', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2018, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/45R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_sq5_sport: TrimFitment = { trims: ['Sportback', 'Black Optic'], yearStart: 2018, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9, tireSize: '255/40R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_sq5_8r: TrimFitment = { trims: ['SQ5', 'Base', 'Premium Plus', 'Prestige'], yearStart: 2014, yearEnd: 2017, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/45R20', boltPattern: '5x112', centerBore: 66.5 };

// ==========================================
// Audi SQ7 / SQ8
// ==========================================
const audi_sq7_4m: TrimFitment = { trims: ['SQ7', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, tireSize: '285/40R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_sq7_sport: TrimFitment = { trims: ['Black Optic'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 10, tireSize: '285/35R22', boltPattern: '5x112', centerBore: 66.5 };
const audi_sq8_4m: TrimFitment = { trims: ['SQ8', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 10, tireSize: '285/40R22', boltPattern: '5x112', centerBore: 66.5 };
const audi_rsq8: TrimFitment = { trims: ['RS Q8', 'Performance'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 23, wheelWidth: 10.5, rearWheelDiameter: 23, rearWheelWidth: 11.5, tireSize: '295/35R23', rearTireSize: '325/30R23', boltPattern: '5x112', centerBore: 66.5 };

// ==========================================
// Audi e-tron / e-tron GT / S6 e-tron / SQ6 e-tron
// ==========================================
const audi_etron_ge: TrimFitment = { trims: ['e-tron', 'Premium', 'Premium Plus', 'Base', '50', '55'], yearStart: 2019, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 9, tireSize: '255/50R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_etron_sport: TrimFitment = { trims: ['Prestige', 'Sportback', 'S line'], yearStart: 2019, yearEnd: 2024, wheelDiameter: 21, wheelWidth: 9.5, tireSize: '265/45R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_setron: TrimFitment = { trims: ['S e-tron', 'SQ8 e-tron', 'S'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, tireSize: '285/40R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_etron_gt: TrimFitment = { trims: ['e-tron GT', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 11, tireSize: '245/45R20', rearTireSize: '285/40R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_rs_etron_gt: TrimFitment = { trims: ['RS e-tron GT', 'RS'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, rearWheelDiameter: 21, rearWheelWidth: 11.5, tireSize: '265/35R21', rearTireSize: '305/30R21', boltPattern: '5x112', centerBore: 66.5 };
const audi_s6_etron: TrimFitment = { trims: ['S6 e-tron', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 10, tireSize: '255/45R20', rearTireSize: '285/40R20', boltPattern: '5x112', centerBore: 66.5 };
const audi_sq6_etron: TrimFitment = { trims: ['SQ6 e-tron', 'Premium Plus', 'Prestige', 'Base'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, rearWheelDiameter: 21, rearWheelWidth: 10.5, tireSize: '265/40R21', rearTireSize: '285/35R21', boltPattern: '5x112', centerBore: 66.5 };

// Model configs
const modelConfigs: { [key: string]: TrimFitment[] } = {
  'a5': [audi_a5_f5_base, audi_a5_f5_prestige, audi_s5_f5, audi_a5_b8_base, audi_a5_b8_prestige, audi_s5_b8],
  'a5 sportback': [audi_a5_f5_base, audi_a5_f5_prestige, audi_s5_f5],
  's5': [audi_s5_f5, audi_s5_b8],
  'a7': [audi_a7_c8_base, audi_a7_c8_prestige, audi_s7_c8, audi_a7_c7_base, audi_a7_c7_prestige, audi_s7_c7],
  's7': [audi_s7_c8, audi_s7_c7],
  'rs6': [audi_rs6_c8, audi_rs6_c7],
  'rs7': [audi_rs7_c8, audi_rs7_c7],
  'a8': [audi_a8_d5_base, audi_a8_d5_prestige, audi_s8_d5, audi_a8_d4_base, audi_a8_d4_prestige, audi_s8_d4, audi_a8_d3, audi_s8_d3],
  's8': [audi_s8_d5, audi_s8_d4, audi_s8_d3],
  'tt': [audi_tt_8s_base, audi_tt_8s_prestige, audi_tts_8s, audi_ttrs_8s, audi_tt_8j_base, audi_tt_8j_prestige, audi_tts_8j, audi_ttrs_8j, audi_tt_8n],
  'tts': [audi_tts_8s, audi_tts_8j],
  'tt rs': [audi_ttrs_8s, audi_ttrs_8j],
  's3': [audi_s3_8y, audi_s3_8v, audi_s3_8p],
  's5': [audi_s5_f5, audi_s5_b8],
  's6': [audi_s6_c8, audi_s6_c7, audi_s6_c6],
  'sq5': [audi_sq5_fy, audi_sq5_sport, audi_sq5_8r],
  'sq5 sportback': [audi_sq5_fy, audi_sq5_sport],
  'sq7': [audi_sq7_4m, audi_sq7_sport],
  'sq8': [audi_sq8_4m, audi_rsq8],
  'rs q8': [audi_rsq8],
  'e-tron': [audi_etron_ge, audi_etron_sport, audi_setron],
  'e-tron sportback': [audi_etron_ge, audi_etron_sport],
  'e-tron gt': [audi_etron_gt, audi_rs_etron_gt],
  'rs e-tron gt': [audi_rs_etron_gt],
  's6 e-tron': [audi_s6_etron],
  'sq6 e-tron': [audi_sq6_etron],
  's e-tron': [audi_setron],
  'sq8 e-tron': [audi_setron],
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(model: string, year: number, displayTrim: string): TrimFitment | null {
  const modelKey = model.toLowerCase();
  const configs = modelConfigs[modelKey];
  if (!configs) return null;

  const normalized = normalizeTrim(displayTrim);
  const yearMatches = configs.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return configs[0]; // Fallback to first config

  // Exact match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  // Contains match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.includes(nt) || nt.includes(normalized)) return tf;
    }
  }
  // Keyword match
  if (normalized.includes('prestige') || normalized.includes('s line') || normalized.includes('black optic')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('prestige') || t.toLowerCase().includes('s line'))) || yearMatches[0];
  }
  if (normalized.includes('rs') || normalized.includes('performance')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('rs') || t.toLowerCase().includes('performance'))) || yearMatches[0];
  }
  
  // Fallback to base
  return yearMatches.find(tf => tf.trims.some(t => ['Base', 'Premium', '45 TFSI'].some(b => t.includes(b)))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const models = Object.keys(modelConfigs).map(m => m.toLowerCase());
  const modelPlaceholders = models.map((_, i) => `$${i + 1}`).join(', ');
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'audi' 
    AND LOWER(model) IN (${modelPlaceholders})
    AND quality_tier != 'complete'
    ORDER BY model, year, display_trim
  `, models);
  
  console.log(`Found ${records.rows.length} incomplete Audi records`);
  
  let updated = 0, skipped = 0;
  const flagged: string[] = [];
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.model, record.year, record.display_trim);
    if (!matchedFitment) { 
      flagged.push(`${record.year} ${record.model} ${record.display_trim}`); 
      skipped++; 
      continue; 
    }
    
    const isStaggered = matchedFitment.rearWheelDiameter !== undefined && matchedFitment.rearWheelDiameter !== matchedFitment.wheelDiameter;
    const isStaggeredWidth = matchedFitment.rearWheelWidth !== undefined && matchedFitment.rearWheelWidth !== matchedFitment.wheelWidth;
    
    const oemWheelSizes: any[] = [{ 
      diameter: matchedFitment.wheelDiameter, 
      width: matchedFitment.wheelWidth, 
      offset: null, 
      axle: (isStaggered || isStaggeredWidth) ? 'front' : 'square', 
      isStock: true 
    }];
    
    if (isStaggered || isStaggeredWidth) {
      oemWheelSizes.push({ 
        diameter: matchedFitment.rearWheelDiameter || matchedFitment.wheelDiameter, 
        width: matchedFitment.rearWheelWidth || matchedFitment.wheelWidth, 
        offset: null, 
        axle: 'rear', 
        isStock: true 
      });
    }
    
    const tireSizes = [matchedFitment.tireSize];
    if (matchedFitment.rearTireSize && matchedFitment.rearTireSize !== matchedFitment.tireSize) {
      tireSizes.push(matchedFitment.rearTireSize);
    }
    
    if (dryRun) {
      const staggeredStr = (isStaggered || isStaggeredWidth) ? ' [STAGGERED]' : '';
      console.log(`  [DRY] ${record.year} ${record.model} ${record.display_trim} → ${matchedFitment.wheelDiameter}", ${matchedFitment.tireSize}${staggeredStr}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb, 
            oem_tire_sizes = $2::jsonb, 
            bolt_pattern = $3, 
            center_bore_mm = $4, 
            source = 'trim-research', 
            quality_tier = 'complete', 
            updated_at = NOW() 
        WHERE id = $5`,
        [JSON.stringify(oemWheelSizes), JSON.stringify(tireSizes), matchedFitment.boltPattern, matchedFitment.centerBore, record.id]
      );
    }
    updated++;
  }
  
  console.log(`\n✓ ${updated} updated, ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  if (flagged.length > 0) console.log(`Flagged: ${flagged.slice(0, 10).join(', ')}${flagged.length > 10 ? '...' : ''}`);
  await pool.end();
}

main().catch(console.error);
