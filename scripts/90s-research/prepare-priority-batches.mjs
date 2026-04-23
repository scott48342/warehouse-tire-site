import pg from 'pg';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// High-value 90s vehicles that people still drive/restore
const PRIORITY_VEHICLES = {
  // Tier 1: High demand survivors - these are STILL on the road
  honda: [
    'Accord', 'Civic', 'Prelude', 'CR-V', 'Odyssey', 'Passport', 'Del Sol'
  ],
  toyota: [
    'Camry', 'Corolla', '4Runner', 'Tacoma', 'RAV4', 'Supra', 'Celica', 
    'Land Cruiser', 'T100', 'Tercel', 'Avalon', 'Sienna'
  ],
  nissan: [
    'Maxima', 'Altima', 'Sentra', '240SX', '300ZX', 'Pathfinder', 
    'Frontier', 'Quest', 'Pickup'
  ],
  mazda: [
    'Miata', 'MX-5', '626', 'Protege', 'RX-7', 'MPV', 'B2300', 'B3000', 'B4000',
    'MX-6', 'Millenia', '929'
  ],
  subaru: [
    'Impreza', 'Legacy', 'Outback', 'Forester', 'SVX'
  ],
  
  // Tier 2: American workhorses
  ford: [
    'Ranger', 'F-150', 'F-250', 'F-350', 'Explorer', 'Expedition', 
    'Bronco', 'Mustang', 'Taurus', 'Crown Victoria', 'Contour', 'Escort'
  ],
  chevrolet: [
    'Silverado', 'C1500', 'K1500', 'S-10', 'Blazer', 'Tahoe', 'Suburban',
    'Camaro', 'Corvette', 'Impala', 'Cavalier', 'Malibu', 'Monte Carlo'
  ],
  dodge: [
    'Ram 1500', 'Ram 2500', 'Ram 3500', 'Dakota', 'Durango',
    'Viper', 'Neon', 'Intrepid', 'Stratus', 'Caravan'
  ],
  jeep: [
    'Wrangler', 'Cherokee', 'Grand Cherokee'
  ],
  gmc: [
    'Sierra', 'Yukon', 'Jimmy', 'Sonoma', 'Suburban'
  ],
  
  // Tier 3: Enthusiast & luxury
  acura: [
    'Integra', 'NSX', 'Legend', 'TL', 'CL', 'RL'
  ],
  lexus: [
    'LS400', 'ES300', 'GS300', 'SC300', 'SC400', 'LX450', 'RX300'
  ],
  infiniti: [
    'Q45', 'J30', 'I30', 'G20', 'QX4'
  ],
  bmw: [
    '3 Series', '5 Series', '7 Series', 'M3', 'Z3'
  ],
  
  // Tier 4: Others with following
  volkswagen: [
    'Jetta', 'Golf', 'GTI', 'Passat', 'Cabrio', 'Beetle'
  ],
  volvo: [
    '850', 'S70', 'V70', 'S40', 'S80', '940', '960'
  ],
  hyundai: [
    'Elantra', 'Sonata', 'Accent', 'Tiburon', 'Santa Fe'
  ],
  mitsubishi: [
    'Eclipse', '3000GT', 'Montero', 'Galant', 'Lancer'
  ],
  chrysler: [
    'Town & Country', 'Sebring', 'Concorde', 'LHS', '300M'
  ]
};

// Years to cover
const YEARS = [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999];

async function main() {
  const client = await pool.connect();
  
  try {
    // Get existing coverage
    const existing = await client.query(`
      SELECT LOWER(make) as make, LOWER(model) as model, year
      FROM vehicle_fitments
      WHERE year >= 1990 AND year < 2000
    `);
    
    const covered = new Set(
      existing.rows.map(r => `${r.year}|${r.make}|${r.model}`)
    );
    
    console.log(`Found ${covered.size} existing 90s fitment records\n`);
    
    // Build list of missing vehicles
    const missing = [];
    
    for (const [make, models] of Object.entries(PRIORITY_VEHICLES)) {
      for (const model of models) {
        for (const year of YEARS) {
          const key = `${year}|${make}|${model.toLowerCase()}`;
          if (!covered.has(key)) {
            missing.push({ year, make, model });
          }
        }
      }
    }
    
    console.log(`Total missing priority vehicles: ${missing.length}\n`);
    
    // Group into batches of 75 (manageable size for research)
    const BATCH_SIZE = 75;
    const batches = [];
    
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      batches.push(missing.slice(i, i + BATCH_SIZE));
    }
    
    // Create output directory
    const outDir = 'scripts/90s-research/batches';
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
    
    // Write batches
    for (let i = 0; i < batches.length; i++) {
      const batchNum = String(i + 1).padStart(2, '0');
      const batch = batches[i];
      
      // Group by make for readability
      const byMake = {};
      for (const v of batch) {
        if (!byMake[v.make]) byMake[v.make] = [];
        byMake[v.make].push(v);
      }
      
      const batchData = {
        batchId: `90s-batch-${batchNum}`,
        created: new Date().toISOString(),
        vehicleCount: batch.length,
        makes: Object.keys(byMake),
        vehicles: batch,
        researchNotes: {
          priority: i < 5 ? 'HIGH' : i < 10 ? 'MEDIUM' : 'LOW',
          verificationRequired: true,
          minSources: 2,
          requiredFields: ['bolt_pattern', 'hub_bore', 'oem_wheel_sizes', 'oem_tire_sizes']
        }
      };
      
      const outPath = `${outDir}/batch-${batchNum}.json`;
      writeFileSync(outPath, JSON.stringify(batchData, null, 2));
      console.log(`Created ${outPath}: ${batch.length} vehicles (${Object.keys(byMake).join(', ')})`);
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total batches: ${batches.length}`);
    console.log(`Total vehicles: ${missing.length}`);
    console.log(`High priority (1-5): ${batches.slice(0, 5).reduce((sum, b) => sum + b.length, 0)} vehicles`);
    console.log(`Medium priority (6-10): ${batches.slice(5, 10).reduce((sum, b) => sum + b.length, 0)} vehicles`);
    console.log(`Low priority (11+): ${batches.slice(10).reduce((sum, b) => sum + b.length, 0)} vehicles`);
    
    // Create manifest
    const manifest = {
      created: new Date().toISOString(),
      totalBatches: batches.length,
      totalVehicles: missing.length,
      batchSize: BATCH_SIZE,
      batches: batches.map((b, i) => ({
        id: `90s-batch-${String(i + 1).padStart(2, '0')}`,
        vehicles: b.length,
        priority: i < 5 ? 'HIGH' : i < 10 ? 'MEDIUM' : 'LOW',
        status: 'pending'
      }))
    };
    
    writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest written to ${outDir}/manifest.json`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
