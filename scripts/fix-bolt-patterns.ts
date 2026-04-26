/**
 * Fill missing bolt patterns - NO REGRESSION
 * Only updates records where bolt_pattern IS NULL or empty
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Bolt patterns by make/model (verified OEM specs)
const BOLT_PATTERNS: Record<string, Record<string, { pattern: string; centerBore: number }>> = {
  'Land Rover': {
    'Range Rover': { pattern: '5x120', centerBore: 72.6 },
    'Range Rover Sport': { pattern: '5x120', centerBore: 72.6 },
    'Range Rover Velar': { pattern: '5x108', centerBore: 63.4 },
    'Range Rover Evoque': { pattern: '5x108', centerBore: 63.4 },
    'Discovery': { pattern: '5x120', centerBore: 72.6 },
    'Discovery Sport': { pattern: '5x108', centerBore: 63.4 },
    'Defender': { pattern: '5x120', centerBore: 72.6 },
    'LR2': { pattern: '5x108', centerBore: 63.4 },
    'LR3': { pattern: '5x120', centerBore: 72.6 },
    'LR4': { pattern: '5x120', centerBore: 72.6 },
    'Freelander': { pattern: '5x114.3', centerBore: 64.1 },
  },
  'Mercedes-Benz': {
    'C-Class': { pattern: '5x112', centerBore: 66.6 },
    'E-Class': { pattern: '5x112', centerBore: 66.6 },
    'S-Class': { pattern: '5x112', centerBore: 66.6 },
    'GLA': { pattern: '5x112', centerBore: 66.6 },
    'GLB': { pattern: '5x112', centerBore: 66.6 },
    'GLC': { pattern: '5x112', centerBore: 66.6 },
    'GLE': { pattern: '5x112', centerBore: 66.6 },
    'GLS': { pattern: '5x112', centerBore: 66.6 },
    'CLA': { pattern: '5x112', centerBore: 66.6 },
    'CLS': { pattern: '5x112', centerBore: 66.6 },
    'A-Class': { pattern: '5x112', centerBore: 66.6 },
    'B-Class': { pattern: '5x112', centerBore: 66.6 },
    'G-Class': { pattern: '5x130', centerBore: 84.1 },
    'SL-Class': { pattern: '5x112', centerBore: 66.6 },
    'SLC': { pattern: '5x112', centerBore: 66.6 },
    'SLK': { pattern: '5x112', centerBore: 66.6 },
    'AMG GT': { pattern: '5x112', centerBore: 66.6 },
    'Maybach': { pattern: '5x112', centerBore: 66.6 },
    'ML': { pattern: '5x112', centerBore: 66.6 },
    'GL': { pattern: '5x112', centerBore: 66.6 },
    'GLK': { pattern: '5x112', centerBore: 66.6 },
    'R-Class': { pattern: '5x112', centerBore: 66.6 },
    'Metris': { pattern: '5x112', centerBore: 66.6 },
    'Sprinter': { pattern: '6x130', centerBore: 84.1 },
    'EQS': { pattern: '5x112', centerBore: 66.6 },
    'EQE': { pattern: '5x112', centerBore: 66.6 },
    'EQB': { pattern: '5x112', centerBore: 66.6 },
    'EQC': { pattern: '5x112', centerBore: 66.6 },
  },
  'Jaguar': {
    'XJ': { pattern: '5x108', centerBore: 63.4 },
    'XF': { pattern: '5x108', centerBore: 63.4 },
    'XE': { pattern: '5x108', centerBore: 63.4 },
    'F-Pace': { pattern: '5x108', centerBore: 63.4 },
    'E-Pace': { pattern: '5x108', centerBore: 63.4 },
    'I-Pace': { pattern: '5x108', centerBore: 63.4 },
    'F-Type': { pattern: '5x108', centerBore: 63.4 },
    'XK': { pattern: '5x108', centerBore: 63.4 },
    'XKR': { pattern: '5x108', centerBore: 63.4 },
    'S-Type': { pattern: '5x108', centerBore: 63.4 },
    'X-Type': { pattern: '5x108', centerBore: 63.4 },
  },
  'Mazda': {
    'Mazda6': { pattern: '5x114.3', centerBore: 67.1 },
    'Mazda3': { pattern: '5x114.3', centerBore: 67.1 },
    'CX-5': { pattern: '5x114.3', centerBore: 67.1 },
    'CX-9': { pattern: '5x114.3', centerBore: 67.1 },
    'CX-30': { pattern: '5x114.3', centerBore: 67.1 },
    'CX-50': { pattern: '5x114.3', centerBore: 67.1 },
    'MX-5': { pattern: '4x100', centerBore: 54.1 },
    'MX-5 Miata': { pattern: '4x100', centerBore: 54.1 },
    'RX-8': { pattern: '5x114.3', centerBore: 67.1 },
    'CX-7': { pattern: '5x114.3', centerBore: 67.1 },
    'Tribute': { pattern: '5x114.3', centerBore: 67.1 },
    'MPV': { pattern: '5x114.3', centerBore: 67.1 },
  },
  'BMW': {
    'Z4': { pattern: '5x120', centerBore: 72.6 },
    'Z3': { pattern: '5x120', centerBore: 72.6 },
    'M4': { pattern: '5x120', centerBore: 72.6 },
    'M3': { pattern: '5x120', centerBore: 72.6 },
    'M5': { pattern: '5x120', centerBore: 72.6 },
    'M6': { pattern: '5x120', centerBore: 72.6 },
    'M2': { pattern: '5x120', centerBore: 72.6 },
    'M8': { pattern: '5x112', centerBore: 66.6 },
    '2 Series': { pattern: '5x112', centerBore: 66.6 },
    '3 Series': { pattern: '5x120', centerBore: 72.6 },
    '4 Series': { pattern: '5x120', centerBore: 72.6 },
    '5 Series': { pattern: '5x120', centerBore: 72.6 },
    '6 Series': { pattern: '5x120', centerBore: 72.6 },
    '7 Series': { pattern: '5x120', centerBore: 72.6 },
    '8 Series': { pattern: '5x112', centerBore: 66.6 },
    'X1': { pattern: '5x112', centerBore: 66.6 },
    'X2': { pattern: '5x112', centerBore: 66.6 },
    'X3': { pattern: '5x120', centerBore: 72.6 },
    'X4': { pattern: '5x120', centerBore: 72.6 },
    'X5': { pattern: '5x120', centerBore: 72.6 },
    'X6': { pattern: '5x120', centerBore: 72.6 },
    'X7': { pattern: '5x112', centerBore: 66.6 },
    'i3': { pattern: '5x112', centerBore: 66.6 },
    'i4': { pattern: '5x112', centerBore: 66.6 },
    'i7': { pattern: '5x112', centerBore: 66.6 },
    'iX': { pattern: '5x112', centerBore: 66.6 },
    'iX3': { pattern: '5x112', centerBore: 66.6 },
  },
  'Buick': {
    'LaCrosse': { pattern: '5x120', centerBore: 67.1 },
    'Enclave': { pattern: '6x120', centerBore: 67.1 },
    'Envision': { pattern: '5x115', centerBore: 70.3 },
    'Encore': { pattern: '5x105', centerBore: 56.6 },
    'Encore GX': { pattern: '5x105', centerBore: 56.6 },
    'Regal': { pattern: '5x115', centerBore: 70.3 },
    'Verano': { pattern: '5x115', centerBore: 70.3 },
    'Cascada': { pattern: '5x115', centerBore: 70.3 },
    'LeSabre': { pattern: '5x115', centerBore: 70.3 },
    'Lucerne': { pattern: '5x115', centerBore: 70.3 },
    'Park Avenue': { pattern: '5x115', centerBore: 70.3 },
    'Century': { pattern: '5x115', centerBore: 70.3 },
    'Rendezvous': { pattern: '5x115', centerBore: 70.3 },
    'Terraza': { pattern: '5x115', centerBore: 70.3 },
    'Rainier': { pattern: '6x127', centerBore: 78.3 },
  },
  'Chevrolet': {
    'Express 1500': { pattern: '6x139.7', centerBore: 78.1 },
    'Express 2500': { pattern: '8x165.1', centerBore: 121.1 },
    'Express 3500': { pattern: '8x165.1', centerBore: 121.1 },
    'Camaro': { pattern: '5x120', centerBore: 67.1 },
    'Corvette': { pattern: '5x120', centerBore: 70.3 },
    'Blazer': { pattern: '5x120', centerBore: 67.1 },
    'Suburban': { pattern: '6x139.7', centerBore: 78.1 },
    'Suburban 1500': { pattern: '6x139.7', centerBore: 78.1 },
  },
  'Ford': {
    'Mustang': { pattern: '5x114.3', centerBore: 70.5 },
    'Mustang Shelby GT500': { pattern: '5x114.3', centerBore: 70.5 },
    'Mustang Shelby GT350': { pattern: '5x114.3', centerBore: 70.5 },
    'Mustang Mach 1': { pattern: '5x114.3', centerBore: 70.5 },
    'Fiesta': { pattern: '4x108', centerBore: 63.4 },
    'F-450': { pattern: '8x200', centerBore: 142 },
    'F-450 Super Duty': { pattern: '8x200', centerBore: 142 },
  },
  'GMC': {
    'Sierra 1500': { pattern: '6x139.7', centerBore: 78.1 },
    'Sierra 2500': { pattern: '8x180', centerBore: 124.1 },
    'Sierra 3500': { pattern: '8x180', centerBore: 124.1 },
  },
  'RAM': {
    'ProMaster': { pattern: '5x130', centerBore: 84.1 },
    'ProMaster City': { pattern: '5x108', centerBore: 63.4 },
  },
  'Toyota': {
    'Sienna': { pattern: '5x114.3', centerBore: 60.1 },
    'RAV4': { pattern: '5x114.3', centerBore: 60.1 },
    'RAV4 Hybrid': { pattern: '5x114.3', centerBore: 60.1 },
    'Supra': { pattern: '5x112', centerBore: 66.5 },
  },
  'Honda': {
    'Civic': { pattern: '5x114.3', centerBore: 64.1 },
    'Insight': { pattern: '5x114.3', centerBore: 64.1 },
  },
  'Acura': {
    'TL': { pattern: '5x114.3', centerBore: 64.1 },
  },
  'Subaru': {
    'Impreza WRX STI': { pattern: '5x114.3', centerBore: 56.1 },
    'WRX STI': { pattern: '5x114.3', centerBore: 56.1 },
  },
  'Dodge': {
    'Viper': { pattern: '5x115', centerBore: 71.5 },
  },
  'Chrysler': {
    'Town & Country': { pattern: '5x127', centerBore: 71.5 },
    'Voyager': { pattern: '5x127', centerBore: 71.5 },
  },
  'Jeep': {
    'Grand Cherokee': { pattern: '5x127', centerBore: 71.5 },
    'Liberty': { pattern: '5x114.3', centerBore: 71.5 },
  },
  'Audi': {
    'A3': { pattern: '5x112', centerBore: 57.1 },
    'A4': { pattern: '5x112', centerBore: 66.5 },
    'A5': { pattern: '5x112', centerBore: 66.5 },
    'A6': { pattern: '5x112', centerBore: 66.5 },
    'A7': { pattern: '5x112', centerBore: 66.5 },
    'A8': { pattern: '5x112', centerBore: 66.5 },
    'Q3': { pattern: '5x112', centerBore: 57.1 },
    'Q5': { pattern: '5x112', centerBore: 66.5 },
    'Q7': { pattern: '5x130', centerBore: 71.6 },
    'Q8': { pattern: '5x112', centerBore: 66.5 },
    'TT': { pattern: '5x112', centerBore: 57.1 },
    'R8': { pattern: '5x112', centerBore: 66.5 },
    'e-tron': { pattern: '5x112', centerBore: 66.5 },
    'RS3': { pattern: '5x112', centerBore: 57.1 },
    'RS4': { pattern: '5x112', centerBore: 66.5 },
    'RS5': { pattern: '5x112', centerBore: 66.5 },
    'RS6': { pattern: '5x112', centerBore: 66.5 },
    'RS7': { pattern: '5x112', centerBore: 66.5 },
    'S3': { pattern: '5x112', centerBore: 57.1 },
    'S4': { pattern: '5x112', centerBore: 66.5 },
    'S5': { pattern: '5x112', centerBore: 66.5 },
    'S6': { pattern: '5x112', centerBore: 66.5 },
    'S7': { pattern: '5x112', centerBore: 66.5 },
    'S8': { pattern: '5x112', centerBore: 66.5 },
    'SQ5': { pattern: '5x112', centerBore: 66.5 },
    'SQ7': { pattern: '5x130', centerBore: 71.6 },
    'SQ8': { pattern: '5x112', centerBore: 66.5 },
  },
  'Porsche': {
    '911': { pattern: '5x130', centerBore: 71.6 },
    'Cayenne': { pattern: '5x130', centerBore: 71.6 },
    'Macan': { pattern: '5x112', centerBore: 66.5 },
    'Panamera': { pattern: '5x130', centerBore: 71.6 },
    'Taycan': { pattern: '5x130', centerBore: 71.6 },
    'Boxster': { pattern: '5x130', centerBore: 71.6 },
    'Cayman': { pattern: '5x130', centerBore: 71.6 },
    '718': { pattern: '5x130', centerBore: 71.6 },
  },
  'Volvo': {
    'S60': { pattern: '5x108', centerBore: 63.4 },
    'S90': { pattern: '5x108', centerBore: 63.4 },
    'V60': { pattern: '5x108', centerBore: 63.4 },
    'V90': { pattern: '5x108', centerBore: 63.4 },
    'XC40': { pattern: '5x108', centerBore: 63.4 },
    'XC60': { pattern: '5x108', centerBore: 63.4 },
    'XC90': { pattern: '5x108', centerBore: 63.4 },
    'S40': { pattern: '5x108', centerBore: 63.4 },
    'S80': { pattern: '5x108', centerBore: 63.4 },
    'V50': { pattern: '5x108', centerBore: 63.4 },
    'V70': { pattern: '5x108', centerBore: 63.4 },
    'C30': { pattern: '5x108', centerBore: 63.4 },
    'C70': { pattern: '5x108', centerBore: 63.4 },
    'XC70': { pattern: '5x108', centerBore: 63.4 },
  },
  'Maserati': {
    'Ghibli': { pattern: '5x114.3', centerBore: 67.1 },
    'Levante': { pattern: '5x114.3', centerBore: 67.1 },
    'Quattroporte': { pattern: '5x114.3', centerBore: 67.1 },
    'GranTurismo': { pattern: '5x114.3', centerBore: 67.1 },
    'GranCabrio': { pattern: '5x114.3', centerBore: 67.1 },
    'MC20': { pattern: '5x114.3', centerBore: 67.1 },
  },
  'Alfa Romeo': {
    'Giulia': { pattern: '5x110', centerBore: 65.1 },
    'Stelvio': { pattern: '5x110', centerBore: 65.1 },
    '4C': { pattern: '5x108', centerBore: 63.4 },
    'Giulietta': { pattern: '5x110', centerBore: 65.1 },
    'MiTo': { pattern: '4x98', centerBore: 58.1 },
  },
  'Aston Martin': {
    'DB11': { pattern: '5x114.3', centerBore: 68.1 },
    'DB9': { pattern: '5x114.3', centerBore: 68.1 },
    'DBS': { pattern: '5x114.3', centerBore: 68.1 },
    'Vantage': { pattern: '5x114.3', centerBore: 68.1 },
    'Rapide': { pattern: '5x114.3', centerBore: 68.1 },
    'Vanquish': { pattern: '5x114.3', centerBore: 68.1 },
    'DBX': { pattern: '5x114.3', centerBore: 68.1 },
  },
  'Bentley': {
    'Continental': { pattern: '5x112', centerBore: 57.1 },
    'Flying Spur': { pattern: '5x112', centerBore: 57.1 },
    'Bentayga': { pattern: '5x130', centerBore: 71.6 },
    'Mulsanne': { pattern: '5x130', centerBore: 71.6 },
  },
  'Ferrari': {
    '488': { pattern: '5x114.3', centerBore: 67.1 },
    '458': { pattern: '5x114.3', centerBore: 67.1 },
    'F8': { pattern: '5x114.3', centerBore: 67.1 },
    '812': { pattern: '5x114.3', centerBore: 67.1 },
    'Roma': { pattern: '5x114.3', centerBore: 67.1 },
    'SF90': { pattern: '5x114.3', centerBore: 67.1 },
    'Portofino': { pattern: '5x114.3', centerBore: 67.1 },
    'California': { pattern: '5x114.3', centerBore: 67.1 },
    'GTC4Lusso': { pattern: '5x114.3', centerBore: 67.1 },
    'FF': { pattern: '5x114.3', centerBore: 67.1 },
    '296': { pattern: '5x114.3', centerBore: 67.1 },
    'Purosangue': { pattern: '5x114.3', centerBore: 67.1 },
  },
  'Lamborghini': {
    'Huracan': { pattern: '5x112', centerBore: 57.1 },
    'Aventador': { pattern: '5x120', centerBore: 64.1 },
    'Urus': { pattern: '5x130', centerBore: 71.6 },
    'Gallardo': { pattern: '5x112', centerBore: 57.1 },
  },
  'McLaren': {
    '570S': { pattern: '5x112', centerBore: 57.1 },
    '600LT': { pattern: '5x112', centerBore: 57.1 },
    '720S': { pattern: '5x112', centerBore: 57.1 },
    '765LT': { pattern: '5x112', centerBore: 57.1 },
    'Artura': { pattern: '5x112', centerBore: 57.1 },
    'GT': { pattern: '5x112', centerBore: 57.1 },
    'Senna': { pattern: '5x112', centerBore: 57.1 },
  },
  'Rolls-Royce': {
    'Ghost': { pattern: '5x120', centerBore: 72.6 },
    'Phantom': { pattern: '5x120', centerBore: 72.6 },
    'Wraith': { pattern: '5x120', centerBore: 72.6 },
    'Dawn': { pattern: '5x120', centerBore: 72.6 },
    'Cullinan': { pattern: '5x120', centerBore: 72.6 },
    'Spectre': { pattern: '5x120', centerBore: 72.6 },
  },
  'Lotus': {
    'Evora': { pattern: '5x114.3', centerBore: 68.1 },
    'Elise': { pattern: '4x100', centerBore: 56.1 },
    'Exige': { pattern: '4x100', centerBore: 56.1 },
    'Emira': { pattern: '5x114.3', centerBore: 68.1 },
  },
};

function normalizeModel(m: string): string {
  return m.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('\n🔧 Filling missing bolt patterns (NO REGRESSION)\n');
  
  // ONLY get records with NULL or empty bolt_pattern
  const result = await pool.query(`
    SELECT id, make, model
    FROM vehicle_fitments
    WHERE year >= 2000
      AND (bolt_pattern IS NULL OR bolt_pattern = '')
  `);
  
  console.log(`Found ${result.rowCount} records missing bolt pattern\n`);
  
  const updates: { id: string; pattern: string; centerBore: number }[] = [];
  let matched = 0, unmatched = 0;
  const unmatchedModels: Set<string> = new Set();
  
  for (const row of result.rows) {
    const { id, make, model } = row;
    const normModel = normalizeModel(model);
    
    let boltData: { pattern: string; centerBore: number } | null = null;
    
    // Find bolt pattern (case-insensitive)
    for (const [mapMake, models] of Object.entries(BOLT_PATTERNS)) {
      if (mapMake.toLowerCase() === make.toLowerCase()) {
        for (const [mapModel, data] of Object.entries(models)) {
          const normMapModel = normalizeModel(mapModel);
          if (normModel.includes(normMapModel) || normMapModel.includes(normModel) ||
              normModel.replace(/\s/g, '') === normMapModel.replace(/\s/g, '')) {
            boltData = data;
            break;
          }
        }
        break;
      }
    }
    
    if (boltData) {
      updates.push({ id, pattern: boltData.pattern, centerBore: boltData.centerBore });
      matched++;
    } else {
      unmatchedModels.add(`${make} ${model}`);
      unmatched++;
    }
  }
  
  console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);
  if (unmatchedModels.size > 0 && unmatchedModels.size <= 30) {
    console.log('\nUnmatched models:');
    [...unmatchedModels].forEach(m => console.log(`  ${m}`));
  }
  console.log('');
  
  if (updates.length === 0) {
    console.log('No updates to perform.');
    await pool.end();
    return;
  }
  
  // Execute batch updates
  const BATCH_SIZE = 500;
  let updated = 0;
  
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    
    // Build update query
    const patternCases = batch.map((u, idx) => `WHEN id = $${idx * 3 + 1}::uuid THEN $${idx * 3 + 2}`).join(' ');
    const boreCases = batch.map((u, idx) => `WHEN id = $${idx * 3 + 1}::uuid THEN $${idx * 3 + 3}::numeric`).join(' ');
    const ids = batch.map(u => u.id);
    const params: any[] = [];
    batch.forEach(u => { params.push(u.id, u.pattern, u.centerBore); });
    
    const query = `
      UPDATE vehicle_fitments 
      SET bolt_pattern = CASE ${patternCases} END,
          center_bore_mm = CASE ${boreCases} END,
          updated_at = NOW()
      WHERE id = ANY($${params.length + 1}::uuid[])
    `;
    params.push(ids);
    
    await pool.query(query, params);
    updated += batch.length;
    console.log(`  Updated ${updated}/${updates.length}`);
  }
  
  console.log(`\n✅ Done! Updated ${updated} records with bolt patterns`);
  await pool.end();
}

main().catch(console.error);
