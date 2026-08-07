require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Expected domestic models for 1990-1999
const expectedModels = {
  'Ford': {
    'F-150': { start: 1990, end: 1999 },
    'F-250': { start: 1990, end: 1999 },
    'F-350': { start: 1990, end: 1999 },
    'Ranger': { start: 1990, end: 1999 },
    'Explorer': { start: 1991, end: 1999 },
    'Expedition': { start: 1997, end: 1999 },
    'Mustang': { start: 1990, end: 1999 },
    'Taurus': { start: 1990, end: 1999 },
    'Escort': { start: 1990, end: 1999 },
    'Crown Victoria': { start: 1992, end: 1999 },
    'Bronco': { start: 1990, end: 1996 },
    'Thunderbird': { start: 1990, end: 1997 },
    'Probe': { start: 1990, end: 1997 },
    'Contour': { start: 1995, end: 1999 },
    'Windstar': { start: 1995, end: 1999 },
    'E-150': { start: 1990, end: 1999 },
    'Aerostar': { start: 1990, end: 1997 },
  },
  'Chevrolet': {
    'C/K 1500': { start: 1990, end: 1998 },
    'Silverado 1500': { start: 1999, end: 1999 },
    'S-10': { start: 1990, end: 1999 },
    'Tahoe': { start: 1995, end: 1999 },
    'Suburban': { start: 1990, end: 1999 },
    'Blazer': { start: 1990, end: 1999 },
    'Camaro': { start: 1990, end: 1999 },
    'Corvette': { start: 1990, end: 1999 },
    'Impala': { start: 1994, end: 1996 },
    'Caprice': { start: 1990, end: 1996 },
    'Lumina': { start: 1990, end: 1999 },
    'Cavalier': { start: 1990, end: 1999 },
    'Monte Carlo': { start: 1995, end: 1999 },
    'Malibu': { start: 1997, end: 1999 },
    'Astro': { start: 1990, end: 1999 },
    'Express': { start: 1996, end: 1999 },
  },
  'Dodge': {
    'Ram 1500': { start: 1994, end: 1999 },
    'Ram 2500': { start: 1994, end: 1999 },
    'Ram 3500': { start: 1994, end: 1999 },
    'Dakota': { start: 1990, end: 1999 },
    'Durango': { start: 1998, end: 1999 },
    'Caravan': { start: 1990, end: 1999 },
    'Grand Caravan': { start: 1990, end: 1999 },
    'Intrepid': { start: 1993, end: 1999 },
    'Neon': { start: 1995, end: 1999 },
    'Stratus': { start: 1995, end: 1999 },
    'Viper': { start: 1992, end: 1999 },
    'Avenger': { start: 1995, end: 1999 },
  },
  'GMC': {
    'C/K 1500': { start: 1990, end: 1998 },
    'Sierra 1500': { start: 1999, end: 1999 },
    'Yukon': { start: 1992, end: 1999 },
    'Jimmy': { start: 1990, end: 1999 },
    'Sonoma': { start: 1991, end: 1999 },
    'Safari': { start: 1990, end: 1999 },
    'Suburban': { start: 1990, end: 1999 },
  },
  'Jeep': {
    'Wrangler': { start: 1990, end: 1999 },
    'Cherokee': { start: 1990, end: 1999 },
    'Grand Cherokee': { start: 1993, end: 1999 },
  },
  'Pontiac': {
    'Firebird': { start: 1990, end: 1999 },
    'Trans Am': { start: 1990, end: 1999 },
    'Grand Prix': { start: 1990, end: 1999 },
    'Grand Am': { start: 1990, end: 1999 },
    'Bonneville': { start: 1990, end: 1999 },
    'Sunfire': { start: 1995, end: 1999 },
  },
  'Buick': {
    'LeSabre': { start: 1990, end: 1999 },
    'Century': { start: 1990, end: 1999 },
    'Regal': { start: 1990, end: 1999 },
    'Park Avenue': { start: 1991, end: 1999 },
    'Riviera': { start: 1990, end: 1999 },
    'Roadmaster': { start: 1991, end: 1996 },
  },
  'Cadillac': {
    'DeVille': { start: 1990, end: 1999 },
    'Seville': { start: 1990, end: 1999 },
    'Eldorado': { start: 1990, end: 1999 },
    'Fleetwood': { start: 1990, end: 1996 },
    'Escalade': { start: 1999, end: 1999 },
  },
  'Lincoln': {
    'Town Car': { start: 1990, end: 1999 },
    'Continental': { start: 1990, end: 1999 },
    'Mark VIII': { start: 1993, end: 1998 },
    'Navigator': { start: 1998, end: 1999 },
  },
  'Chrysler': {
    'Town & Country': { start: 1990, end: 1999 },
    'Concorde': { start: 1993, end: 1999 },
    'LHS': { start: 1994, end: 1999 },
    'Sebring': { start: 1995, end: 1999 },
    '300M': { start: 1999, end: 1999 },
  },
  'Oldsmobile': {
    'Cutlass': { start: 1990, end: 1999 },
    '88': { start: 1990, end: 1999 },
    'Bravada': { start: 1991, end: 1999 },
    'Aurora': { start: 1995, end: 1999 },
    'Intrigue': { start: 1998, end: 1999 },
    'Alero': { start: 1999, end: 1999 },
  },
  'Mercury': {
    'Grand Marquis': { start: 1990, end: 1999 },
    'Sable': { start: 1990, end: 1999 },
    'Cougar': { start: 1990, end: 1999 },
    'Mountaineer': { start: 1997, end: 1999 },
  },
  'Plymouth': {
    'Voyager': { start: 1990, end: 1999 },
    'Grand Voyager': { start: 1990, end: 1999 },
    'Neon': { start: 1995, end: 1999 },
    'Prowler': { start: 1997, end: 1999 },
  },
  'Saturn': {
    'SL': { start: 1991, end: 1999 },
    'SC': { start: 1993, end: 1999 },
    'SW': { start: 1993, end: 1999 },
  },
};

