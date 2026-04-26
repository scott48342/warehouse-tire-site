/**
 * Replace "Base" with actual entry-level trim names
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Model-specific base trim replacements (case-insensitive model matching)
const BASE_REPLACEMENTS: Record<string, Record<string, string>> = {
  'MINI': { 'cooper': 'Classic', 'clubman': 'Classic', 'countryman': 'Classic' },
  'Mini': { 'cooper': 'Classic', 'clubman': 'Classic', 'countryman': 'Classic' },
  'Mazda': { 'mazda3': 'Sport', 'mazda6': 'Sport', 'cx-30': '2.5 S', 'cx-5': 'Sport', 'cx-9': 'Sport', 'mx-5': 'Sport' },
  'Subaru': { 
    'impreza': '2.0i', 'wrx': 'Premium', 'legacy': '2.5i', 'outback': '2.5i', 
    'forester': '2.5i', 'crosstrek': '2.0i', 'ascent': '2.4i', 'brz': 'Premium' 
  },
  'Lexus': { 'gx': 'Premium', 'lx': 'Standard', 'is': 'IS 300', 'es': 'ES 350', 'rx': 'RX 350', 'nx': 'NX 250' },
  'Lincoln': { 'mkz': 'Select', 'mkc': 'Premiere', 'mkx': 'Premiere', 'navigator': 'Standard', 'aviator': 'Standard' },
  'Porsche': { 'panamera': 'Panamera', 'cayenne': 'Cayenne', 'macan': 'Macan', '911': 'Carrera', 'taycan': 'Taycan', 'boxster': '718', 'cayman': '718' },
  'BMW': { 'm3': 'Competition', 'm4': 'Competition', 'm5': 'Competition', 'z4': 'sDrive30i', 'x3': 'xDrive30i', 'x5': 'xDrive40i' },
  'Toyota': { 'land cruiser': 'Standard', '86': 'GT', 'gr86': 'Premium', 'supra': '2.0', 'prius': 'LE' },
  'Buick': { 'lacrosse': 'Preferred', 'enclave': 'Preferred', 'envision': 'Preferred', 'encore': 'Preferred', 'regal': 'Sportback' },
  'Acura': { 'mdx': 'Standard', 'rdx': 'Standard', 'tlx': 'Standard', 'ilx': 'Standard', 'integra': 'Standard' },
  'Audi': { 'tt': 'Premium', 'tt-s': 'TTS', 'a8': '55 TFSI', 'r8': 'V10', 'e-tron': 'Premium' },
  'Jaguar': { 'f-type': 'P300', 'xe': 'P250', 'xf': 'P250', 'f-pace': 'P250', 'e-pace': 'P250' },
  'Cadillac': { 'ats': 'Luxury', 'cts': 'Luxury', 'ct4': 'Luxury', 'ct5': 'Luxury', 'xt4': 'Luxury', 'xt5': 'Luxury', 'escalade': 'Luxury' },
  'Land Rover': { 'range rover': 'SE', 'range rover sport': 'SE', 'discovery': 'S', 'defender': 'S' },
  'Mercedes-Benz': { 'c-class': 'C 300', 'e-class': 'E 350', 's-class': 'S 500', 'gle': 'GLE 350', 'glc': 'GLC 300' },
  'Alfa Romeo': { 'giulia': 'Sprint', 'stelvio': 'Sprint' },
  'Genesis': { 'g70': '2.0T', 'g80': '2.5T', 'g90': '3.3T', 'gv70': '2.5T', 'gv80': '2.5T' },
  'Infiniti': { 'q50': 'Pure', 'q60': 'Pure', 'qx50': 'Pure', 'qx60': 'Pure', 'qx80': 'Luxe' },
  'Volvo': { 's60': 'Momentum', 's90': 'Momentum', 'xc40': 'Momentum', 'xc60': 'Momentum', 'xc90': 'Momentum' },
  'Tesla': { 'model 3': 'Standard Range', 'model y': 'Long Range', 'model s': 'Long Range', 'model x': 'Long Range' },
  'Rivian': { 'r1t': 'Adventure', 'r1s': 'Adventure' },
  'Dodge': { 'viper': 'SRT', 'challenger': 'SXT', 'charger': 'SXT', 'durango': 'SXT' },
  'Chrysler': { '300': 'Touring', 'pacifica': 'Touring' },
  'Chevrolet': { 'corvette': 'Stingray', 'camaro': 'LT', 'express': '1500 LS' },
  'Ford': { 'mustang': 'EcoBoost', 'gt': 'GT' },
  'Nissan': { 'gt-r': 'Premium', '370z': 'Sport', 'z': 'Sport' },
  'Honda': { 's2000': 'Base', 'nsx': 'Standard' },
  'Maserati': { 'ghibli': 'Base', 'levante': 'Base', 'quattroporte': 'S' },
  'Aston Martin': { 'db11': 'V8', 'vantage': 'V8' },
  'Bentley': { 'continental': 'V8', 'bentayga': 'V8' },
  'Ferrari': { '488': 'GTB', 'f8': 'Tributo', '812': 'Superfast' },
  'Lamborghini': { 'huracan': 'LP 580-2', 'urus': 'Base' },
  'McLaren': { '570s': 'Coupe', '720s': 'Coupe' },
  'Rolls-Royce': { 'ghost': 'Standard', 'phantom': 'Standard', 'cullinan': 'Standard' },
};

function normalizeModel(m: string): string {
  return m.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('\n🔧 Replacing "Base" with actual trim names\n');
  
  // Get all records with "Base" submodel
  const result = await pool.query(`
    SELECT id, make, model, submodel
    FROM vehicle_fitments
    WHERE year >= 2000 AND LOWER(submodel) = 'base'
  `);
  
  console.log(`Found ${result.rowCount} records with "Base" trim\n`);
  
  const updates: { id: string; submodel: string }[] = [];
  let matched = 0, unmatched = 0;
  
  for (const row of result.rows) {
    const { id, make, model } = row;
    const normModel = normalizeModel(model);
    
    // Find replacement
    let newTrim: string | null = null;
    
    // Check make-specific replacements (case-insensitive)
    for (const [mapMake, models] of Object.entries(BASE_REPLACEMENTS)) {
      if (mapMake.toLowerCase() === make.toLowerCase()) {
        for (const [mapModel, trim] of Object.entries(models)) {
          const normMapModel = normalizeModel(mapModel);
          if (normModel.includes(normMapModel) || normMapModel.includes(normModel) ||
              normModel.replace(/\s/g, '') === normMapModel.replace(/\s/g, '')) {
            newTrim = trim;
            break;
          }
        }
        break;
      }
    }
    
    if (newTrim) {
      updates.push({ id, submodel: newTrim });
      matched++;
    } else {
      // Fallback: use "Standard" instead of "Base"
      updates.push({ id, submodel: 'Standard' });
      unmatched++;
    }
  }
  
  console.log(`Matched: ${matched}, Fallback to Standard: ${unmatched}\n`);
  
  // Execute batch updates
  const BATCH_SIZE = 500;
  let updated = 0;
  
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const caseStatements = batch.map((u, idx) => `WHEN id = $${idx * 2 + 1}::uuid THEN $${idx * 2 + 2}`).join(' ');
    const ids = batch.map(u => u.id);
    const params: any[] = [];
    batch.forEach(u => { params.push(u.id, u.submodel); });
    
    const query = `
      UPDATE vehicle_fitments 
      SET submodel = CASE ${caseStatements} END,
          updated_at = NOW()
      WHERE id = ANY($${params.length + 1}::uuid[])
    `;
    params.push(ids);
    
    await pool.query(query, params);
    updated += batch.length;
    console.log(`  Updated ${updated}/${updates.length}`);
  }
  
  console.log(`\n✅ Done! Updated ${updated} records`);
  await pool.end();
}

main().catch(console.error);