// Japanese makes
const expectedJapanese = {
  'Toyota': {
    '4Runner': { start: 1990, end: 1999 },
    'Camry': { start: 1990, end: 1999 },
    'Corolla': { start: 1990, end: 1999 },
    'Celica': { start: 1990, end: 1999 },
    'Supra': { start: 1990, end: 1998 },
    'Tacoma': { start: 1995, end: 1999 },
    'RAV4': { start: 1996, end: 1999 },
    'Land Cruiser': { start: 1990, end: 1999 },
    'Tercel': { start: 1990, end: 1999 },
    'Avalon': { start: 1995, end: 1999 },
    'Sienna': { start: 1998, end: 1999 },
  },
  'Honda': {
    'Accord': { start: 1990, end: 1999 },
    'Civic': { start: 1990, end: 1999 },
    'Prelude': { start: 1990, end: 1999 },
    'CR-V': { start: 1997, end: 1999 },
    'Odyssey': { start: 1995, end: 1999 },
    'Passport': { start: 1994, end: 1999 },
    'Del Sol': { start: 1993, end: 1997 },
  },
  'Nissan': {
    'Altima': { start: 1993, end: 1999 },
    'Maxima': { start: 1990, end: 1999 },
    'Sentra': { start: 1990, end: 1999 },
    '300ZX': { start: 1990, end: 1996 },
    '240SX': { start: 1990, end: 1998 },
    'Pathfinder': { start: 1990, end: 1999 },
    'Frontier': { start: 1998, end: 1999 },
    'Quest': { start: 1993, end: 1999 },
  },
  'Mazda': {
    '626': { start: 1990, end: 1999 },
    'Miata': { start: 1990, end: 1999 },
    'RX-7': { start: 1990, end: 1995 },
    'MX-6': { start: 1990, end: 1997 },
    'Protege': { start: 1990, end: 1999 },
    'MPV': { start: 1990, end: 1998 },
    'B2300': { start: 1994, end: 1999 },
  },
  'Mitsubishi': {
    'Eclipse': { start: 1990, end: 1999 },
    'Galant': { start: 1990, end: 1999 },
    '3000GT': { start: 1991, end: 1999 },
    'Montero': { start: 1990, end: 1999 },
  },
  'Subaru': {
    'Legacy': { start: 1990, end: 1999 },
    'Impreza': { start: 1993, end: 1999 },
    'Outback': { start: 1995, end: 1999 },
    'Forester': { start: 1998, end: 1999 },
  },
};

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('=== 1990s COVERAGE ANALYSIS (1990-1999) ===\n');
    
    let totalExpectedYears = 0;
    let totalCoveredYears = 0;
    let totalExpectedModels = 0;
    let totalCoveredModels = 0;
    
    // Domestic coverage
    console.log('--- DOMESTIC COVERAGE ---\n');
    
    for (const [make, models] of Object.entries(expectedModels)) {
      let makeExpectedYears = 0;
      let makeCoveredYears = 0;
      let makeExpectedModels = Object.keys(models).length;
      let makeCoveredModels = 0;
      const missing = [];
      
      for (const [model, range] of Object.entries(models)) {
        const expectedYears = range.end - range.start + 1;
        makeExpectedYears += expectedYears;
        
        const result = await client.query(`
          SELECT COUNT(DISTINCT year) as years
          FROM vehicle_fitments
          WHERE make = $1 AND model ILIKE $2 AND year >= 1990 AND year <= 1999
        `, [make, `%${model}%`]);
        
        const actualYears = parseInt(result.rows[0].years) || 0;
        makeCoveredYears += Math.min(actualYears, expectedYears);
        
        if (actualYears === 0) {
          missing.push(model);
        } else {
          makeCoveredModels++;
        }
      }
      
      totalExpectedYears += makeExpectedYears;
      totalCoveredYears += makeCoveredYears;
      totalExpectedModels += makeExpectedModels;
      totalCoveredModels += makeCoveredModels;
      
      const coverage = (makeCoveredYears / makeExpectedYears * 100).toFixed(1);
      const modelCov = (makeCoveredModels / makeExpectedModels * 100).toFixed(0);
      
      console.log(`${make}: ${coverage}% year coverage, ${modelCov}% models (${makeCoveredModels}/${makeExpectedModels})`);
      if (missing.length > 0) {
        console.log(`  ❌ Missing: ${missing.join(', ')}`);
      }
    }
    
    // Japanese coverage
    console.log('\n--- JAPANESE COVERAGE ---\n');
    
    for (const [make, models] of Object.entries(expectedJapanese)) {
      let makeExpectedYears = 0;
      let makeCoveredYears = 0;
      let makeExpectedModels = Object.keys(models).length;
      let makeCoveredModels = 0;
      const missing = [];
      
      for (const [model, range] of Object.entries(models)) {
        const expectedYears = range.end - range.start + 1;
        makeExpectedYears += expectedYears;
        
        const result = await client.query(`
          SELECT COUNT(DISTINCT year) as years
          FROM vehicle_fitments
          WHERE make = $1 AND model ILIKE $2 AND year >= 1990 AND year <= 1999
        `, [make, `%${model}%`]);
        
        const actualYears = parseInt(result.rows[0].years) || 0;
        makeCoveredYears += Math.min(actualYears, expectedYears);
        
        if (actualYears === 0) {
          missing.push(model);
        } else {
          makeCoveredModels++;
        }
      }
      
      totalExpectedYears += makeExpectedYears;
      totalCoveredYears += makeCoveredYears;
      totalExpectedModels += makeExpectedModels;
      totalCoveredModels += makeCoveredModels;
      
      const coverage = (makeCoveredYears / makeExpectedYears * 100).toFixed(1);
      const modelCov = (makeCoveredModels / makeExpectedModels * 100).toFixed(0);
      
      console.log(`${make}: ${coverage}% year coverage, ${modelCov}% models (${makeCoveredModels}/${makeExpectedModels})`);
      if (missing.length > 0) {
        console.log(`  ❌ Missing: ${missing.join(', ')}`);
      }
    }
    
    // Overall summary
    const overallYear = (totalCoveredYears / totalExpectedYears * 100).toFixed(1);
    const overallModel = (totalCoveredModels / totalExpectedModels * 100).toFixed(1);
    
    console.log('\n========================================');
    console.log('OVERALL 1990s COVERAGE SUMMARY');
    console.log('========================================');
    console.log(`Expected models: ${totalExpectedModels}`);
    console.log(`Covered models: ${totalCoveredModels} (${overallModel}%)`);
    console.log(`Expected year-models: ${totalExpectedYears}`);
    console.log(`Covered year-models: ${totalCoveredYears} (${overallYear}%)`);
    
    // Total records
    const total = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE year >= 1990 AND year <= 1999
    `);
    console.log(`\nTotal 1990s records in database: ${total.rows[0].cnt}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
